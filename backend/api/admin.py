from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func, select, update

from api.decorators import roles_required
from api.helpers import get_pagination_params
from database import db
from models import Comment, Post, User

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/posts", methods=["GET"])
@roles_required("admin")
def admin_list_posts() -> tuple:
    """전체 포스트 목록 (모든 유저, 검색/필터/페이지네이션)."""
    page, per_page, offset = get_pagination_params()
    q = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip()

    count_query = select(func.count(Post.id))
    data_query = select(Post).order_by(Post.created_at.desc())

    if q:
        count_query = count_query.where(Post.title.ilike(f"%{q}%"))
        data_query = data_query.where(Post.title.ilike(f"%{q}%"))
    if status in ("published", "draft", "scheduled"):
        count_query = count_query.where(Post.status == status)
        data_query = data_query.where(Post.status == status)

    total: int = db.session.execute(count_query).scalar() or 0

    posts = db.session.execute(data_query.offset(offset).limit(per_page)).scalars().all()

    items = [
        {
            "id": p.id,
            "title": p.title,
            "status": p.status,
            "post_type": p.post_type,
            "author_id": p.author_id,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in posts
    ]

    return jsonify(
        {
            "success": True,
            "data": {
                "items": items,
                "page": page,
                "per_page": per_page,
                "total": total,
                "has_more": page * per_page < total,
            },
            "error": "",
        }
    ), 200


@admin_bp.route("/comments/<int:comment_id>/approve", methods=["PUT"])
@roles_required("admin")
def admin_approve_comment(comment_id: int) -> tuple:
    """게스트 댓글 승인 — pending → approved."""
    comment: Comment | None = db.session.get(Comment, comment_id)
    if not comment:
        return jsonify({"success": False, "data": {}, "error": "Comment not found"}), 404
    comment.status = "approved"
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify(
        {"success": True, "data": {"id": comment.id, "status": comment.status}, "error": ""}
    ), 200


@admin_bp.route("/comments/<int:comment_id>/reject", methods=["PUT"])
@roles_required("admin")
def admin_reject_comment(comment_id: int) -> tuple:
    """댓글 스팸 처리 — pending/approved → spam."""
    comment: Comment | None = db.session.get(Comment, comment_id)
    if not comment:
        return jsonify({"success": False, "data": {}, "error": "Comment not found"}), 404
    comment.status = "spam"
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify(
        {"success": True, "data": {"id": comment.id, "status": comment.status}, "error": ""}
    ), 200


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
        return jsonify(
            {"success": False, "data": {}, "error": "본인의 권한은 변경할 수 없습니다."}
        ), 403
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    data: dict = request.get_json() or {}
    role = data.get("role")
    if role not in ("editor", "admin"):
        return jsonify(
            {"success": False, "data": {}, "error": "유효하지 않은 권한입니다. (editor 또는 admin)"}
        ), 400
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
        return jsonify(
            {"success": False, "data": {}, "error": "본인을 비활성화할 수 없습니다."}
        ), 403
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    user.role = "deactivated"
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify(
        {"success": True, "data": {"id": user.id, "role": "deactivated"}, "error": ""}
    ), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@roles_required("admin")
def admin_delete_user(user_id: int) -> tuple:
    """회원 삭제. 해당 회원의 포스트 author_id는 NULL 처리."""
    current_user_id: int = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify(
            {"success": False, "data": {}, "error": "본인 계정은 삭제할 수 없습니다."}
        ), 403
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    db.session.execute(update(Post).where(Post.author_id == user_id).values(author_id=None))
    db.session.execute(update(Comment).where(Comment.author_id == user_id).values(author_id=None))
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
    posts = (
        db.session.execute(
            select(Post).where(Post.author_id == user_id).order_by(Post.created_at.desc())
        )
        .scalars()
        .all()
    )
    data = [
        {
            "id": p.id,
            "title": p.title,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in posts
    ]
    return jsonify({"success": True, "data": data, "error": ""}), 200


@admin_bp.route("/comments", methods=["GET"])
@roles_required("admin")
def admin_list_comments() -> tuple:
    """관리자 전용 — 전체 댓글 목록 (post_title 포함, 페이지네이션)."""
    status_filter = request.args.get("status")
    page, per_page, offset = get_pagination_params()

    count_query = select(func.count(Comment.id)).join(Post, Comment.post_id == Post.id)
    if status_filter:
        count_query = count_query.where(Comment.status == status_filter)
    total: int = db.session.execute(count_query).scalar() or 0

    query = (
        select(Comment, Post.title.label("post_title"))
        .join(Post, Comment.post_id == Post.id)
        .order_by(Comment.created_at.desc())
    )
    if status_filter:
        query = query.where(Comment.status == status_filter)

    rows = db.session.execute(query.offset(offset).limit(per_page)).all()
    items = []
    for comment, post_title in rows:
        d = comment.to_dict()
        d["post_title"] = post_title
        items.append(d)

    return jsonify(
        {
            "success": True,
            "data": {
                "items": items,
                "page": page,
                "per_page": per_page,
                "total": total,
                "has_more": page * per_page < total,
            },
            "error": "",
        }
    ), 200
