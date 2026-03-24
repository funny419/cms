from datetime import datetime
from typing import Optional, List, Any
from sqlalchemy import Integer, String, Text, ForeignKey, DateTime, Boolean, JSON, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase
from sqlalchemy.sql import func
from werkzeug.security import generate_password_hash, check_password_hash

# Note: 실제 환경에서는 backend/extensions.py 등에서 db 객체를 가져와야 할 수 있습니다.
# 여기서는 스키마 정의를 위해 DeclarativeBase를 사용합니다.
class Base(DeclarativeBase):
    pass

class Option(Base):
    """
    사이트 전역 설정 (Key-Value)
    WordPress의 wp_options 테이블과 유사한 역할
    """
    __tablename__ = 'options'

    id: Mapped[int] = mapped_column(primary_key=True)
    option_name: Mapped[str] = mapped_column(String(191), unique=True, nullable=False)
    option_value: Mapped[Optional[str]] = mapped_column(Text)
    autoload: Mapped[bool] = mapped_column(Boolean, default=True)


class User(Base):
    """
    사용자 및 권한 관리 (RBAC)
    """
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default='subscriber')  # admin, editor, subscriber
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    posts: Mapped[List["Post"]] = relationship(back_populates="author")
    comments: Mapped[List["Comment"]] = relationship(back_populates="author")

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
        }


class Post(Base):
    """
    콘텐츠의 핵심 테이블 (Posts, Pages, Custom Post Types)
    """
    __tablename__ = 'posts'

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), index=True)
    content: Mapped[Optional[str]] = mapped_column(Text)  # HTML or Markdown
    excerpt: Mapped[Optional[str]] = mapped_column(Text)
    
    status: Mapped[str] = mapped_column(String(20), default='draft')  # draft, published, scheduled
    post_type: Mapped[str] = mapped_column(String(20), default='post')  # post, page, attachment, custom...
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    author: Mapped["User"] = relationship(back_populates="posts")
    metas: Mapped[List["PostMeta"]] = relationship(back_populates="post", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship(back_populates="post")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "content": self.content,
            "excerpt": self.excerpt,
            "status": self.status,
            "post_type": self.post_type,
            "author_id": self.author_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PostMeta(Base):
    """
    포스트별 확장 데이터 (Custom Fields)
    """
    __tablename__ = 'post_meta'

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey('posts.id'), nullable=False)
    meta_key: Mapped[str] = mapped_column(String(255), nullable=False)
    meta_value: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    post: Mapped["Post"] = relationship(back_populates="metas")


class Media(Base):
    """
    미디어 라이브러리 및 파일 메타데이터
    """
    __tablename__ = 'media'

    id: Mapped[int] = mapped_column(primary_key=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    filepath: Mapped[str] = mapped_column(String(500), nullable=False) # Storage path or URL
    mimetype: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer) # Bytes
    meta_data: Mapped[Optional[dict]] = mapped_column(JSON) # Dimensions, alt text, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "filename": self.filename,
            "filepath": self.filepath,
            "mimetype": self.mimetype,
            "size": self.size,
            "uploaded_by": self.uploaded_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Comment(Base):
    """
    댓글 시스템 (계층형 구조 지원)
    """
    __tablename__ = 'comments'

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey('posts.id'), nullable=False)
    author_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'), nullable=True) # Null if guest
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey('comments.id'), nullable=True)
    
    author_name: Mapped[str] = mapped_column(String(100)) # For guests
    author_email: Mapped[str] = mapped_column(String(120))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default='approved') # approved, pending, spam
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

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
    __tablename__ = 'menus'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    location: Mapped[Optional[str]] = mapped_column(String(50)) # e.g., 'primary', 'footer'

class MenuItem(Base):
    """
    개별 메뉴 아이템 (계층 구조)
    """
    __tablename__ = 'menu_items'
    id: Mapped[int] = mapped_column(primary_key=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey('menus.id'), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey('menu_items.id'), nullable=True)
    title: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(255))
    order: Mapped[int] = mapped_column(Integer, default=0)