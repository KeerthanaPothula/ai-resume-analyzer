"""add_user_question_history

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-06-02 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        # IF NOT EXISTS makes every clause safe to retry on a failed deploy.
        op.execute(sa.text(
            "CREATE TABLE IF NOT EXISTS user_question_history ("
            "  id            SERIAL       NOT NULL,"
            "  user_id       INTEGER      NOT NULL"
            "    REFERENCES users(id) ON DELETE CASCADE,"
            "  question_text TEXT         NOT NULL,"
            "  generated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),"
            "  PRIMARY KEY (id)"
            ")"
        ))
        op.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_uqh_user_generated"
            "  ON user_question_history (user_id, generated_at DESC)"
        ))
        op.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_user_question_history_id"
            "  ON user_question_history (id)"
        ))
    else:
        # SQLite: use portable SQLAlchemy DDL — SERIAL/TIMESTAMPTZ/NOW() are PostgreSQL-only
        if 'user_question_history' not in sa.inspect(bind).get_table_names():
            op.create_table(
                'user_question_history',
                sa.Column('id', sa.Integer(), nullable=False),
                sa.Column('user_id', sa.Integer(), nullable=False),
                sa.Column('question_text', sa.Text(), nullable=False),
                sa.Column('generated_at', sa.DateTime(timezone=True), nullable=False,
                           server_default=sa.text('(CURRENT_TIMESTAMP)')),
                sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
                sa.PrimaryKeyConstraint('id'),
            )
            op.execute(sa.text(
                "CREATE INDEX IF NOT EXISTS ix_uqh_user_generated"
                "  ON user_question_history (user_id, generated_at DESC)"
            ))
            op.execute(sa.text(
                "CREATE INDEX IF NOT EXISTS ix_user_question_history_id"
                "  ON user_question_history (id)"
            ))


def downgrade():
    op.execute(sa.text("DROP INDEX IF EXISTS ix_uqh_user_generated"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_user_question_history_id"))
    op.execute(sa.text("DROP TABLE  IF EXISTS user_question_history"))
