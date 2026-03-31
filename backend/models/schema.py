from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from werkzeug.security import check_password_hash, generate_password_hash


# Note: 실제 환경에서는 backend/extensions.py 등에서 db 객체를 가져와야 할 수 있습니다.
# 여기서는 스키마 정의를 위해 DeclarativeBase를 사용합니다.
class Base(DeclarativeBase):
    pass


class Option(Base):
    """
    사이트 전역 설정 (Key-Value)
    WordPress의 wp_options 테이블과 유사한 역할
    """

    __tablename__ = "options"

    id: Mapped[int] = mapped_column(primary_key=True)
    option_name: Mapped[str] = mapped_column(String(191), unique=True, nullable=False)
    option_value: Mapped[Optional[str]] = mapped_column(Text)
    autoload: Mapped[bool] = mapped_column(Boolean, default=True)


class User(Base):
    """
    사용자 및 권한 관리 (RBAC)
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="subscriber")  # admin, editor, subscriber
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    blog_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    blog_color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    social_links: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    blog_layout: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    banner_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
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


class Post(Base):
    """
    콘텐츠의 핵심 테이블 (Posts, Pages, Custom Post Types)
    """

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), index=True)
    content: Mapped[Optional[str]] = mapped_column(Text)  # HTML or Markdown
    excerpt: Mapped[Optional[str]] = mapped_column(Text)

    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, published, scheduled
    post_type: Mapped[str] = mapped_column(
        String(20), default="post"
    )  # post, page, attachment, custom...

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_format: Mapped[str] = mapped_column(String(10), default="html", nullable=False)
    # visibility: 접근 권한 차원 (status=발행상태와 독립)
    # public: 비로그인도 조회 가능
    # members_only: 로그인 사용자만 조회 가능
    # private: 작성자 + admin만 조회 가능
    visibility: Mapped[str] = mapped_column(String(20), default="public", nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
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
        }


class PostMeta(Base):
    """
    포스트별 확장 데이터 (Custom Fields)
    """

    __tablename__ = "post_meta"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    meta_key: Mapped[str] = mapped_column(String(255), nullable=False)
    meta_value: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    post: Mapped["Post"] = relationship(back_populates="metas")


class Media(Base):
    """
    미디어 라이브러리 및 파일 메타데이터
    """

    __tablename__ = "media"

    id: Mapped[int] = mapped_column(primary_key=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    filepath: Mapped[str] = mapped_column(String(500), nullable=False)  # Storage path or URL
    mimetype: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)  # Bytes
    meta_data: Mapped[Optional[dict]] = mapped_column(JSON)  # Dimensions, alt text, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self) -> dict:
        meta = self.meta_data or {}
        return {
            "id": self.id,
            "filename": self.filename,
            "url": self.filepath,  # 공개 접근 URL (/uploads/... 또는 CDN URL)
            "filepath": self.filepath,  # 하위 호환 유지
            "thumbnail_url": meta.get("thumbnail_url"),
            "mimetype": self.mimetype,
            "size": self.size,
            "uploaded_by": self.uploaded_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PostLike(Base):
    """포스트 추천 (1인 1추천, 토글)"""

    __tablename__ = "post_likes"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_like"),)


class Comment(Base):
    """
    댓글 시스템 (계층형 구조 지원)
    """

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    author_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )  # Null if guest
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("comments.id"), nullable=True)

    author_name: Mapped[str] = mapped_column(String(100))  # For guests
    author_email: Mapped[str] = mapped_column(String(120))
    author_password_hash: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )  # 게스트 전용
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="approved")  # approved, pending, spam

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "post_id": self.post_id,
            "author_id": self.author_id,
            "parent_id": self.parent_id,
            "author_name": self.author_name,
            "author_email": self.author_email,  # 게스트 식별용, 프론트엔드가 사용
            "content": self.content,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    # Relationships
    post: Mapped["Post"] = relationship(back_populates="comments")
    author: Mapped[Optional["User"]] = relationship(back_populates="comments")
    parent: Mapped[Optional["Comment"]] = relationship(
        "Comment",
        back_populates="replies",
        remote_side="Comment.id",
        foreign_keys="[Comment.parent_id]",
    )
    replies: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="parent",
        foreign_keys="[Comment.parent_id]",
    )


class Menu(Base):
    """
    네비게이션 메뉴 그룹
    """

    __tablename__ = "menus"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    location: Mapped[Optional[str]] = mapped_column(String(50))  # e.g., 'primary', 'footer'


class MenuItem(Base):
    """
    개별 메뉴 아이템 (계층 구조)
    """

    __tablename__ = "menu_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menus.id"), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("menu_items.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(255))
    order: Mapped[int] = mapped_column(Integer, default=0)


class Tag(Base):
    """태그 (계층 없음, 단순 라벨)"""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
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

    __table_args__ = (UniqueConstraint("post_id", "tag_id", name="uq_post_tag"),)


MAX_CATEGORY_DEPTH = 3  # 카테고리 최대 깊이 (API 레벨 검증)


class Category(Base):
    """카테고리 (계층형, 최대 3단)"""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships (자기참조)
    posts: Mapped[List["Post"]] = relationship("Post", back_populates="category")
    parent: Mapped[Optional["Category"]] = relationship(
        "Category",
        back_populates="children",
        remote_side="Category.id",
        foreign_keys="[Category.parent_id]",
    )
    children: Mapped[List["Category"]] = relationship(
        "Category",
        back_populates="parent",
        foreign_keys="[Category.parent_id]",
    )

    def to_dict(self, post_count: int = 0) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "parent_id": self.parent_id,
            "order": self.order,
            "post_count": post_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
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

    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_follow"),)

    follower_user: Mapped["User"] = relationship(
        "User", foreign_keys=[follower_id], back_populates="followings"
    )
    following_user: Mapped["User"] = relationship(
        "User", foreign_keys=[following_id], back_populates="followers"
    )
