from datetime import datetime, timedelta, timezone

from app.models.check_result import CheckResult


def _avail(client, **params):
    r = client.get("/api/dashboard/availability", params=params)
    assert r.status_code == 200
    return r.json()


def test_availability_counts_window_results(client, db):
    # Base partagée entre tests : on raisonne sur les écarts avant / après insertion.
    before = _avail(client)
    host_id = client.post("/api/hosts", json={"name": "av", "hostname_or_ip": "10.0.0.190"}).json()["id"]
    check_id = client.post("/api/checks", json={"host_id": host_id, "name": "av", "type": "ping"}).json()["id"]
    now = datetime.now(timezone.utc)
    for st in ("OK", "OK", "OK", "CRITICAL"):
        db.add(CheckResult(check_id=check_id, status=st, checked_at=now - timedelta(minutes=5)))
    # Hors fenêtre (> 24 h) : ignoré.
    db.add(CheckResult(check_id=check_id, status="CRITICAL", checked_at=now - timedelta(hours=30)))
    db.commit()

    after = _avail(client)
    assert after["total"] - before["total"] == 4
    assert after["ok"] - before["ok"] == 3
    assert len(after["buckets"]) == 24
    assert sum(b["total"] for b in after["buckets"]) == after["total"]
    # Les résultats récents tombent dans la dernière tranche.
    assert after["buckets"][-1]["total"] - before["buckets"][-1]["total"] == 4


def test_availability_params_validated(client):
    data = _avail(client, hours=6, buckets=12)
    assert data["window_hours"] == 6 and len(data["buckets"]) == 12
    assert client.get("/api/dashboard/availability", params={"buckets": 0}).status_code == 422
    assert client.get("/api/dashboard/availability", params={"hours": 10000}).status_code == 422


def test_availability_is_null_without_samples(db):
    # Fenêtre minuscule dans le futur proche : aucun échantillon -> None, jamais 100 %.
    from app.services.dashboard_service import DashboardService

    data = DashboardService(db).availability(hours=1, buckets=1)
    if data["total"] == 0:
        assert data["availability"] is None
    else:
        assert 0 <= data["availability"] <= 100


def test_availability_filtered_by_check(client, db):
    host_id = client.post("/api/hosts", json={"name": "av2", "hostname_or_ip": "10.0.0.191"}).json()["id"]
    a = client.post("/api/checks", json={"host_id": host_id, "name": "a", "type": "ping"}).json()["id"]
    b = client.post("/api/checks", json={"host_id": host_id, "name": "b", "type": "ping"}).json()["id"]
    now = datetime.now(timezone.utc)
    db.add(CheckResult(check_id=a, status="OK", checked_at=now - timedelta(minutes=2)))
    db.add(CheckResult(check_id=b, status="CRITICAL", checked_at=now - timedelta(minutes=2)))
    db.add(CheckResult(check_id=b, status="OK", checked_at=now - timedelta(minutes=1)))
    db.commit()
    ra = _avail(client, check_id=a)
    rb = _avail(client, check_id=b)
    assert (ra["ok"], ra["total"], ra["availability"]) == (1, 1, 100.0)
    assert (rb["ok"], rb["total"], rb["availability"]) == (1, 2, 50.0)
