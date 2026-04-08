"""add_indexes_visit_logs_posts

Revision ID: 5d92b5bbdf0c
Revises: 5c4b3411ca67
Create Date: 2026-04-08 01:43:56.066109

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "5d92b5bbdf0c"
down_revision = "5c4b3411ca67"
branch_labels = None
depends_on = None


def upgrade():
    # posts: (status, visibility, created_at DESC) 복합 인덱스
    # created_at DESC는 text() 표현식이 필요하므로 op.execute() 직접 사용
    op.execute(
        "CREATE INDEX idx_posts_status_visibility_created "
        "ON posts(status, visibility, created_at DESC)"
    )

    # visit_logs: visited_at 단독 인덱스 (통계 기간 필터 최적화)
    with op.batch_alter_table("visit_logs", schema=None) as batch_op:
        batch_op.create_index("idx_visit_logs_visited_at", ["visited_at"], unique=False)


def downgrade():
    with op.batch_alter_table("visit_logs", schema=None) as batch_op:
        batch_op.drop_index("idx_visit_logs_visited_at")

    op.execute("DROP INDEX idx_posts_status_visibility_created ON posts")
