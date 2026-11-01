"""Cloisonnement tenant des actions sur incident : un utilisateur rattaché à un tenant
ne peut ni analyser ni remédier un incident d'un hôte d'un autre tenant (404)."""
from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.main import app
from app.models.alert import Alert
from app.models.check import Check
from app.models.host import Host
from app.models.tenant import Tenant
from app.models.user import User


def _scoped_client(db, email: str, tenant_id: int) -> TestClient:
    if not db.query(User).filter_by(email=email).first():
        db.add(User(email=email, hashed_password=hash_password("pw-scope-123"), is_active=True,
                    is_admin=False, role="operator", tenant_id=tenant_id))
        db.commit()
    c = TestClient(app)
    token = c.post("/api/auth/login", json={"email": email, "password": "pw-scope-123"}).json()["access_token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


def _foreign_alert(db) -> tuple[int, int, int]:
    mine = Tenant(name="Client A", slug="scope-a")
    other = Tenant(name="Client B", slug="scope-b")
    db.add_all([mine, other])
    db.commit()
    host = Host(name="b-srv", hostname_or_ip="10.9.9.9", environment="production", tenant_id=other.id)
    db.add(host)
    db.commit()
    check = Check(host_id=host.id, name="ping", type="ping")
    db.add(check)
    db.commit()
    alert = Alert(check_id=check.id, status="CRITICAL", message="down", is_active=True)
    db.add(alert)
    db.commit()
    return mine.id, other.id, alert.id


def test_scoped_user_cannot_touch_other_tenant_incident(db):
    mine, _, alert_id = _foreign_alert(db)
    c = _scoped_client(db, "op-scope@local", mine)
    assert c.post(f"/api/dashboard/incidents/{alert_id}/ack").status_code == 404
    assert c.post(f"/api/dashboard/incidents/{alert_id}/analyze").status_code == 404
    r = c.post(f"/api/dashboard/incidents/{alert_id}/remediate", json={"action": "rerun_check"})
    assert r.status_code == 404


def test_ai_summary_only_sees_own_tenant(db, monkeypatch):
    """Le résumé IA d'un utilisateur cloisonné ne contient que les hôtes de son tenant."""
    from app.services.ai_service import AIService

    mine = Tenant(name="Client C", slug="scope-c")
    other = Tenant(name="Client D", slug="scope-d")
    db.add_all([mine, other])
    db.commit()
    h_mine = Host(name="c-visible-srv", hostname_or_ip="10.9.9.10", environment="production", tenant_id=mine.id)
    h_other = Host(name="d-secret-srv", hostname_or_ip="10.9.9.11", environment="production", tenant_id=other.id)
    db.add_all([h_mine, h_other])
    db.commit()
    for h in (h_mine, h_other):
        ck = Check(host_id=h.id, name="ping", type="ping", last_status="CRITICAL")
        db.add(ck)
        db.commit()
        db.add(Alert(check_id=ck.id, status="CRITICAL", message="down", is_active=True))
        db.commit()

    sent = {}
    monkeypatch.setattr(AIService, "_chat", lambda self, system, user: sent.setdefault("ctx", user) or "ok")
    c = _scoped_client(db, "op-scope-ai@local", mine.id)
    assert c.post("/api/dashboard/ai-summary").status_code == 200
    assert "c-visible-srv" in sent["ctx"]
    assert "d-secret-srv" not in sent["ctx"]



def test_ai_chat_and_plan_stay_in_tenant(db, monkeypatch):
    """Le contexte du chat IA et l'application d'un plan respectent le périmètre tenant."""
    from app.services.ai_service import AIService

    mine = Tenant(name="Client E", slug="scope-e")
    other = Tenant(name="Client F", slug="scope-f")
    db.add_all([mine, other])
    db.commit()
    h_mine = Host(name="e-visible-srv", hostname_or_ip="10.9.9.20", environment="production", tenant_id=mine.id)
    h_other = Host(name="f-secret-srv", hostname_or_ip="10.9.9.21", environment="production", tenant_id=other.id)
    db.add_all([h_mine, h_other])
    db.commit()
    other_id = h_other.id

    sent = {}
    monkeypatch.setattr(AIService, "_chat_messages", lambda self, msgs: sent.setdefault("sys", msgs[0]["content"]) and "ok")
    c = _scoped_client(db, "op-scope-chat@local", mine.id)
    assert c.post("/api/ai/chat", json={"question": "état ?", "history": []}).status_code == 200
    assert "e-visible-srv" in sent["sys"]
    assert "f-secret-srv" not in sent["sys"]

    r = c.post("/api/ai/apply-plan", json={"operations": [{"op": "delete_host", "host_id": other_id}]}).json()
    assert r["applied"] == 0 and r["results"][0]["status"] == "skipped"
    db.expire_all()
    assert db.get(Host, other_id) is not None
