from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Post
from database import db

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")


@posts_bp.route("", methods=["GET"])
def list_posts() -> tuple:
    """공개된 포스트 목록 조회."""
    posts = db.session.execute(
        select(Post).where(Post.status == "published")
    ).scalars().all()
    return jsonify({"success": True, "data": [p.to_dict() for p in posts], "error": ""}), 200


@posts_bp.route("/<int:post_id>", methods=["GET"])
def get_post(post_id: int) -> tuple:
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    return jsonify({"success": True, "data": post.to_dict(), "error": ""}), 200


@posts_bp.route("", methods=["POST"])
@roles_required("admin", "editor")
def create_post() -> tuple:
    data: dict = request.get_json() or {}
    if not data.get("title"):
        return jsonify({"success": False, "data": {}, "error": "title is required"}), 400
    author_id: int = int(get_jwt_identity())
    post = Post(
        title=data["title"],
        slug=data.get("slug", ""),
        content=data.get("content", ""),
        excerpt=data.get("excerpt", ""),
        status=data.get("status", "draft"),
        post_type=data.get("post_type", "post"),
        author_id=author_id,
    )
    db.session.add(post)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": post.to_dict(), "error": ""}), 201


@posts_bp.route("/<int:post_id>", methods=["PUT"])
@roles_required("admin", "editor")
def update_post(post_id: int) -> tuple:
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    data: dict = request.get_json() or {}
    for field in ("title", "slug", "content", "excerpt", "status", "post_type"):
        if field in data:
            setattr(post, field, data[field])
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": post.to_dict(), "error": ""}), 200


@posts_bp.route("/<int:post_id>", methods=["DELETE"])
@roles_required("admin")
def delete_post(post_id: int) -> tuple:
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    db.session.delete(post)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200
