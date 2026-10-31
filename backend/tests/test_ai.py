from app.models.alert import Alert
from app.services.ai_service import AIService


def _make_alert(client, db) -> int:
    host_id = client.post(
        "/api/hosts", json={"name": "ai-host", "hostname_or_ip": "10.0.0.60"}
    ).json()["id"]
    check_id = client.post(
        "/api/checks",
        json={"host_id": host_id, "name": "ai-check", "type": "ping"},
    ).json()["id"]
    alert = Alert(check_id=check_id, status="CRITICAL", message="host down", is_active=True)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert.id


def test_context_builder(client, db):
    alert_id = _make_alert(client, db)
    alert = db.get(Alert, alert_id)
    from app.models.check import Check
    from app.models.host import Host

    check = db.get(Check, alert.check_id)
    host = db.get(Host, check.host_id)
    ctx = AIService(db)._build_context(alert, check, host)
    assert "CRITICAL" in ctx
    assert "ai-host" in ctx
    assert "ai-check" in ctx


def test_analyze_returns_503_when_ai_unreachable(client, db):
    # OLLAMA_BASE_URL pointe vers une adresse injoignable (conftest).
    alert_id = _make_alert(client, db)
    resp = client.post(f"/api/dashboard/incidents/{alert_id}/analyze")
    assert resp.status_code == 503


def test_analyze_404_for_missing_alert(client):
    assert client.post("/api/dashboard/incidents/99999/analyze").status_code == 404


def test_ai_summary_503_when_unreachable(client):
    # IA injoignable en test -> 503 propre.
    assert client.post("/api/dashboard/ai-summary").status_code == 503


def test_chat_snapshot_builder(client, db):
    client.post("/api/hosts", json={"name": "chat-host", "hostname_or_ip": "10.0.0.70"})
    snap = AIService(db)._state_snapshot()
    assert "## Hôtes" in snap
    assert "chat-host" in snap


def test_chat_503_when_unreachable(client):
    resp = client.post("/api/ai/chat", json={"question": "Quel hôte va mal ?"})
    assert resp.status_code == 503


def test_chat_validation(client):
    assert client.post("/api/ai/chat", json={"question": ""}).status_code == 422


def test_extract_plan_create_validates_and_filters(db):
    svc = AIService(db)
    raw = (
        "Voici le plan <PLAN>{\"operations\":[{\"op\":\"create_host\",\"host\": "
        "{\"name\": \"NAS\", \"hostname_or_ip\": \"192.168.1.50\"}, "
        "\"checks\": [{\"name\": \"Ping\", \"type\": \"ping\"}, {\"name\": \"X\", \"type\": \"hack\"}]}]}</PLAN>"
    )
    text, plan = svc._extract_plan(raw)
    assert plan is not None
    op = plan["operations"][0]
    assert op["op"] == "create_host"
    assert op["host"]["name"] == "NAS"
    assert [c["type"] for c in op["checks"]] == ["ping"]  # type non autorisé filtré
    assert "<PLAN>" not in text


def test_apply_plan_create_then_delete(client, db):
    create = {"operations": [{"op": "create_host",
              "host": {"name": "NAS-IA", "hostname_or_ip": "192.168.1.51", "environment": "reseau"},
              "checks": [{"name": "Ping", "type": "ping"}, {"name": "HTTP", "type": "http"}]}]}
    resp = client.post("/api/ai/apply-plan", json=create)
    assert resp.status_code == 200
    body = resp.json()
    assert body["applied"] == 1
    host_id = body["results"][0]["host_id"]
    assert any(h["id"] == host_id for h in client.get("/api/hosts").json())

    # Suppression via opération.
    resp2 = client.post("/api/ai/apply-plan", json={"operations": [{"op": "delete_host", "host_id": host_id}]})
    assert resp2.status_code == 200
    assert resp2.json()["applied"] == 1
    assert not any(h["id"] == host_id for h in client.get("/api/hosts").json())


def test_apply_plan_update_check(client, db):
    host_id = client.post("/api/hosts", json={"name": "uh", "hostname_or_ip": "10.0.0.130"}).json()["id"]
    check_id = client.post("/api/checks", json={"host_id": host_id, "name": "c", "type": "metric",
                           "warning_threshold": 80, "config_json": {"metric": "cpu_percent"}}).json()["id"]
    resp = client.post("/api/ai/apply-plan", json={"operations": [
        {"op": "update_check", "check_id": check_id, "changes": {"warning_threshold": 70}}]})
    assert resp.status_code == 200
    assert client.get(f"/api/checks/{check_id}").json()["warning_threshold"] == 70


def test_extract_plan_rejects_unknown_id(db):
    svc = AIService(db)
    raw = "<PLAN>{\"operations\":[{\"op\":\"delete_host\",\"host_id\":999999}]}</PLAN>"
    _text, plan = svc._extract_plan(raw)
    assert plan is None  # id inexistant -> opération rejetée


def test_extract_action_cleans_inline_id():
    allowed = ["rerun_check", "escalate"]
    labels = {"rerun_check": "Relancer le check", "escalate": "Escalader"}
    raw = (
        "## Actions recommandées\n"
        "* Relancer le check pour confirmer : rerun_check"
    )
    text, suggested = AIService._extract_action(raw, allowed, labels)
    assert suggested == "rerun_check"
    assert "rerun_check" not in text  # l'id technique ne fuit plus

    # Cas propre avec ligne ACTION dédiée.
    raw2 = "Analyse...\nACTION: escalate"
    text2, suggested2 = AIService._extract_action(raw2, allowed, labels)
    assert suggested2 == "escalate"
    assert "ACTION" not in text2 and "escalate" not in text2



def test_ai_status_reports_availability(client, monkeypatch):
    import httpx

    from app.core.config import settings

    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"models": [{"name": f"{settings.OLLAMA_MODEL}:latest"}]}

    monkeypatch.setattr(httpx, "get", lambda *a, **k: _Resp())
    data = client.get("/api/ai/status").json()
    assert data == {"available": True, "model": settings.OLLAMA_MODEL, "model_installed": True}

    def _down(*a, **k):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(httpx, "get", _down)
    data = client.get("/api/ai/status").json()
    assert data["available"] is False and data["model_installed"] is False
    assert "OLLAMA_BASE_URL" not in str(data) and "http" not in str(data)
