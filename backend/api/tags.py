from flask import Blueprint, jsonify, request
from slugify import slugify
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from api.decorators import roles_required
from database import db
from models import Post, PostTag, Tag

tags_bp = Blueprint("tags", __name__, url_prefix="/api/tags")


@tags_bp.route("", methods=["GET"])
def list_tags() -> tuple:
    """태그 목록 (포스트 수 포함)."""
    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 50, type=int) or 50), 100)
    offset = (page - 1) * per_page

    count_sq = (
        select(func.count(PostTag.id))
        .where(PostTag.tag_id == Tag.id)
        .correlate(Tag)
        .scalar_subquery()
    )
    total: int = db.session.execute(select(func.count(Tag.id))).scalar() or 0
    rows = db.session.execute(
        select(Tag, count_sq.label("post_count"))
        .order_by(count_sq.desc())
        .offset(offset)
        .limit(per_page)
    ).all()

    items = [t.to_dict(post_count=pc or 0) for t, pc in rows]
    return jsonify({"success": True, "data": {"items": items, "total": total}, "error": ""}), 200


@tags_bp.route("", methods=["POST"])
@roles_required("admin")
def create_tag() -> tuple:
    """태그 생성 (admin only)."""
    data: dict = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"success": False, "data": {}, "error": "name is required"}), 400

    slug = data.get("slug") or slugify(name, allow_unicode=False)
    tag = Tag(name=name, slug=slug)
    db.session.add(tag)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "Tag already exists"}), 400
    return jsonify({"success": True, "data": tag.to_dict(), "error": ""}), 201


@tags_bp.route("/<int:tag_id>", methods=["GET"])
def get_tag(tag_id: int) -> tuple:
    """태그 단건."""
    tag: Tag | None = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({"success": False, "data": {}, "error": "Tag not found"}), 404
    post_count: int = (
        db.session.execute(select(func.count(PostTag.id)).where(PostTag.tag_id == tag_id)).scalar()
        or 0
    )
    return jsonify({"success": True, "data": tag.to_dict(post_count=post_count), "error": ""}), 200


@tags_bp.route("/<int:tag_id>", methods=["DELETE"])
@roles_required("admin")
def delete_tag(tag_id: int) -> tuple:
    """태그 삭제."""
    tag: Tag | None = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({"success": False, "data": {}, "error": "Tag not found"}), 404
    db.session.delete(tag)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200


@tags_bp.route("/<int:tag_id>/posts", methods=["GET"])
def list_tag_posts(tag_id: int) -> tuple:
    """태그별 포스트 목록."""
    from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
    from sqlalchemy import or_

    from models import User

    tag: Tag | None = db.session.get(Tag, tag_id)
    if not tag:
        return jsonify({"success": False, "data": {}, "error": "Tag not found"}), 404

    try:
        verify_jwt_in_request(optional=True)
        raw_id = get_jwt_identity()
        current_user_id = int(raw_id) if raw_id else None
    except Exception:
        current_user_id = None

    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
    offset = (page - 1) * per_page

    base = (
        select(Post)
        .join(PostTag, PostTag.post_id == Post.id)
        .where(PostTag.tag_id == tag_id)
        .where(Post.status == "published")
    )
    if current_user_id is None:
        base = base.where(Post.visibility == "public")
    else:
        _user = db.session.get(User, current_user_id)
        if not (_user and _user.role == "admin"):
            base = base.where(
                or_(
                    Post.visibility == "public",
                    Post.visibility == "members_only",
                    (Post.visibility == "private") & (Post.author_id == current_user_id),
                )
            )

    total: int = db.session.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
    posts = (
        db.session.execute(base.order_by(Post.created_at.desc()).offset(offset).limit(per_page))
        .scalars()
        .all()
    )

    return jsonify(
        {
            "success": True,
            "data": {
                "items": [p.to_dict() for p in posts],
                "page": page,
                "per_page": per_page,
                "total": total,
                "has_more": page * per_page < total,
            },
            "error": "",
        }
    ), 200
