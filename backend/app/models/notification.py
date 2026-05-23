import enum
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func
from app.db.database import Base


class NotificationType(str, enum.Enum):
    application_received = "application_received"
    status_updated = "status_updated"
    interview_scheduled = "interview_scheduled"
    shortlisted = "shortlisted"
    rejected = "rejected"
    accepted = "accepted"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(SAEnum(NotificationType, name="notificationtype"), nullable=True)
    read = Column(Boolean, default=False, nullable=False, server_default="0")
    action_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
