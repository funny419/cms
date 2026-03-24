from flask import Blueprint, request, jsonify
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Option
from database import db

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

# 공개 허용 키 목록
PUBLIC_KEYS = ["site_title", "tagline", "site_url"]

ADMIN_ALLOWED_KEYS = {"site_title", "tagline", "site_url", "admin_email", "posts_per_page"}


@settings_bp.route("", methods=["GET"])
def get_settings() -> tuple:
    """공개 사이트 설정 조회."""
    options = db.session.execute(
        select(Option).where(Option.option_name.in_(PUBLIC_KEYS))
    ).scalars().all()
    data = {opt.option_name: opt.option_value for opt in options}
    return jsonify({"success": True, "data": data, "error": ""}), 200


@settings_bp.route("", methods=["PUT"])
@roles_required("admin")
def update_settings() -> tuple:
    """관리자 전용 사이트 설정 수정."""
    data: dict = request.get_json() or {}
    for key, value in data.items():
        if key not in ADMIN_ALLOWED_KEYS:
            continue  # 허용되지 않는 키는 무시
        option = db.session.execute(
            select(Option).where(Option.option_name == key)
        ).scalar_one_or_none()
        if option:
            option.option_value = str(value)
        else:
            db.session.add(Option(option_name=key, option_value=str(value)))
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": data, "error": ""}), 200
