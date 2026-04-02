from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from models.base import Base

if TYPE_CHECKING:
    from models.post import Post
    from models.user import User


class Series(Base):
    """포스트 시리즈 (여러 포스트를 묶는 컬렉션)"""

    __tablename__ = "series"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    author: Mapped["User"] = relationship("User", back_populates="series")
    series_posts: Mapped[List["SeriesPost"]] = relationship(
        "SeriesPost",
        back_populates="series",
        cascade="all, delete-orphan",
        order_by="SeriesPost.order",
    )


class SeriesPost(Base):
    """시리즈-포스트 다대다 연결 테이블 (순서 포함)"""

    __tablename__ = "series_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    series_id: Mapped[int] = mapped_column(
        ForeignKey("series.id", ondelete="CASCADE"), nullable=False
    )
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    series: Mapped["Series"] = relationship("Series", back_populates="series_posts")
    post: Mapped["Post"] = relationship("Post")

    __table_args__ = (
        UniqueConstraint("series_id", "post_id", name="uq_series_post"),
        Index("idx_series_post_order", "series_id", "order"),
    )
