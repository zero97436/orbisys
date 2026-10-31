"""Analyse d'incidents par IA locale (Ollama).

Construit un contexte factuel à partir des données réelles (incident, check, hôte,
dernières métriques et résultats) puis demande à un modèle local une analyse :
cause probable, impact, actions de remédiation. Tout reste en local — aucune donnée
ne sort de la machine.
"""
from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.alert import Alert
from app.models.check import Check
from app.models.check_result import CheckResult
from app.models.host import Host
from app.repositories.metric_repo import MetricRepository

logger = get_logger(__name__)

SYSTEM_PROMPT = (
    "Tu es un ingénieur SRE/NOC expert en supervision d'infrastructure. "
    "On te fournit le contexte factuel d'un incident détecté par une plateforme de "
    "supervision. Réponds en français, de façon concise et actionnable, structurée en "
    "trois sections Markdown : '## Cause probable', '## Impact', '## Actions recommandées' "
    "(liste à puces). Base-toi UNIQUEMENT sur les données fournies ; si une information "
    "manque, dis-le explicitement plutôt que d'inventer."
)


SUMMARY_PROMPT = (
    "Tu es un ingénieur NOC qui rédige le point de situation de supervision pour la prise "
    "de poste. À partir de l'état fourni, écris en français un résumé court et lisible : "
    "1 phrase d'état global, puis 3 à 6 puces priorisant le critique, les hôtes/services à "
    "surveiller et les tendances. Reste factuel ; n'invente rien."
)


CHAT_PROMPT = (
    "Tu es l'assistant d'une plateforme de supervision (NOC). Tu réponds en français, "
    "de façon concise et précise, en t'appuyant UNIQUEMENT sur l'état courant fourni "
    "ci-dessous. Si la réponse n'est pas dans les données, dis-le clairement. N'invente "
    "ni hôte, ni valeur, ni incident.\n\n"
    "CAPACITÉ SPÉCIALE — modifier la configuration : si l'utilisateur demande de CRÉER, "
    "AJOUTER, MODIFIER ou SUPPRIMER des hôtes/checks, ne réponds PAS en texte libre. Renvoie "
    "UNIQUEMENT un bloc JSON encadré par <PLAN> et </PLAN> contenant une liste d'opérations :\n"
    '<PLAN>{{"operations": [\n'
    '  {{"op": "create_host", "host": {{"name": "...", "hostname_or_ip": "IP/DNS", "environment": "production"}}, "checks": [{{"name": "Ping", "type": "ping"}}]}},\n'
    '  {{"op": "update_check", "check_id": 12, "changes": {{"warning_threshold": 70}}}},\n'
    '  {{"op": "update_host", "host_id": 3, "changes": {{"environment": "prod"}}}},\n'
    '  {{"op": "delete_check", "check_id": 9}},\n'
    '  {{"op": "delete_host", "host_id": 4}}\n'
    "]}}</PLAN>\n"
    "Règles : utilise les host_id / check_id EXACTS de l'état ci-dessous pour modifier/supprimer "
    "(ne devine jamais un id ; si l'élément n'existe pas, dis-le en texte normal). Types de checks "
    'autorisés : ping, tcp_port (config {{"port":N}}), http (config {{"url":"..."}}), ssl_expiry '
    '(config {{"port":443}}), snmp (config {{"metric":"cpu"}}). N\'invente pas d\'IP. Tu peux mettre '
    "plusieurs opérations (ex. créer plusieurs hôtes).\n\n"
    "# État courant de la plateforme\n{snapshot}"
)


_LANG_DIRECTIVE = {
    "fr": "\n\nIMPORTANT : rédige TOUTE ta réponse en français.",
    "en": "\n\nIMPORTANT: write your ENTIRE answer in English.",
}


def _lang_directive(lang: str) -> str:
    return _LANG_DIRECTIVE.get(lang, _LANG_DIRECTIVE["fr"])


class OllamaError(RuntimeError):
    pass


