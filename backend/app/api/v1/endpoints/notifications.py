import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError

from app.db.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.core.security import get_current_active_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        notifications = (
            db.query(Notification)
            .filter(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
            .all()
        )
        return [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type.value if n.type else None,
                "read": n.read,
                "action_url": n.action_url,
                "created_at": (
                    n.created_at.isoformat() if n.created_at.tzinfo
                    else n.created_at.isoformat() + "Z"
                ) if n.created_at else None,
            }
            for n in notifications
        ]
    except ProgrammingError:
        logger.warning("notifications table missing — returning empty list (migration pending)")
        db.rollback()
        return []


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        count = (
            db.query(Notification)
            .filter(Notification.user_id == current_user.id, Notification.read == False)  # noqa: E712
            .count()
        )
        return {"count": count}
    except ProgrammingError:
        logger.warning("notifications table missing — returning count=0 (migration pending)")
        db.rollback()
        return {"count": 0}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        n = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        ).first()
        if n:
            n.read = True
            db.commit()
    except ProgrammingError:
        logger.warning("notifications table missing — mark_read is a no-op (migration pending)")
        db.rollback()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.read == False,  # noqa: E712
        ).update({"read": True})
        db.commit()
    except ProgrammingError:
        logger.warning("notifications table missing — mark_all_read is a no-op (migration pending)")
        db.rollback()
    return {"ok": True}
