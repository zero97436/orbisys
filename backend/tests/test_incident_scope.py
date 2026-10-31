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
