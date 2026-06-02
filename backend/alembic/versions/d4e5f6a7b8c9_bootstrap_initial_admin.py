"""bootstrap_initial_admin

Promotes keerthipothula1207@gmail.com to admin role.
One-time data migration -- no schema changes.

Revision ID: d4e5f6a7b8c9
Revises: a1b2c3d4e5f6
Create Date: 2026-06-02 18:30:00.000000

"""
from alembic import op


revision = 'd4e5f6a7b8c9'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "UPDATE users SET role = 'admin' "
        "WHERE email = 'keerthipothula1207@gmail.com'"
    )


def downgrade():
    op.execute(
        "UPDATE users SET role = 'candidate' "
        "WHERE email = 'keerthipothula1207@gmail.com'"
    )
