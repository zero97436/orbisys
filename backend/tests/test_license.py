import base64
import json

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

import app.core.license as lic_mod
from app.core.license import get_license

# Paire de clés ÉPHÉMÈRE pour les tests (la vraie clé privée n'est pas dans le dépôt).
_TEST_KEY = Ed25519PrivateKey.generate()
_TEST_PUB_HEX = _TEST_KEY.public_key().public_bytes(
    serialization.Encoding.Raw, serialization.PublicFormat.Raw
).hex()


def _make_key(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode()
    sig = _TEST_KEY.sign(raw).hex()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=") + "." + sig


def test_default_community_plan():
    """Sans clé : édition Community — 25 hôtes, pas de features payantes."""
    from app.core.license import COMMUNITY_PLAN, PLAN_FEATURES
    assert COMMUNITY_PLAN["plan"] == "community"
    assert COMMUNITY_PLAN["max_hosts"] == 25
    assert PLAN_FEATURES["community"] == set()


def test_license_endpoint_shape(client):
    """L'endpoint /hosts/license renvoie bien plan + quota + compteur d'usage."""
    lic = client.get("/api/hosts/license").json()
    assert "plan" in lic and "max_hosts" in lic
    assert isinstance(lic["used"], int)


def test_host_limit_enforced(client, monkeypatch):
    # Limite = hôtes existants + 1 -> le 2e ajout doit être refusé.
    used = len(client.get("/api/hosts").json())
    monkeypatch.setattr("app.api.routes.hosts.get_license",
                        lambda: {"plan": "free", "max_hosts": used + 1, "customer": None, "expires": None})
    assert client.post("/api/hosts", json={"name": "lim-1", "hostname_or_ip": "10.0.3.100"}).status_code == 201
    r = client.post("/api/hosts", json={"name": "lim-2", "hostname_or_ip": "10.0.3.101"})
    assert r.status_code == 403
    assert "Limite de la licence" in r.json()["detail"]


def test_discovery_import_respects_limit(client, monkeypatch):
    used = len(client.get("/api/hosts").json())
    monkeypatch.setattr("app.api.routes.hosts.get_license",
                        lambda: {"plan": "free", "max_hosts": used + 1, "customer": None, "expires": None})
    r = client.post("/api/discovery/import", json={"items": [
        {"name": "d1", "hostname_or_ip": "10.0.3.110", "checks": []},
        {"name": "d2", "hostname_or_ip": "10.0.3.111", "checks": []},
    ]})
    assert r.status_code == 403  # 2 à ajouter, 1 seul slot -> tout est refusé


def test_valid_license_key_raises_limit(monkeypatch):
    from app.core.config import settings as cfg

    monkeypatch.setattr(lic_mod, "PUBLIC_KEY_HEX", _TEST_PUB_HEX)
    # Les features découlent du plan (cumulatif).
    key = _make_key({"plan": "professional", "customer": "ACME"})
    monkeypatch.setattr(cfg, "LICENSE_KEY", key)
    lic = get_license()
    assert lic["plan"] == "professional" and lic["customer"] == "ACME"
    assert lic["max_hosts"] is None                      # illimité (plans payants)
    assert "sla_reports" in lic["features"]              # feature Pro incluse
    assert "itsm_connectors" not in lic["features"]      # feature Business absente

    # Business inclut Pro + ses propres features.
    biz = _make_key({"plan": "business", "customer": "ACME"})
    monkeypatch.setattr(cfg, "LICENSE_KEY", biz)
    feats = set(get_license()["features"])
    assert {"sla_reports", "itsm_connectors", "remediation"} <= feats
    assert "sso" not in feats                            # Enterprise seulement

    # Feature à la carte en plus du plan.
    alacarte = _make_key({"plan": "professional", "features": ["sso"]})
    monkeypatch.setattr(cfg, "LICENSE_KEY", alacarte)
    assert "sso" in get_license()["features"]

    # Plafond OEM optionnel.
    oem = _make_key({"plan": "oem", "max_hosts": 500, "customer": "OEM Corp"})
    monkeypatch.setattr(cfg, "LICENSE_KEY", oem)
    assert get_license()["max_hosts"] == 500


def test_tampered_or_expired_key_falls_back_to_free(monkeypatch):
    from app.core.config import settings as cfg

    monkeypatch.setattr(lic_mod, "PUBLIC_KEY_HEX", _TEST_PUB_HEX)

    # Signature falsifiée (payload modifié, signature d'un autre payload).
    good = _make_key({"plan": "pro", "max_hosts": 5000, "customer": "X"})
    forged_payload = base64.urlsafe_b64encode(
        json.dumps({"plan": "pro", "max_hosts": 999999, "customer": "X"}).encode()
    ).decode().rstrip("=")
    forged = forged_payload + "." + good.split(".")[1]
    monkeypatch.setattr(cfg, "LICENSE_KEY", forged)
    assert get_license()["plan"] == "community"

    # Licence expirée.
    expired = _make_key({"plan": "enterprise", "features": ["sso"], "expires": "2020-01-01"})
    monkeypatch.setattr(cfg, "LICENSE_KEY", expired)
    assert get_license()["features"] == []  # retour Community

    # Clé illisible.
    monkeypatch.setattr(cfg, "LICENSE_KEY", "n-importe-quoi")
    assert get_license()["plan"] == "community"

    # Clé signée par une AUTRE clé privée (attaquant avec sa propre paire).
    attacker = Ed25519PrivateKey.generate()
    raw = json.dumps({"plan": "pro", "max_hosts": 999999}, separators=(",", ":")).encode()
    rogue = base64.urlsafe_b64encode(raw).decode().rstrip("=") + "." + attacker.sign(raw).hex()
    monkeypatch.setattr(cfg, "LICENSE_KEY", rogue)
    assert get_license()["plan"] == "community"


def test_expiry_is_reevaluated_despite_cache(monkeypatch):
    """Une licence valide au démarrage doit retomber en Community à son expiration,
    sans redémarrage (le cache ne porte que sur la signature)."""
    from datetime import date as real_date
    from app.core.config import settings as cfg

    monkeypatch.setattr(lic_mod, "PUBLIC_KEY_HEX", _TEST_PUB_HEX)
    key = _make_key({"plan": "business", "customer": "Cache", "expires": "2031-06-30"})
    monkeypatch.setattr(cfg, "LICENSE_KEY", key)

    class _Before(real_date):
        @classmethod
        def today(cls):
            return real_date(2031, 6, 30)

    class _After(real_date):
        @classmethod
        def today(cls):
            return real_date(2031, 7, 1)

    monkeypatch.setattr(lic_mod, "date", _Before)
    assert get_license()["plan"] == "business"      # dernier jour : encore valide
    monkeypatch.setattr(lic_mod, "date", _After)
    assert get_license()["plan"] == "community"     # lendemain : Community, sans restart
    assert get_license()["features"] == []


def test_key_format_issued_by_licensing_service(monkeypatch):
    """Compatibilité : format exact émis par licensing/app.py (_sign_license)."""
    from app.core.config import settings as cfg

    monkeypatch.setattr(lic_mod, "PUBLIC_KEY_HEX", _TEST_PUB_HEX)
    key = _make_key({"plan": "professional", "customer": "client@example.com",
                     "features": [], "expires": "2099-01-01"})
    monkeypatch.setattr(cfg, "LICENSE_KEY", key)
    lic = get_license()
    assert lic["plan"] == "professional" and lic["max_hosts"] is None
    assert lic["customer"] == "client@example.com" and lic["expires"] == "2099-01-01"
    assert "advanced_channels" in lic["features"]

    # Date d'expiration illisible = clé invalide -> Community.
    bad = _make_key({"plan": "business", "expires": "31/12/2099"})
    monkeypatch.setattr(cfg, "LICENSE_KEY", bad)
    assert get_license()["plan"] == "community"
