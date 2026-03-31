from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from api.decorators import roles_required
from database import db
from models.schema import Post, Series, SeriesPost, User

series_bp = Blueprint("series", __name__)


def _series_to_dict(s: Series, include_posts: bool = True) -> dict:
    result: dict = {
        "id": s.id,
        "title": s.title,
        "slug": s.slug,
        "description": s.description,
        "author_id": s.author_id,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "total": len(s.series_posts),
    }
    if include_posts:
        result["posts"] = [
            {"id": sp.post.id, "title": sp.post.title, "order": sp.order} for sp in s.series_posts
        ]
    return result


def _check_owner(s: Series) -> bool:
    """현재 JWT 유저가 시리즈 소유자 또는 admin인지 확인."""
    current_user_id: int = int(get_jwt_identity())
    user: User | None = db.session.get(User, current_user_id)
    return bool(user and (user.role == "admin" or s.author_id == current_user_id))


@series_bp.route("/api/series", methods=["POST"])
@roles_required("editor", "admin")
def create_series() -> tuple:
    data: dict = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"success": False, "data": {}, "error": "title is required"}), 400

    author_id: int = int(get_jwt_identity())
    base_slug = slugify(title, allow_unicode=False) or f"series-{author_id}"
    slug = base_slug
    # slug 중복 시 suffix 추가
    attempt = 1
    while db.session.execute(select(Series).where(Series.slug == slug)).scalar_one_or_none():
        slug = f"{base_slug}-{attempt}"
        attempt += 1

    s = Series(
        author_id=author_id,
        title=title,
        slug=slug,
        description=data.get("description") or None,
    )
    db.session.add(s)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "slug 충돌이 발생했습니다."}), 409
    return jsonify({"success": True, "data": _series_to_dict(s), "error": ""}), 201


@series_bp.route("/api/series/<int:series_id>", methods=["GET"])
def get_series(series_id: int) -> tuple:
    s: Series | None = db.session.get(Series, series_id)
    if not s:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    return jsonify({"success": True, "data": _series_to_dict(s), "error": ""}), 200


@series_bp.route("/api/users/<username>/series", methods=["GET"])
def get_user_series(username: str) -> tuple:
    user: User | None = db.session.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()
    if not user or user.role == "deactivated":
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404

    series_list = (
        db.session.execute(
            select(Series).where(Series.author_id == user.id).order_by(Series.created_at.desc())
        )
        .scalars()
        .all()
    )
    return jsonify(
        {
            "success": True,
            "data": [_series_to_dict(s, include_posts=False) for s in series_list],
            "error": "",
        }
    ), 200


@series_bp.route("/api/series/<int:series_id>", methods=["PUT"])
@jwt_required()
def update_series(series_id: int) -> tuple:
    s: Series | None = db.session.get(Series, series_id)
    if not s:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    if not _check_owner(s):
        return jsonify({"success": False, "data": {}, "error": "권한이 없습니다."}), 403

    data: dict = request.get_json() or {}
    if "title" in data:
        s.title = data["title"]
    if "description" in data:
        s.description = data["description"] or None
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": _series_to_dict(s), "error": ""}), 200


@series_bp.route("/api/series/<int:series_id>", methods=["DELETE"])
@jwt_required()
def delete_series(series_id: int) -> tuple:
    s: Series | None = db.session.get(Series, series_id)
    if not s:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    if not _check_owner(s):
        return jsonify({"success": False, "data": {}, "error": "권한이 없습니다."}), 403

    db.session.delete(s)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200


@series_bp.route("/api/series/<int:series_id>/posts", methods=["POST"])
@jwt_required()
def add_series_post(series_id: int) -> tuple:
    s: Series | None = db.session.get(Series, series_id)
    if not s:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    if not _check_owner(s):
        return jsonify({"success": False, "data": {}, "error": "권한이 없습니다."}), 403

    data: dict = request.get_json() or {}
    post_id = data.get("post_id")
    if not post_id:
        return jsonify({"success": False, "data": {}, "error": "post_id is required"}), 400

    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Post not found"}), 404

    order: int = data.get("order", 0)
    sp = SeriesPost(series_id=series_id, post_id=post_id, order=order)
    db.session.add(sp)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "이미 추가된 포스트입니다."}), 409
    db.session.refresh(s)
    return jsonify({"success": True, "data": _series_to_dict(s), "error": ""}), 201


@series_bp.route("/api/series/<int:series_id>/posts/<int:post_id>", methods=["DELETE"])
@jwt_required()
def remove_series_post(series_id: int, post_id: int) -> tuple:
    s: Series | None = db.session.get(Series, series_id)
    if not s:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    if not _check_owner(s):
        return jsonify({"success": False, "data": {}, "error": "권한이 없습니다."}), 403

    sp: SeriesPost | None = db.session.execute(
        select(SeriesPost).where(SeriesPost.series_id == series_id, SeriesPost.post_id == post_id)
    ).scalar_one_or_none()
    if not sp:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404

    db.session.delete(sp)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200


@series_bp.route("/api/series/<int:series_id>/posts/reorder", methods=["PUT"])
@jwt_required()
def reorder_series_posts(series_id: int) -> tuple:
    s: Series | None = db.session.get(Series, series_id)
    if not s:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    if not _check_owner(s):
        return jsonify({"success": False, "data": {}, "error": "권한이 없습니다."}), 403

    data: dict = request.get_json() or {}
    items: list = data.get("items", [])
    for item in items:
        pid = item.get("post_id")
        new_order = item.get("order")
        if pid is None or new_order is None:
            continue
        sp: SeriesPost | None = db.session.execute(
            select(SeriesPost).where(SeriesPost.series_id == series_id, SeriesPost.post_id == pid)
        ).scalar_one_or_none()
        if sp:
            sp.order = new_order
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    db.session.refresh(s)
    return jsonify({"success": True, "data": _series_to_dict(s), "error": ""}), 200
