from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from werkzeug.security import check_password_hash, generate_password_hash

from models.base import Base

if TYPE_CHECKING:
    from models.comment import Comment
    from models.post import Post
    from models.series import Series


class User(Base):
    """사용자 및 권한 관리 (RBAC)"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="subscriber")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    blog_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    blog_color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    social_links: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    blog_layout: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    banner_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    posts: Mapped[List["Post"]] = relationship(back_populates="author")
    comments: Mapped[List["Comment"]] = relationship(back_populates="author")
    followers: Mapped[List["Follow"]] = relationship(
        "Follow",
        foreign_keys="[Follow.following_id]",
        back_populates="following_user",
        cascade="all, delete-orphan",
    )
    followings: Mapped[List["Follow"]] = relationship(
        "Follow",
        foreign_keys="[Follow.follower_id]",
        back_populates="follower_user",
        cascade="all, delete-orphan",
    )
    series: Mapped[List["Series"]] = relationship(
        "Series", back_populates="author", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("idx_users_role", "role"),)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "bio": self.bio,
            "avatar_url": self.avatar_url,
            "blog_title": self.blog_title,
            "blog_color": self.blog_color,
            "website_url": self.website_url,
            "social_links": self.social_links,
            "blog_layout": self.blog_layout,
            "banner_image_url": self.banner_image_url,
        }


class Follow(Base):
    """팔로우 관계 (이웃)"""

    __tablename__ = "follows"

    id: Mapped[int] = mapped_column(primary_key=True)
    follower_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    following_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_follow"),
        Index("idx_follows_following_id", "following_id"),
    )

    follower_user: Mapped["User"] = relationship(
        "User", foreign_keys=[follower_id], back_populates="followings"
    )
    following_user: Mapped["User"] = relationship(
        "User", foreign_keys=[following_id], back_populates="followers"
    )
