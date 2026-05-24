"""add_email_verification

Revision ID: c3d4e5f6a7b8
Revises: 475af1c1f7b0
Create Date: 2026-05-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a7b8'
down_revision = '475af1c1f7b0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email_verification_token_hash', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('email_verification_token_expires', sa.DateTime(timezone=True), nullable=True))

    # Grandfather accounts created before verification was introduced
    op.execute("UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE")


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('email_verification_token_expires')
        batch_op.drop_column('email_verification_token_hash')
