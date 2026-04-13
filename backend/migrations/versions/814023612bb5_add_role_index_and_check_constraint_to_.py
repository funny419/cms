"""add role index and check constraint to users

Revision ID: 814023612bb5
Revises: 940ed6431ecc
Create Date: 2026-04-13 03:49:56.608407

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "814023612bb5"
down_revision = "940ed6431ecc"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("idx_users_role", "users", ["role"])
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT chk_users_role"
        " CHECK (role IN ('admin','editor','subscriber','deactivated'))"
    )


def downgrade():
    op.execute("ALTER TABLE users DROP CONSTRAINT chk_users_role")
    op.drop_index("idx_users_role", "users")
