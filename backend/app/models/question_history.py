from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.db.database import Base


class UserQuestionHistory(Base):
    __tablename__ = "user_question_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        # (user_id, generated_at) — PostgreSQL uses this for both the
        # SELECT ... ORDER BY generated_at DESC LIMIT 50 read and the
        # pruning DELETE subquery via an efficient index scan.
        Index("ix_uqh_user_generated", "user_id", "generated_at"),
    )