class AIService:
    def __init__(self, db: Session):
        self.db = db

    def analyze_incident(self, alert_id: int, lang: str = "fr") -> dict | None:
        from app.services.remediation_service import RemediationService

        alert = self.db.get(Alert, alert_id)
        if not alert:
            return None
        check = self.db.get(Check, alert.check_id)
        host = self.db.get(Host, check.host_id) if check else None
        context = self._build_context(alert, check, host)

        remediation = RemediationService(self.db)
        available = remediation.available()
        allowed_ids = [a["id"] for a in available]
        labels = {a["id"]: a["label"] for a in available}
        catalogue = "\n".join(f"  - {a['id']} : {a['label']}" for a in available)
        context += (
            "\n\n# Actions de remédiation autorisées\n" + catalogue +
            "\n\nRÈGLES DE FORMAT STRICTES :\n"
            "- Dans les 3 sections, écris en langage naturel UNIQUEMENT ; "
            "n'écris JAMAIS d'identifiant technique (ex. rerun_check, escalate…) dans le texte.\n"
            "- Ajoute tout à la fin une seule ligne isolée, exactement : `ACTION: <id>` "
            f"en choisissant l'id le plus pertinent parmi {allowed_ids}."
        )

        raw = self._chat(SYSTEM_PROMPT + _lang_directive(lang), context)
        analysis, suggested = self._extract_action(raw, allowed_ids, labels)
        if suggested is None:
            suggested = remediation.suggest(alert)
        return {
            "analysis": analysis,
            "model": settings.OLLAMA_MODEL,
            "suggested_action": suggested,
            "available_actions": available,
        }

    @staticmethod
    def _extract_action(
        text: str, allowed: list[str], labels: dict[str, str] | None = None
    ) -> tuple[str, str | None]:
        """Extrait la ligne 'ACTION: <id>', la retire, et nettoie les ids techniques
        qui auraient fui dans le texte lisible (ex. '… : rerun_check')."""
        import re

        labels = labels or {}
        suggested: str | None = None
        kept: list[str] = []
        ids_alt = "|".join(re.escape(i) for i in allowed)

        for line in text.splitlines():
            m = re.match(r"\s*ACTION\s*:\s*([a-z_]+)\s*$", line, re.IGNORECASE)
            if m and m.group(1) in allowed:
                suggested = m.group(1)
                continue
            # Mémorise un id éventuellement cité dans le texte (repli de suggestion).
            if suggested is None:
                inline = re.search(rf"\b({ids_alt})\b", line)
                if inline:
                    suggested = inline.group(1)
            # Retire un id en fin de ligne, avec un éventuel séparateur (": ", "- ", "(").
            line = re.sub(rf"\s*[:\-(]?\s*\b(?:{ids_alt})\b\)?\s*$", "", line)
            # Remplace toute occurrence résiduelle par son libellé lisible.
            line = re.sub(rf"\b({ids_alt})\b", lambda mm: labels.get(mm.group(1), ""), line)
            kept.append(line.rstrip())

        return "\n".join(kept).strip(), suggested

    def chat(self, question: str, history: list[dict] | None = None, lang: str = "fr", user=None) -> dict:
        """`user` : le contexte envoyé au modèle ne contient que son périmètre tenant."""
        snapshot = self._state_snapshot(user)
        system = CHAT_PROMPT.format(snapshot=snapshot)

        # RAG : injecte les passages pertinents de la base de connaissances.
        sources: list[dict] = []
        try:
            from app.services.rag_service import RagService

            context, sources = RagService(self.db).context_for(question)
            if context:
                system += (
                    "\n\n# Base de connaissances (runbooks/procédures internes)\n"
                    "Appuie-toi sur ces extraits s'ils sont pertinents et cite le titre "
                    "du document utilisé.\n" + context
                )
        except Exception as exc:  # noqa: BLE001 — le RAG ne doit jamais casser le chat
            logger.debug("RAG ignoré : %s", exc)

        system += _lang_directive(lang)
        messages = [{"role": "system", "content": system}]
        for msg in (history or [])[-6:]:
            role = msg.get("role")
            content = msg.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": question})
        answer = self._chat_messages(messages)
        text, plan = self._extract_plan(answer)
        return {"answer": text, "model": settings.OLLAMA_MODEL, "plan": plan, "sources": sources}

    # Types de checks que l'assistant peut proposer (liste blanche).
    _PLAN_CHECK_TYPES = {
        "ping", "tcp_port", "http", "ssl_expiry", "snmp",
        "dns", "ssh", "smtp", "ftp",
    }

    _CHECK_CHANGE_KEYS = {
        "name", "warning_threshold", "critical_threshold",
        "interval_seconds", "timeout_seconds", "config_json", "is_active",
    }
    _HOST_CHANGE_KEYS = {"name", "hostname_or_ip", "environment", "is_active"}

    def _extract_plan(self, text: str) -> tuple[str, dict | None]:
        """Extrait/valide un bloc <PLAN>{operations:[...]}</PLAN> (créer/modifier/supprimer)."""
        import json
        import re

        m = re.search(r"<PLAN>\s*(\{.*\})\s*</PLAN>", text, re.DOTALL)
        if not m:
            return text.strip(), None
        try:
            raw = json.loads(m.group(1))
        except json.JSONDecodeError:
            return text.replace(m.group(0), "").strip(), None

        # Compat ascendante : ancien format {host, checks} -> une opération create_host.
        raw_ops = raw.get("operations")
        if raw_ops is None and raw.get("host"):
            raw_ops = [{"op": "create_host", "host": raw["host"], "checks": raw.get("checks", [])}]

        ops: list[dict] = []
        for o in raw_ops or []:
            norm = self._normalize_op(o)
            if norm:
                ops.append(norm)

        if not ops:
            return (text.replace(m.group(0), "").strip() or
                    "Je n'ai pas pu construire d'opération valide (id manquant ou inexistant ?)."), None

        msg = f"Je propose {len(ops)} opération(s). Vérifie puis valide."
        return msg, {"operations": ops}

    def _normalize_op(self, o: dict) -> dict | None:
        from app.models.check import Check
        from app.models.host import Host

        op = o.get("op")
        if op == "create_host":
            host = o.get("host") or {}
            name = (host.get("name") or "").strip()
            addr = (host.get("hostname_or_ip") or "").strip()
            if not name or not addr:
                return None
            checks = []
            for c in o.get("checks") or []:
                if c.get("type") not in self._PLAN_CHECK_TYPES:
                    continue
                checks.append({
                    "name": (c.get("name") or c["type"]).strip()[:255],
                    "type": c["type"],
                    "config_json": c.get("config_json") or {},
                    "interval_seconds": int(c.get("interval_seconds", 60)),
                    "timeout_seconds": int(c.get("timeout_seconds", 10)),
                })
            return {
                "op": "create_host", "destructive": False,
                "host": {"name": name[:255], "hostname_or_ip": addr[:255],
                         "environment": (host.get("environment") or "production").strip()[:64]},
                "checks": checks,
                "description": f"Créer l'hôte « {name} » ({addr}) avec {len(checks)} check(s)",
            }
        if op in ("update_check", "delete_check"):
            cid = o.get("check_id")
            chk = self.db.get(Check, cid) if isinstance(cid, int) else None
            if not chk:
                return None
            if op == "delete_check":
                return {"op": "delete_check", "destructive": True, "check_id": cid,
                        "description": f"Supprimer le check « {chk.name} » (host #{chk.host_id})"}
            changes = {k: v for k, v in (o.get("changes") or {}).items() if k in self._CHECK_CHANGE_KEYS}
            if not changes:
                return None
            return {"op": "update_check", "destructive": False, "check_id": cid, "changes": changes,
                    "description": f"Modifier le check « {chk.name} » : {changes}"}
        if op in ("update_host", "delete_host"):
            hid = o.get("host_id")
            host = self.db.get(Host, hid) if isinstance(hid, int) else None
            if not host:
                return None
            if op == "delete_host":
                return {"op": "delete_host", "destructive": True, "host_id": hid,
                        "description": f"Supprimer l'hôte « {host.name} » et tous ses checks"}
            changes = {k: v for k, v in (o.get("changes") or {}).items() if k in self._HOST_CHANGE_KEYS}
            if not changes:
                return None
            return {"op": "update_host", "destructive": False, "host_id": hid, "changes": changes,
                    "description": f"Modifier l'hôte « {host.name} » : {changes}"}
        return None

    def apply_plan(self, plan: dict, user=None) -> dict:
        """Exécute les opérations validées (après accord humain). Revalide côté serveur,
        y compris le périmètre tenant de `user` : une opération hors périmètre est ignorée."""
        from app.core.tenancy import host_visible, is_scoped
        from app.models.check import Check
        from app.models.host import Host
        from app.repositories.check_repo import CheckRepository
        from app.repositories.host_repo import HostRepository

        host_repo = HostRepository(self.db)
        check_repo = CheckRepository(self.db)
        results: list[dict] = []

        for o in plan.get("operations") or []:
            norm = self._normalize_op(o)  # revalidation
            if not norm:
                results.append({"op": o.get("op"), "status": "skipped", "detail": "opération invalide"})
                continue
            op = norm["op"]
            if user is not None and op != "create_host":
                target = None
                if op in ("update_check", "delete_check"):
                    chk = check_repo.get(norm["check_id"])
                    target = self.db.get(Host, chk.host_id) if chk else None
                else:
                    target = self.db.get(Host, norm["host_id"])
                if not host_visible(user, target):
                    results.append({"op": op, "status": "skipped", "detail": "hors périmètre"})
                    continue
            try:
                if op == "create_host":
                    extra = {"tenant_id": user.tenant_id} if user is not None and is_scoped(user) else {}
                    host = host_repo.create(
                        name=norm["host"]["name"], hostname_or_ip=norm["host"]["hostname_or_ip"],
                        environment=norm["host"]["environment"], description="Créé via l'assistant IA",
                        **extra,
                    )
                    for c in norm["checks"]:
                        check_repo.create(host_id=host.id, name=c["name"], type=c["type"],
                                          interval_seconds=c["interval_seconds"],
                                          timeout_seconds=c["timeout_seconds"], config_json=c["config_json"])
                    results.append({"op": op, "status": "done", "detail": norm["description"], "host_id": host.id})
                elif op == "update_check":
                    chk = check_repo.get(norm["check_id"])
                    check_repo.update(chk, **norm["changes"])
                    results.append({"op": op, "status": "done", "detail": norm["description"]})
                elif op == "delete_check":
                    chk = check_repo.get(norm["check_id"])
                    check_repo.delete(chk)
                    results.append({"op": op, "status": "done", "detail": norm["description"]})
                elif op == "update_host":
                    host = self.db.get(Host, norm["host_id"])
                    for k, v in norm["changes"].items():
                        setattr(host, k, v)
                    self.db.commit()
                    results.append({"op": op, "status": "done", "detail": norm["description"]})
                elif op == "delete_host":
                    host = self.db.get(Host, norm["host_id"])
                    self.db.delete(host)
                    self.db.commit()
                    results.append({"op": op, "status": "done", "detail": norm["description"]})
            except Exception as exc:  # noqa: BLE001
                self.db.rollback()
                results.append({"op": op, "status": "failed", "detail": str(exc)})

        done = sum(1 for r in results if r["status"] == "done")
        return {"applied": done, "total": len(results), "results": results}

    def _state_snapshot(self, user=None) -> str:
        from app.core.tenancy import visible_host_ids
        from app.repositories.check_repo import CheckRepository
        from app.repositories.host_repo import HostRepository
        from app.services.dashboard_service import DashboardService

        hosts = HostRepository(self.db).list()
        checks = CheckRepository(self.db).list()
        allowed = visible_host_ids(self.db, user) if user is not None else None
        if allowed is not None:
            hosts = [h for h in hosts if h.id in allowed]
            checks = [c for c in checks if c.host_id in allowed]
        by_host: dict[int, list[Check]] = {}
        for c in checks:
            by_host.setdefault(c.host_id, []).append(c)

        severity = {"CRITICAL": 0, "WARNING": 1, "UNKNOWN": 2, "OK": 3}
        lines: list[str] = ["## Hôtes (host_id, nom)"]
        metric_repo = MetricRepository(self.db)
        for host in hosts:
            hc = by_host.get(host.id, [])
            worst = min((c.last_status or "UNKNOWN" for c in hc), key=lambda s: severity.get(s, 2), default="UNKNOWN")
            m = metric_repo.latest(host.id)
            metric_str = ""
            if m:
                metric_str = f" | CPU {m.cpu_percent}% RAM {m.mem_percent}% Disque {m.disk_percent}%"
            lines.append(
                f"- host_id={host.id} : {host.name} ({host.hostname_or_ip}, {host.environment}) : "
                f"{worst}, {len(hc)} check(s){metric_str}"
            )

        lines.append("\n## Checks (check_id, nom)")
        for c in checks:
            thr = f" warn={c.warning_threshold} crit={c.critical_threshold}"
            lines.append(
                f"- check_id={c.id} (host_id={c.host_id}) : {c.name} [{c.type}] : "
                f"{c.last_status or 'UNKNOWN'}{thr}"
            )

        incidents = DashboardService(self.db, user).incidents()
        lines.append(f"\n## Incidents actifs ({len(incidents)})")
        for inc in incidents[:20]:
            ack = " [acquitté]" if inc.get("acknowledged") else ""
            lines.append(f"- {inc['status']} | {inc['host_name']} / {inc['check_name']} | {inc.get('message') or ''}{ack}")

        return "\n".join(lines)

    def health_summary(self, lang: str = "fr", user=None) -> dict:
        """Résumé santé. `user` : périmètre tenant appliqué (None = vue globale)."""
        from app.services.dashboard_service import DashboardService

        svc = DashboardService(self.db, user)
        summary = svc.summary()
        incidents = svc.incidents()
        counts = summary["status_counts"]
        lines = [
            "# État global",
            f"- Hôtes: {summary['hosts_total']} | Checks: {summary['checks_total']}",
            f"- Statuts: OK={counts.get('OK', 0)} WARNING={counts.get('WARNING', 0)} "
            f"CRITICAL={counts.get('CRITICAL', 0)} UNKNOWN={counts.get('UNKNOWN', 0)}",
            f"- Incidents actifs: {len(incidents)}",
        ]
        if incidents:
            lines.append("\n# Incidents actifs")
            for inc in incidents[:15]:
                ack = " [acquitté]" if inc.get("acknowledged") else ""
                lines.append(
                    f"- {inc['status']} | {inc['host_name']} / {inc['check_name']} | "
                    f"{inc.get('message') or ''}{ack}"
                )
        analysis = self._chat(SUMMARY_PROMPT, "\n".join(lines))
        return {"summary": analysis, "model": settings.OLLAMA_MODEL}

    def _build_context(self, alert: Alert, check: Check | None, host: Host | None) -> str:
        lines: list[str] = ["# Incident", f"- Statut: {alert.status}", f"- Message: {alert.message or '—'}"]
        if host:
            lines += [
                "\n# Hôte",
                f"- Nom: {host.name}",
                f"- Adresse: {host.hostname_or_ip}",
                f"- Environnement: {host.environment}",
            ]
        if check:
            lines += [
                "\n# Check",
                f"- Nom: {check.name}",
                f"- Type: {check.type}",
                f"- Seuils: warning={check.warning_threshold}, critical={check.critical_threshold}",
                f"- Intervalle: {check.interval_seconds}s",
            ]
            # Derniers résultats
            results = self.db.scalars(
                select(CheckResult)
                .where(CheckResult.check_id == check.id)
                .order_by(CheckResult.checked_at.desc())
                .limit(8)
            ).all()
            if results:
                lines.append("\n# Derniers résultats (récent -> ancien)")
                for r in results:
                    lines.append(
                        f"- {r.checked_at:%Y-%m-%d %H:%M} | {r.status} | "
                        f"valeur={r.value} | {r.message or ''} | perf={r.perfdata}"
                    )
        if host:
            metric = MetricRepository(self.db).latest(host.id)
            if metric:
                lines += [
                    "\n# Dernières métriques système de l'hôte",
                    f"- CPU: {metric.cpu_percent}%  RAM: {metric.mem_percent}%  "
                    f"Disque: {metric.disk_percent}%  Réseau: {metric.net_mbps} Mb/s",
                ]
                if metric.disks:
                    lines.append(f"- Disques: {metric.disks}")
        return "\n".join(lines)

    def _chat(self, system: str, user: str) -> str:
        return self._chat_messages(
            [{"role": "system", "content": system}, {"role": "user", "content": user}]
        )

    def _chat_messages(self, messages: list[dict]) -> str:
        url = f"{settings.OLLAMA_BASE_URL}/api/chat"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.2},
        }
        try:
            resp = httpx.post(url, json=payload, timeout=settings.OLLAMA_TIMEOUT_SECONDS)
            resp.raise_for_status()
            data = resp.json()
            return (data.get("message") or {}).get("content", "").strip() or "(réponse vide)"
        except httpx.HTTPStatusError as exc:
            logger.error("Ollama HTTP error: %s", exc)
            raise OllamaError(f"Ollama a renvoyé {exc.response.status_code}") from exc
        except Exception as exc:  # noqa: BLE001
            logger.error("Ollama unreachable: %s", exc)
            raise OllamaError(
                "Modèle IA injoignable. Vérifie qu'Ollama tourne et que "
                f"OLLAMA_BASE_URL ({settings.OLLAMA_BASE_URL}) est correct."
            ) from exc
