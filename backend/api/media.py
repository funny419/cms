import os
import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from PIL import Image
from sqlalchemy import select
from werkzeug.utils import secure_filename

from api.decorators import roles_required
from database import db
from models.schema import Media
from storage import UPLOAD_FOLDER, get_storage

media_bp = Blueprint("media", __name__, url_prefix="/api/media")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
THUMBNAIL_SIZE = (300, 300)


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@media_bp.route("", methods=["POST"])
@roles_required("admin", "editor")
def upload_file() -> tuple:
    if "file" not in request.files:
        return jsonify({"success": False, "data": {}, "error": "No file provided"}), 400
    file = request.files["file"]
    if not file.filename or not _allowed_file(file.filename):
        return jsonify({"success": False, "data": {}, "error": "Invalid file type"}), 400

    safe_name = secure_filename(file.filename)
    if not safe_name:
        return jsonify({"success": False, "data": {}, "error": "Invalid filename"}), 400

    storage = get_storage()
    unique_filename = f"{uuid.uuid4().hex}_{safe_name}"

    # 파일 저장 → 공개 URL 반환
    url = storage.save(file, unique_filename)

    # 썸네일 생성 (로컬 경로가 있는 경우만)
    thumb_url: str | None = None
    local_path = storage.get_local_path(unique_filename)
    if local_path and os.path.exists(local_path):
        thumb_filename = f"thumb_{unique_filename}"
        thumb_local_path = os.path.join(UPLOAD_FOLDER, thumb_filename)
        try:
            img = Image.open(local_path)
            img.thumbnail(THUMBNAIL_SIZE)
            img.save(thumb_local_path)
            thumb_url = f"/uploads/{thumb_filename}"
        except Exception:
            pass  # 썸네일 실패해도 업로드 자체는 성공

    file_size = os.path.getsize(local_path) if local_path and os.path.exists(local_path) else 0

    media = Media(
        filename=safe_name,
        filepath=url,  # 공개 URL 저장
        mimetype=file.mimetype,
        size=file_size,
        uploaded_by=int(get_jwt_identity()),
        meta_data={"thumbnail_url": thumb_url} if thumb_url else None,
    )
    db.session.add(media)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        storage.delete(url)
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500

    return jsonify({"success": True, "data": media.to_dict(), "error": ""}), 201


@media_bp.route("", methods=["GET"])
@roles_required("admin", "editor")
def list_media() -> tuple:
    items = db.session.execute(select(Media)).scalars().all()
    return jsonify({"success": True, "data": [m.to_dict() for m in items], "error": ""}), 200
