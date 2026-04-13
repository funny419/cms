from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from api.helpers import get_pagination_params
from database import db
from models import Follow, Post, User

follows_bp = Blueprint("follows", __name__, url_prefix="/api/users")
feed_bp = Blueprint("feed", __name__, url_prefix="/api")


@follows_bp.route("/<username>/follow", methods=["POST"])
@jwt_required()
def follow_user(username: str) -> tuple:
    """팔로우."""
    current_user_id: int = int(get_jwt_identity())
    target: User | None = db.session.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()

    if not target or target.role == "deactivated":
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404

    if target.id == current_user_id:
        return jsonify({"success": False, "data": {}, "error": "자신을 팔로우할 수 없습니다."}), 400

    existing = db.session.execute(
        select(Follow)
        .where(Follow.follower_id == current_user_id)
        .where(Follow.following_id == target.id)
    ).scalar_one_or_none()

    if existing:
        return jsonify({"success": True, "data": {"following": True}, "error": ""}), 200

    follow = Follow(follower_id=current_user_id, following_id=target.id)
    db.session.add(follow)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": True, "data": {"following": True}, "error": ""}), 200

    return jsonify({"success": True, "data": {"following": True}, "error": ""}), 201


@follows_bp.route("/<username>/follow", methods=["DELETE"])
@jwt_required()
def unfollow_user(username: str) -> tuple:
    """언팔로우."""
    current_user_id: int = int(get_jwt_identity())
    target: User | None = db.session.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()

    if not target:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404

    existing = db.session.execute(
        select(Follow)
        .where(Follow.follower_id == current_user_id)
        .where(Follow.following_id == target.id)
    ).scalar_one_or_none()

    if existing:
        db.session.delete(existing)
        db.session.commit()

    return jsonify({"success": True, "data": {"following": False}, "error": ""}), 200


@follows_bp.route("/<username>/followers", methods=["GET"])
def list_followers(username: str) -> tuple:
    """팔로워 목록 (페이지네이션)."""
    target: User | None = db.session.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()
    if not target:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404

    page, per_page, offset = get_pagination_params()

    total: int = (
        db.session.execute(
            select(func.count(Follow.id))
            .join(User, User.id == Follow.follower_id)
            .where(Follow.following_id == target.id)
            .where(User.role != "deactivated")
        ).scalar()
        or 0
    )

    followers = (
        db.session.execute(
            select(User)
            .join(Follow, Follow.follower_id == User.id)
            .where(Follow.following_id == target.id)
            .where(User.role != "deactivated")
            .order_by(Follow.created_at.desc())
            .offset(offset)
            .limit(per_page)
        )
        .scalars()
        .all()
    )

    items = [{"id": u.id, "username": u.username, "avatar_url": u.avatar_url} for u in followers]
    return jsonify(
        {
            "success": True,
            "data": {"items": items, "total": total, "has_more": page * per_page < total},
            "error": "",
        }
    ), 200


@follows_bp.route("/<username>/following", methods=["GET"])
def list_following(username: str) -> tuple:
    """팔로잉 목록 (페이지네이션)."""
    target: User | None = db.session.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()
    if not target:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404

    page, per_page, offset = get_pagination_params()

    total: int = (
        db.session.execute(
            select(func.count(Follow.id))
            .join(User, User.id == Follow.following_id)
            .where(Follow.follower_id == target.id)
            .where(User.role != "deactivated")
        ).scalar()
        or 0
    )

    following = (
        db.session.execute(
            select(User)
            .join(Follow, Follow.following_id == User.id)
            .where(Follow.follower_id == target.id)
            .where(User.role != "deactivated")
            .order_by(Follow.created_at.desc())
            .offset(offset)
            .limit(per_page)
        )
        .scalars()
        .all()
    )

    items = [{"id": u.id, "username": u.username, "avatar_url": u.avatar_url} for u in following]
    return jsonify(
        {
            "success": True,
            "data": {"items": items, "total": total, "has_more": page * per_page < total},
            "error": "",
        }
    ), 200


@feed_bp.route("/feed", methods=["GET"])
@jwt_required()
def get_feed() -> tuple:
    """이웃 피드 — 팔로우한 사람들의 최신 포스트."""
    current_user_id: int = int(get_jwt_identity())

    page, per_page, offset = get_pagination_params()

    base = (
        select(Post)
        .join(Follow, Follow.following_id == Post.author_id)
        .where(Follow.follower_id == current_user_id)
        .where(Post.status == "published")
        .where(
            or_(
                Post.visibility == "public",
                Post.visibility == "members_only",
            )
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
