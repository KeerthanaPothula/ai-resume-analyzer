"""add_reset_token_and_is_applied

Revision ID: e4f5a6b7c8d9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'e4f5a6b7c8d9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reset_token_hash', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('reset_token_expires', sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table('candidate_rankings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('is_applied', sa.Boolean(), nullable=False, server_default='1')
        )


def downgrade():
    with op.batch_alter_table('candidate_rankings', schema=None) as batch_op:
        batch_op.drop_column('is_applied')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('reset_token_expires')
        batch_op.drop_column('reset_token_hash')
