"""add fulltext ngram index to posts

Revision ID: fffa879f6f26
Revises: 761ee81e777c
Create Date: 2026-03-30 08:17:59.548224

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'fffa879f6f26'
down_revision = '761ee81e777c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # InnoDB Fulltext 인덱스 생성 (innodb_ft_min_token_size=2로 한글 2자 단위 토크나이징)
    # MariaDB 10.11은 ngram 파서를 내장하지 않으므로 기본 InnoDB Fulltext 사용
    op.execute(
        "ALTER TABLE posts ADD FULLTEXT INDEX ft_posts_search "
        "(title, content, excerpt)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX ft_posts_search ON posts")
