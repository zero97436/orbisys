"""Licence — modèle open-core à 4 plans cumulatifs.

  Community    (défaut, gratuit) : 25 hôtes, checks, dashboard, cartes, alertes
                e-mail/webhook, agent, API, IA locale (analyse + chat).
  Professional : canaux avancés (Slack/Teams/Discord/Telegram/SMS), rapports
                 SLA/MTTR + PDF, dashboards personnalisables, rétention étendue.
  Business     : connecteurs ITSM (Jira/ServiceNow), automatisation de
                 remédiation, supervision distribuée (sondes), multi-sites.
  Enterprise   : HA, SSO, audit/conformité, support 24/7.

La clé de licence porte le plan ; les features en découlent (cumulatif).
Signature Ed25519 : clé publique embarquée (vérification), clé privée chez
l'éditeur. Clé absente/invalide/expirée -> Community (rien ne s'arrête).
"""
from __future__ import annotations

import base64
import json
from datetime import date
from functools import lru_cache

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import HTTPException

from app.core.config import settings

# Clé publique Ed25519 de l'éditeur (vérification uniquement).
PUBLIC_KEY_HEX = "3e3884b11f4bdded21a6b42885fd0e7944db37c2e5da7e501d75b9ec74894cfe"

# Features par plan (chaque plan inclut les précédents).
_PRO = {
    "advanced_channels",   # Slack, Teams, Discord, Telegram, SMS, script
    "sla_reports",         # rapports SLA / MTTR
    "pdf_reports",         # export PDF
    "custom_dashboards",   # dashboards personnalisables par utilisateur
    "extended_retention",  # rétention étendue
    "branding",            # personnalisation de marque
}
_BUSINESS = _PRO | {
    "itsm_connectors",     # push Jira / ServiceNow / webhook
    "remediation",         # automatisation de remédiation (agent + plans IA)
    "distributed",         # supervision distribuée (checks exécutés par les sondes)
    "multi_tenant",        # multi-tenant MSP (multi-clients cloisonnés)
    "api_extended",
}
_ENTERPRISE = _BUSINESS | {"ha", "sso", "audit", "support_247"}

PLAN_FEATURES: dict[str, set[str]] = {
    "community": set(),
    "professional": _PRO,
    "business": _BUSINESS,
    "enterprise": _ENTERPRISE,
}
PLAN_ORDER = ["community", "professional", "business", "enterprise"]
ALL_FEATURES = _ENTERPRISE

# Plan minimal requis par feature (pour les messages d'upgrade).
FEATURE_PLAN: dict[str, str] = {}
for _plan in PLAN_ORDER:
    for _f in PLAN_FEATURES[_plan]:
        FEATURE_PLAN.setdefault(_f, _plan)

FEATURE_LABEL = {
    "advanced_channels": "canaux de notification avancés (Slack, Teams, Telegram…)",
    "sla_reports": "rapports SLA / MTTR",
    "pdf_reports": "export PDF",
    "custom_dashboards": "dashboards personnalisables",
    "extended_retention": "rétention étendue",
    "branding": "personnalisation de marque",
    "itsm_connectors": "connecteurs ITSM (Jira, ServiceNow)",
    "remediation": "automatisation de remédiation",
    "distributed": "supervision distribuée",
    "multi_tenant": "multi-tenant MSP (multi-clients cloisonnés)",
    "api_extended": "API étendue",
    "ha": "haute disponibilité",
    "sso": "SSO (OpenID Connect)",
    "audit": "journal d'audit",
    "support_247": "support 24/7",
}

COMMUNITY_PLAN = {
    "plan": "community",
    "max_hosts": settings.COMMUNITY_MAX_HOSTS,  # configurable via env COMMUNITY_MAX_HOSTS
    "features": [],
    "customer": None,
    "expires": None,
}


def _verify_signature(key: str) -> dict | None:
    """Payload si la signature est valide (sans contrôle d'expiration), sinon None."""
    try:
        payload_b64, sig_hex = key.strip().split(".")
        payload_raw = base64.urlsafe_b64decode(payload_b64 + "==")
        public = Ed25519PublicKey.from_public_bytes(bytes.fromhex(PUBLIC_KEY_HEX))
        public.verify(bytes.fromhex(sig_hex), payload_raw)
        payload = json.loads(payload_raw)
        expires = payload.get("expires")
        if expires:
            date.fromisoformat(expires)  # date illisible = clé invalide
        return payload
    except Exception:  # noqa: BLE001 — clé malformée/falsifiée = Community
        return None


def _is_expired(expires: str | None) -> bool:
    return bool(expires) and date.fromisoformat(expires) < date.today()


def _verify(key: str) -> dict | None:
    payload = _verify_signature(key)
    if payload and _is_expired(payload.get("expires")):
        return None  # licence expirée
    return payload


@lru_cache
def _cached_license(key: str) -> dict:
    # Seule la signature est mise en cache : l'expiration est réévaluée à chaque
    # appel (get_license), sinon une licence expirée resterait active jusqu'au redémarrage.
    payload = _verify_signature(key) if key else None
    if not payload:
        return dict(COMMUNITY_PLAN)
    plan = payload.get("plan", "professional")
    if plan not in PLAN_FEATURES:
        plan = "professional"
    features = set(PLAN_FEATURES[plan])
    # Features additionnelles explicites (vente à la carte / OEM).
    features |= {f for f in payload.get("features", []) if f in ALL_FEATURES}
    max_hosts = payload.get("max_hosts")  # None/absent = illimité (plans payants)
    if max_hosts is not None and (not isinstance(max_hosts, int) or max_hosts < 1):
        max_hosts = None
    return {
        "plan": plan,
        "max_hosts": max_hosts,
        "features": sorted(features),
        "customer": payload.get("customer"),
        "expires": payload.get("expires"),
    }


def get_license() -> dict:
    lic = _cached_license(settings.LICENSE_KEY or "")
    if _is_expired(lic["expires"]):
        return dict(COMMUNITY_PLAN)
    return lic


def license_key_status() -> str:
    """État de la clé configurée, pour l'expliquer à l'administrateur (jamais la clé) :
    « none » (aucune clé, Community), « valid », « expired » ou « invalid »
    (signature ou format incorrects). Dans les deux derniers cas l'édition est Community."""
    key = settings.LICENSE_KEY or ""
    if not key:
        return "none"
    payload = _verify_signature(key)
    if not payload:
        return "invalid"
    return "expired" if _is_expired(payload.get("expires")) else "valid"


def has_feature(name: str) -> bool:
    return name in get_license()["features"]


def max_hosts() -> int | None:
    """None = illimité."""
    return get_license()["max_hosts"]


def require_feature(feature: str):
    """Dépendance FastAPI : 403 avec message d'upgrade si la feature manque."""
    def dep() -> None:
        if not has_feature(feature):
            plan = FEATURE_PLAN.get(feature, "professional").capitalize()
            label = FEATURE_LABEL.get(feature, feature)
            raise HTTPException(
                403,
                f"Fonctionnalité « {label} » disponible à partir du plan {plan}. "
                f"Plan actuel : {get_license()['plan']}.",
            )
    return dep
