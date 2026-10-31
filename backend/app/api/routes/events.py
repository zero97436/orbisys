from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.tenancy import visible_host_ids
from app.db.session import get_db
from app.models.user import User
from app.services.event_service import EventService

router = APIRouter(prefix="/events", tags=["events"], dependencies=[Depends(get_current_user)])


class EventOut(BaseModel):
    id: int
    type: str
    level: str
    message: str
    host_id: int | None = None
    check_id: int | None = None
    actor: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[EventOut])
def list_events(
    type: str | None = None,
    level: str | None = None,
    host_id: int | None = None,
    check_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = EventService(db).list(type=type, level=level, host_id=host_id, check_id=check_id, limit=limit, offset=offset)
    allowed = visible_host_ids(db, user)
    if allowed is not None:
        # Cloisonné : uniquement les événements rattachés à un hôte du tenant.
        rows = [e for e in rows if e.host_id in allowed]
    return rows
