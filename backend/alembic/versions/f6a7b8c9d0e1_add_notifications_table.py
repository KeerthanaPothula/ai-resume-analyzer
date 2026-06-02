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

_notificationtype_enum = sa.Enum(
    'application_received', 'status_updated', 'interview_scheduled',
    'shortlisted', 'rejected', 'accepted',
    name='notificationtype',
)


def upgrade():
    _notificationtype_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('type', _notificationtype_enum, nullable=True),
        sa.Column('read', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('action_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_notifications_id'), ['id'], unique=False)


def downgrade():
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_notifications_id'))

    op.drop_table('notifications')
    _notificationtype_enum.drop(op.get_bind(), checkfirst=True)
