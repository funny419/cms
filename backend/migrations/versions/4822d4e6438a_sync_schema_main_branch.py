"""sync schema main branch

Revision ID: 4822d4e6438a
Revises: 70ee9763efa3
Create Date: 2026-03-24 13:57:48.598924

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '4822d4e6438a'
down_revision = '70ee9763efa3'
branch_labels = None
depends_on = None


def upgrade():
    # author_id: NOT NULL → nullable (회원 삭제 시 고아 포스트 처리)
    # updated_at: NOT NULL → nullable (최초 생성 시 값 없음)
    with op.batch_alter_table('posts', schema=None) as batch_op:
        batch_op.alter_column('author_id',
               existing_type=mysql.INTEGER(display_width=11),
               existing_nullable=False,
               nullable=True)
        batch_op.alter_column('updated_at',
               existing_type=mysql.DATETIME(),
               existing_nullable=False,
               nullable=True)


def downgrade():
    with op.batch_alter_table('posts', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=mysql.DATETIME(),
               existing_nullable=True,
               nullable=False)
        batch_op.alter_column('author_id',
               existing_type=mysql.INTEGER(display_width=11),
               existing_nullable=True,
               nullable=False)
