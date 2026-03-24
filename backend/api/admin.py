from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import select, update
from api.decorators import roles_required
from models.schema import User, Post
from database import db

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/posts", methods=["GET"])
@roles_required("admin")
def admin_list_posts() -> tuple:
    """전체 포스트 목록 (모든 유저, 모든 상태)."""
    posts = db.session.execute(
        select(Post).order_by(Post.created_at.desc())
    ).scalars().all()
    data = [{
        "id": p.id,
        "title": p.title,
        "status": p.status,
        "post_type": p.post_type,
        "author_id": p.author_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in posts]
    return jsonify({"success": True, "data": data, "error": ""}), 200


@admin_bp.route("/users", methods=["GET"])
@roles_required("admin")
def admin_list_users() -> tuple:
    """전체 회원 목록 (deactivated 포함)."""
    users = db.session.execute(select(User)).scalars().all()
    return jsonify({"success": True, "data": [u.to_dict() for u in users], "error": ""}), 200


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@roles_required("admin")
def admin_change_role(user_id: int) -> tuple:
    """회원 권한 변경 (editor ↔ admin, deactivated → editor 재활성화 포함)."""
    current_user_id: int = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({"success": False, "data": {}, "error": "본인의 권한은 변경할 수 없습니다."}), 403
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    data: dict = request.get_json() or {}
    role = data.get("role")
    if role not in ("editor", "admin"):
        return jsonify({"success": False, "data": {}, "error": "유효하지 않은 권한입니다. (editor 또는 admin)"}), 400
    user.role = role
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {"id": user.id, "role": user.role}, "error": ""}), 200


@admin_bp.route("/users/<int:user_id>/deactivate", methods=["PUT"])
@roles_required("admin")
def admin_deactivate_user(user_id: int) -> tuple:
    """회원 비활성화."""
    current_user_id: int = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({"success": False, "data": {}, "error": "본인을 비활성화할 수 없습니다."}), 403
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    user.role = "deactivated"
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {"id": user.id, "role": "deactivated"}, "error": ""}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@roles_required("admin")
def admin_delete_user(user_id: int) -> tuple:
    """회원 삭제. 해당 회원의 포스트 author_id는 NULL 처리."""
    current_user_id: int = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({"success": False, "data": {}, "error": "본인 계정은 삭제할 수 없습니다."}), 403
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    db.session.execute(
        update(Post).where(Post.author_id == user_id).values(author_id=None)
    )
    db.session.delete(user)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200


@admin_bp.route("/users/<int:user_id>/posts", methods=["GET"])
@roles_required("admin")
def admin_user_posts(user_id: int) -> tuple:
    """특정 회원의 포스트 전체 조회."""
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    posts = db.session.execute(
        select(Post).where(Post.author_id == user_id).order_by(Post.created_at.desc())
    ).scalars().all()
    data = [{
        "id": p.id,
        "title": p.title,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    } for p in posts]
    return jsonify({"success": True, "data": data, "error": ""}), 200
