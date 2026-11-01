from app.checks.base import CheckContext
from app.checks.registry import get_check


def test_windows_service_registered_and_central_unknown():
    chk = get_check("windows_service")
    assert chk is not None
    ctx = CheckContext(
        hostname_or_ip="10.0.0.1", timeout_seconds=1,
        warning_threshold=None, critical_threshold=None, config={"service": "Spooler"},
    )
    # Exécution centrale -> UNKNOWN (doit passer par l'agent).
    assert chk.run(ctx).status.value == "UNKNOWN"


def test_sms_channel_secret_redacted(client):
    ch = client.post("/api/settings/notification-channels", json={
        "name": "sms-astreinte", "type": "sms",
        "config_json": {"account_sid": "AC1", "auth_token": "TOK", "from": "+1", "to": "+2"},
    })
    assert ch.status_code == 201
    chans = client.get("/api/settings/notification-channels").json()
    sms = next(c for c in chans if c["name"] == "sms-astreinte")
    assert sms["config_json"]["auth_token"] == "********"  # secret masqué
    assert sms["config_json"]["from"] == "+1"               # non secret



def test_delete_channel(client):
    ch = client.post("/api/settings/notification-channels", json={
        "name": "a-supprimer", "type": "webhook", "config_json": {"url": "https://exemple.invalid/hook"},
    }).json()
    assert client.delete(f"/api/settings/notification-channels/{ch['id']}").status_code == 204
    names = [c["name"] for c in client.get("/api/settings/notification-channels").json()]
    assert "a-supprimer" not in names
    assert client.delete(f"/api/settings/notification-channels/{ch['id']}").status_code == 404


def test_delete_channel_requires_admin(client, db):
    from fastapi.testclient import TestClient
    from app.core.security import hash_password
    from app.main import app
    from app.models.user import User

    ch = client.post("/api/settings/notification-channels", json={
        "name": "protege", "type": "webhook", "config_json": {"url": "https://exemple.invalid/hook"},
    }).json()
    if not db.query(User).filter_by(email="viewer-ch@local").first():
        db.add(User(email="viewer-ch@local", hashed_password=hash_password("pw-viewer-123"), is_active=True, is_admin=False, role="viewer"))
        db.commit()
    v = TestClient(app)
    tok = v.post("/api/auth/login", json={"email": "viewer-ch@local", "password": "pw-viewer-123"}).json()["access_token"]
    v.headers.update({"Authorization": f"Bearer {tok}"})
    assert v.delete(f"/api/settings/notification-channels/{ch['id']}").status_code == 403
