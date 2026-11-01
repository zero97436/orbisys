"""Agrégations pour le dashboard."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.check import Check
from app.models.check_result import CheckResult
from app.models.enums import CheckStatus
from app.models.host import Host


class DashboardService:
    def __init__(self, db: Session, user=None):
        self.db = db
        self.user = user  # pour le cloisonnement multi-tenant (None = pas de filtre)

    def _allowed(self) -> set[int] | None:
        if self.user is None:
            return None
        from app.core.tenancy import visible_host_ids

        return visible_host_ids(self.db, self.user)

    def summary(self) -> dict:
        allowed = self._allowed()
        host_q = select(func.count(Host.id))
        check_q = select(func.count(Check.id))
        rows_q = select(Check.last_status, func.count(Check.id)).group_by(Check.last_status)
        if allowed is not None:
            host_q = host_q.where(Host.id.in_(allowed))
            check_q = check_q.where(Check.host_id.in_(allowed))
            rows_q = rows_q.where(Check.host_id.in_(allowed))

        hosts_total = self.db.scalar(host_q) or 0
        checks_total = self.db.scalar(check_q) or 0
        counts = {s.value: 0 for s in CheckStatus}
        for status, count in self.db.execute(rows_q).all():
            key = status or CheckStatus.UNKNOWN.value
            counts[key] = counts.get(key, 0) + count

        return {
            "hosts_total": hosts_total,
            "checks_total": checks_total,
            "status_counts": counts,
        }

    def availability(self, hours: int = 24, buckets: int = 24, check_id: int | None = None) -> dict:
        """Disponibilité réelle sur une fenêtre : % de résultats OK, global et par tranche.

        Même formule que l'affichage historique (résultats OK / résultats), mais calculée
        sur TOUS les résultats de la fenêtre et de tous les checks visibles, en base
        (comptages agrégés, sans charger les lignes). Tranche sans résultat : total = 0
        (le client affiche « pas de données », jamais 100 % par défaut).
        """
        allowed = self._allowed()
        now = datetime.now(timezone.utc)
        start = now - timedelta(hours=hours)
        step = (now - start) / buckets
        out = []
        ok_all = total_all = 0
        for i in range(buckets):
            b_start = start + step * i
            b_end = now if i == buckets - 1 else start + step * (i + 1)
            last = i == buckets - 1
            end_cond = CheckResult.checked_at <= b_end if last else CheckResult.checked_at < b_end
            q = (
                select(CheckResult.status, func.count(CheckResult.id))
                .where(CheckResult.checked_at >= b_start, end_cond)
                .group_by(CheckResult.status)
            )
            if check_id is not None:
                q = q.where(CheckResult.check_id == check_id)
            if allowed is not None:
                q = q.join(Check, Check.id == CheckResult.check_id).where(Check.host_id.in_(allowed))
            ok = total = 0
            for status, count in self.db.execute(q).all():
                total += count
                if status == CheckStatus.OK.value:
                    ok += count
            ok_all += ok
            total_all += total
            out.append({"start": b_start, "end": b_end, "ok": ok, "total": total})
        return {
            "window_hours": hours,
            "check_id": check_id,
            "ok": ok_all,
            "total": total_all,
            "availability": round(ok_all * 100 / total_all, 2) if total_all else None,
            "buckets": out,
        }

    def incidents(self) -> list[dict]:
        allowed = self._allowed()
        stmt = (
            select(Alert, Check, Host)
            .join(Check, Alert.check_id == Check.id)
            .join(Host, Check.host_id == Host.id)
            .where(Alert.is_active.is_(True))
            .order_by(Alert.created_at.desc())
        )
        if allowed is not None:
            stmt = stmt.where(Host.id.in_(allowed))
        out = []
        for alert, check, host in self.db.execute(stmt).all():
            out.append(
                {
                    "alert_id": alert.id,
                    "check_id": check.id,
                    "check_name": check.name,
                    "host_id": host.id,
                    "host_name": host.name,
                    "status": alert.status,
                    "message": alert.message,
                    "since": alert.created_at,
                    "acknowledged": alert.acknowledged,
                    "acknowledged_by": alert.acknowledged_by,
                    "acknowledged_at": alert.acknowledged_at,
                }
            )
        return out

    def acknowledge(self, alert_id: int, user_email: str, ack: bool = True) -> Alert | None:
        alert = self.db.get(Alert, alert_id)
        if not alert:
            return None
        alert.acknowledged = ack
        alert.acknowledged_by = user_email if ack else None
        alert.acknowledged_at = datetime.now(timezone.utc) if ack else None
        self.db.commit()
        self.db.refresh(alert)

        from app.services.event_service import EventService

        check = self.db.get(Check, alert.check_id)
        EventService(self.db).record(
            "alert_acknowledged" if ack else "alert_unacknowledged",
            f"Incident {'acquitté' if ack else 'ré-ouvert'} par {user_email}",
            host_id=check.host_id if check else None,
            check_id=alert.check_id,
            actor=user_email,
        )
        return alert
