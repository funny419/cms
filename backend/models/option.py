from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Option(Base):
    """사이트 전역 설정 (Key-Value)"""

    __tablename__ = "options"

    id: Mapped[int] = mapped_column(primary_key=True)
    option_name: Mapped[str] = mapped_column(String(191), unique=True, nullable=False)
    option_value: Mapped[Optional[str]] = mapped_column(Text)
    autoload: Mapped[bool] = mapped_column(Boolean, default=True)


class Menu(Base):
    """네비게이션 메뉴 그룹"""

    __tablename__ = "menus"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    location: Mapped[Optional[str]] = mapped_column(String(50))


class MenuItem(Base):
    """개별 메뉴 아이템 (계층 구조)"""

    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menus.id"), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("menu_items.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(255))
    order: Mapped[int] = mapped_column(Integer, default=0)
