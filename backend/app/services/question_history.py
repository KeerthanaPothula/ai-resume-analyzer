"""
Persistent interview-question history per user.

Provides two operations used by ai_feedback.py before/after each
job-match analysis:

  get_recent_set(db, user_id)
      Returns a set of the last HISTORY_LIMIT question strings for
      the user.  Used to build the exclusion set passed to the LLM
      service so repeated questions are avoided across deployments.

  record_questions(db, user_id, questions)
      Inserts new questions and prunes to HISTORY_LIMIT rows.
      Atomic: insert + prune share one transaction.

Both operations use the (user_id, generated_at DESC) composite index
and are O(HISTORY_LIMIT) — never a full-table scan.
"""

import logging
from typing import List, Set

from sqlalchemy.orm import Session

from app.models.question_history import UserQuestionHistory

logger = logging.getLogger(__name__)

HISTORY_LIMIT = 50


def get_recent_set(db: Session, user_id: int) -> Set[str]:
    """Return the last HISTORY_LIMIT question strings as a set."""
    try:
        rows = (
            db.query(UserQuestionHistory.question_text)
            .filter(UserQuestionHistory.user_id == user_id)
            .order_by(UserQuestionHistory.generated_at.desc())
            .limit(HISTORY_LIMIT)
            .all()
        )
        return {row.question_text for row in rows}
    except Exception:
        logger.warning(
            "question_history.get_recent_set failed for user_id=%d "
            "(table may not exist yet — proceeding without exclusion set)",
            user_id,
        )
        try:
            db.rollback()
        except Exception:
            pass
        return set()


def record_questions(db: Session, user_id: int, questions: List[str]) -> None:
    """
    Persist `questions` to the history table and prune to HISTORY_LIMIT.

    Steps (single transaction):
      1. INSERT one row per question.
      2. Materialize the IDs of the newest HISTORY_LIMIT rows.
      3. DELETE all older rows for this user not in that set.
      4. COMMIT.
    """
    if not questions:
        return

    try:
        for q in questions:
            db.add(UserQuestionHistory(user_id=user_id, question_text=q))
        db.flush()  # assigns IDs + generated_at without committing

        # Materialize the newest HISTORY_LIMIT IDs (includes just-inserted rows)
        keep_ids = [
            row.id
            for row in (
                db.query(UserQuestionHistory.id)
                .filter(UserQuestionHistory.user_id == user_id)
                .order_by(UserQuestionHistory.generated_at.desc())
                .limit(HISTORY_LIMIT)
                .all()
            )
        ]

        if keep_ids:
            db.query(UserQuestionHistory).filter(
                UserQuestionHistory.user_id == user_id,
                ~UserQuestionHistory.id.in_(keep_ids),
            ).delete(synchronize_session=False)

        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "question_history.record_questions failed for user_id=%d — skipping persistence",
            user_id,
        )
