"""add_notifications_table

Revision ID: f6a7b8c9d0e1
Revises: e4f5a6b7c8d9
Create Date: 2026-06-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f6a7b8c9d0e1'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade():
    # PostgreSQL has no CREATE TYPE IF NOT EXISTS; use a PL/pgSQL exception
    # block so retried deployments (type already exists from a previous
    # partially-applied run) don't raise DuplicateObject and abort the deploy.
    op.execute(sa.text(
        "DO $$ BEGIN "
        "  CREATE TYPE notificationtype AS ENUM ("
        "    'application_received','status_updated','interview_scheduled',"
        "    'shortlisted','rejected','accepted');"
        "EXCEPTION WHEN duplicate_object THEN NULL;"
        "END $$"
    ))

    # IF NOT EXISTS makes this idempotent on repeated migration attempts.
    op.execute(sa.text(
        "CREATE TABLE IF NOT EXISTS notifications ("
        "  id         SERIAL       NOT NULL,"
        "  user_id    INTEGER      NOT NULL REFERENCES users(id),"
        "  title      VARCHAR      NOT NULL,"
        "  message    TEXT         NOT NULL,"
        "  type       notificationtype,"
        "  read       BOOLEAN      NOT NULL DEFAULT FALSE,"
        "  action_url VARCHAR,"
        "  created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,"
        "  PRIMARY KEY (id)"
        ")"
    ))

    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_notifications_id ON notifications (id)"
    ))


def downgrade():
    op.execute(sa.text("DROP INDEX IF EXISTS ix_notifications_id"))
    op.execute(sa.text("DROP TABLE IF EXISTS notifications"))
    op.execute(sa.text("DROP TYPE  IF EXISTS notificationtype"))
