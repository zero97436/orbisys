from app.models.check import Check
from app.services.alert_service import AlertService


def test_alert_records_event(client, db):
    host_id = client.post(
        "/api/hosts", json={"name": "ev-host", "hostname_or_ip": "10.0.0.150"}
    ).json()["id"]
    check_id = client.post(
        "/api/checks", json={"host_id": host_id, "name": "ev-check", "type": "ping"}
    ).json()["id"]

    AlertService(db).handle_status_change(db.get(Check, check_id), "CRITICAL", "OK", "down")

    events = client.get("/api/events").json()
    opened = [e for e in events if e["type"] == "alert_opened" and e["check_id"] == check_id]
    assert len(opened) == 1
    assert opened[0]["level"] == "critical"

    # Filtre par type.
    filtered = client.get("/api/events", params={"type": "alert_opened"}).json()
    assert all(e["type"] == "alert_opened" for e in filtered)


def test_acknowledge_records_event(client, db):
    from app.models.alert import Alert

    host_id = client.post("/api/hosts", json={"name": "ev2", "hostname_or_ip": "10.0.0.151"}).json()["id"]
    check_id = client.post("/api/checks", json={"host_id": host_id, "name": "c", "type": "ping"}).json()["id"]
    alert = Alert(check_id=check_id, status="CRITICAL", message="x", is_active=True)
    db.add(alert)
    db.commit()
    db.refresh(alert)

    client.post(f"/api/dashboard/incidents/{alert.id}/ack")
    events = client.get("/api/events", params={"type": "alert_acknowledged"}).json()
    assert any(e["check_id"] == check_id for e in events)



def test_events_filter_by_check(client, db):
    from app.services.event_service import EventService

    svc = EventService(db)
    svc.record("probe_evt", "pour le check 9101", check_id=9101, commit=False)
    svc.record("probe_evt", "pour le check 9102", check_id=9102, commit=False)
    db.commit()
    rows = client.get("/api/events", params={"check_id": 9101}).json()
    assert rows and all(r["check_id"] == 9101 for r in rows)
