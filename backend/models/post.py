from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from models.base import Base

if TYPE_CHECKING:
    from models.category import Category
    from models.comment import Comment
    from models.tag import Tag
    from models.user import User


class Post(Base):
    """콘텐츠의 핵심 테이블 (Posts, Pages, Custom Post Types)"""

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), index=True)
    content: Mapped[Optional[str]] = mapped_column(Text)
    excerpt: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    post_type: Mapped[str] = mapped_column(String(20), default="post")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_format: Mapped[str] = mapped_column(String(10), default="html", nullable=False)
    visibility: Mapped[str] = mapped_column(String(20), default="public", nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("ix_posts_author_id", "author_id"),
        Index("idx_posts_status_visibility_created", "status", "visibility", "created_at"),
        Index("ft_posts_search", "title", "content", "excerpt", mysql_prefix="FULLTEXT"),
    )

    author: Mapped["User"] = relationship(back_populates="posts")
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="posts")
    metas: Mapped[List["PostMeta"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )
    comments: Mapped[List["Comment"]] = relationship(back_populates="post")
    tags: Mapped[List["Tag"]] = relationship("Tag", secondary="post_tags", back_populates="posts")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "content": self.content,
            "excerpt": self.excerpt,
            "status": self.status,
            "post_type": self.post_type,
            "content_format": self.content_format,
            "visibility": self.visibility,
            "category_id": self.category_id,
            "author_id": self.author_id,
            "view_count": self.view_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "tags": [{"id": t.id, "name": t.name, "slug": t.slug} for t in self.tags],
            "thumbnail_url": self.thumbnail_url,
        }


class PostMeta(Base):
    """포스트별 확장 데이터 (Custom Fields)"""

    __tablename__ = "post_meta"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    meta_key: Mapped[str] = mapped_column(String(255), nullable=False)
    meta_value: Mapped[Optional[str]] = mapped_column(Text)

    post: Mapped["Post"] = relationship(back_populates="metas")


class PostLike(Base):
    """포스트 추천 (1인 1추천, 토글)"""

    __tablename__ = "post_likes"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_like"),
        Index("idx_post_likes_user_id", "user_id"),
    )


class VisitLog(Base):
    """방문 로그 (포스트별 일별 집계용)"""

    __tablename__ = "visit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("posts.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    visited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    referer: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("idx_visit_post_time", "post_id", "visited_at"),
        Index("idx_visit_logs_visited_at", "visited_at"),
    )
