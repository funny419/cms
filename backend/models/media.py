from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class Media(Base):
    """미디어 라이브러리 및 파일 메타데이터"""

    __tablename__ = "media"

    id: Mapped[int] = mapped_column(primary_key=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    filepath: Mapped[str] = mapped_column(String(500), nullable=False)
    mimetype: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    meta_data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self) -> dict:
        meta = self.meta_data or {}
        return {
            "id": self.id,
            "filename": self.filename,
            "url": self.filepath,
            "filepath": self.filepath,
            "thumbnail_url": meta.get("thumbnail_url"),
            "mimetype": self.mimetype,
            "size": self.size,
            "uploaded_by": self.uploaded_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
