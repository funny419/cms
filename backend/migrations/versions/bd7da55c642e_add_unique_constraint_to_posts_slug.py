"""add unique constraint to posts slug

Revision ID: bd7da55c642e
Revises: 5523ceeb393f
Create Date: 2026-04-10 07:41:47.997254

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "bd7da55c642e"
down_revision = "5523ceeb393f"
branch_labels = None
depends_on = None


def upgrade():
    # 빈 slug 포스트를 post-{id} 형식으로 업데이트 (UNIQUE 제약 추가 전 중복 제거)
    op.execute("UPDATE posts SET slug = CONCAT('post-', id) WHERE slug = '' OR slug IS NULL")

    with op.batch_alter_table("posts", schema=None) as batch_op:
        batch_op.create_unique_constraint("uq_posts_slug", ["slug"])


def downgrade():
    with op.batch_alter_table("posts", schema=None) as batch_op:
        batch_op.drop_constraint("uq_posts_slug", type_="unique")
