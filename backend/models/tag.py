from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from models.base import Base

if TYPE_CHECKING:
    from models.post import Post


class Tag(Base):
    """태그 (계층 없음, 단순 라벨)"""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    posts: Mapped[List["Post"]] = relationship("Post", secondary="post_tags", back_populates="tags")

    def to_dict(self, post_count: int = 0) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "post_count": post_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PostTag(Base):
    """포스트-태그 다대다 연결 테이블"""

    __tablename__ = "post_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("post_id", "tag_id", name="uq_post_tag"),
        Index("idx_post_tags_tag_id", "tag_id"),
    )
