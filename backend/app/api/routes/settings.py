from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.crypto import decrypt_config, encrypt_config
from app.db.session import get_db
from app.models.notification_channel import NotificationChannel
from app.notifications import get_notifier
from app.notifications.base import Notification
from app.schemas.notification import (
    NotificationChannelCreate,
    NotificationChannelOut,
)

router = APIRouter(
    prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_user)]
)


@router.get("/notification-channels", response_model=list[NotificationChannelOut])
def list_channels(db: Session = Depends(get_db)):
    return list(db.scalars(select(NotificationChannel).order_by(NotificationChannel.name)))


@router.post(
    "/notification-channels",
    response_model=NotificationChannelOut,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
def create_channel(payload: NotificationChannelCreate, db: Session = Depends(get_db)):
    # Community : e-mail + webhook. Les autres canaux relèvent du plan Professional.
    from app.core.license import has_feature

    ch_type = payload.type.value if hasattr(payload.type, "value") else payload.type
    if ch_type not in ("email", "webhook") and not has_feature("advanced_channels"):
        from fastapi import HTTPException

        raise HTTPException(
            403,
            f"Canal « {ch_type} » disponible à partir du plan Professional "
            "(Community : e-mail et webhook).",
        )
    data = payload.model_dump()
    data["type"] = data["type"].value if hasattr(data["type"], "value") else data["type"]
    data["config_json"] = encrypt_config(data.get("config_json"))
    channel = NotificationChannel(**data)
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


@router.delete("/notification-channels/{channel_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_channel(channel_id: int, db: Session = Depends(get_db)):
    """Supprime un canal de notification (aucune autre table ne le référence)."""
    channel = db.get(NotificationChannel, channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    db.delete(channel)
    db.commit()


@router.post("/notification-channels/{channel_id}/test", dependencies=[Depends(require_admin)])
def test_channel(channel_id: int, db: Session = Depends(get_db)):
    """Envoie une notification de test via le canal."""
    channel = db.get(NotificationChannel, channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    notifier = get_notifier(channel.type)
    if not notifier:
        raise HTTPException(400, f"No notifier for type '{channel.type}'")
    notif = Notification(
        subject="[TEST] Orbisys",
        body="Notification de test — si vous lisez ceci, le canal fonctionne ✅",
        status="OK",
        check_name="test",
        host_name="Orbisys",
    )
    ok = notifier.send(notif, decrypt_config(channel.config_json or {}))
    if not ok:
        raise HTTPException(502, "L'envoi a échoué (voir logs backend / configuration du canal)")
    return {"sent": True}
