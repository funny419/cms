import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import select
from PIL import Image
from werkzeug.utils import secure_filename
from api.decorators import roles_required
from models.schema import Media
from database import db

media_bp = Blueprint("media", __name__, url_prefix="/api/media")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
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

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    unique_filename = f"{uuid.uuid4().hex}_{safe_name}"
    filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
    thumb_path = os.path.join(UPLOAD_FOLDER, f"thumb_{unique_filename}")
    file.save(filepath)

    # 썸네일 생성 (이미지 파일만)
    try:
        img = Image.open(filepath)
        img.thumbnail(THUMBNAIL_SIZE)
        img.save(thumb_path)
    except Exception:
        pass  # 썸네일 생성 실패해도 업로드 자체는 성공

    media = Media(
        filename=safe_name,
        filepath=filepath,
        mimetype=file.mimetype,
        size=os.path.getsize(filepath),
        uploaded_by=int(get_jwt_identity()),
    )
    db.session.add(media)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        if os.path.exists(filepath):
            os.remove(filepath)
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": media.to_dict(), "error": ""}), 201


@media_bp.route("", methods=["GET"])
@roles_required("admin", "editor")
def list_media() -> tuple:
    items = db.session.execute(select(Media)).scalars().all()
    return jsonify({"success": True, "data": [m.to_dict() for m in items], "error": ""}), 200
