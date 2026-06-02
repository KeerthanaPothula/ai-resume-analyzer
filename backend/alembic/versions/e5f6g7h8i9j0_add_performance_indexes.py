"""add_performance_indexes

Adds explicit indexes on high-frequency foreign-key columns that are not
covered by SQLAlchemy's automatic PK/unique indexes:

  resumes.user_id                   — candidate resume list
  job_descriptions.recruiter_id     — recruiter job list
  candidate_rankings.job_id         — rankings-for-job query
  candidate_rankings.resume_id      — my-applications query
  ats_scores.resume_id              — scores-for-resume query
  ats_scores.job_id                 — scores-for-job query
  notifications.user_id             — unread-count + notification feed

All statements use IF NOT EXISTS so the migration is safe to re-run
and does not fail if an index already exists.

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-02 18:00:00.000000
"""

from alembic import op

revision = 'e5f6g7h8i9j0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS ix_resumes_user_id ON resumes (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_job_descriptions_recruiter_id ON job_descriptions (recruiter_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_candidate_rankings_job_id ON candidate_rankings (job_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_candidate_rankings_resume_id ON candidate_rankings (resume_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ats_scores_resume_id ON ats_scores (resume_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ats_scores_job_id ON ats_scores (job_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_resumes_user_id")
    op.execute("DROP INDEX IF EXISTS ix_job_descriptions_recruiter_id")
    op.execute("DROP INDEX IF EXISTS ix_candidate_rankings_job_id")
    op.execute("DROP INDEX IF EXISTS ix_candidate_rankings_resume_id")
    op.execute("DROP INDEX IF EXISTS ix_ats_scores_resume_id")
    op.execute("DROP INDEX IF EXISTS ix_ats_scores_job_id")
    op.execute("DROP INDEX IF EXISTS ix_notifications_user_id")
