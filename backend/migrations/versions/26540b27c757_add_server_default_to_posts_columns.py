"""add server_default to posts columns

Revision ID: 26540b27c757
Revises: 814023612bb5
Create Date: 2026-04-13 05:33:21.446820

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "26540b27c757"
down_revision = "814023612bb5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("posts", schema=None) as batch_op:
        batch_op.alter_column(
            "status", existing_type=sa.String(20), server_default="draft", existing_nullable=False
        )
        batch_op.alter_column(
            "post_type", existing_type=sa.String(20), server_default="post", existing_nullable=False
        )
        batch_op.alter_column(
            "content_format",
            existing_type=sa.String(10),
            server_default="html",
            existing_nullable=False,
        )
        batch_op.alter_column(
            "visibility",
            existing_type=sa.String(20),
            server_default="public",
            existing_nullable=False,
        )
        batch_op.alter_column(
            "view_count", existing_type=sa.Integer(), server_default="0", existing_nullable=False
        )


def downgrade():
    with op.batch_alter_table("posts", schema=None) as batch_op:
        batch_op.alter_column(
            "view_count", existing_type=sa.Integer(), server_default=None, existing_nullable=False
        )
        batch_op.alter_column(
            "visibility",
            existing_type=sa.String(20),
            server_default=None,
            existing_nullable=False,
        )
        batch_op.alter_column(
            "content_format",
            existing_type=sa.String(10),
            server_default=None,
            existing_nullable=False,
        )
        batch_op.alter_column(
            "post_type", existing_type=sa.String(20), server_default=None, existing_nullable=False
        )
        batch_op.alter_column(
            "status", existing_type=sa.String(20), server_default=None, existing_nullable=False
        )
