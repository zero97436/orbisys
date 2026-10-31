"""Journal global des événements : enregistrement + lecture filtrée."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event_log import EventLog


class EventService:
    def __init__(self, db: Session):
        self.db = db

    def record(
        self,
        type: str,
        message: str,
        *,
        level: str = "info",
        host_id: int | None = None,
        check_id: int | None = None,
        actor: str | None = "system",
        meta: dict | None = None,
        commit: bool = True,
    ) -> EventLog:
        evt = EventLog(
            type=type, message=message, level=level,
            host_id=host_id, check_id=check_id, actor=actor, meta=meta,
        )
        self.db.add(evt)
        if commit:
            self.db.commit()
        return evt

    def list(
        self,
        type: str | None = None,
        level: str | None = None,
        host_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
        check_id: int | None = None,
    ) -> list[EventLog]:
        stmt = select(EventLog).order_by(EventLog.created_at.desc())
        if type:
            stmt = stmt.where(EventLog.type == type)
        if level:
            stmt = stmt.where(EventLog.level == level)
        if host_id is not None:
            stmt = stmt.where(EventLog.host_id == host_id)
        if check_id is not None:
            stmt = stmt.where(EventLog.check_id == check_id)
        return list(self.db.scalars(stmt.limit(min(limit, 500)).offset(max(0, offset))))
