"""
models 패키지 — 전체 ORM 모델 re-export (Alembic 자동 감지용)

도메인별 파일 구조:
  base.py        — Base(DeclarativeBase)
  user.py        — User, Follow
  post.py        — Post, PostMeta, PostLike, VisitLog
  comment.py     — Comment
  media.py       — Media
  category.py    — Category
  tag.py         — Tag, PostTag
  series.py      — Series, SeriesPost
  option.py      — Option, Menu, MenuItem
  constants.py   — MAX_CATEGORY_DEPTH
"""

from models.base import Base
from models.category import Category
from models.comment import Comment
from models.constants import MAX_CATEGORY_DEPTH
from models.media import Media
from models.option import Menu, MenuItem, Option
from models.post import Post, PostLike, PostMeta, VisitLog
from models.series import Series, SeriesPost
from models.tag import PostTag, Tag
from models.user import Follow, User

__all__ = [
    "Base",
    "User",
    "Follow",
    "Post",
    "PostMeta",
    "PostLike",
    "VisitLog",
    "Comment",
    "Media",
    "Category",
    "Tag",
    "PostTag",
    "Series",
    "SeriesPost",
    "Option",
    "Menu",
    "MenuItem",
    "MAX_CATEGORY_DEPTH",
]
