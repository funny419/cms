from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, select

from api.decorators import roles_required
from database import db
from models.schema import Comment, Follow, Post, User, VisitLog

stats_bp = Blueprint("stats", __name__)


def _get_stats(user: User, days: int) -> dict:
    since = datetime.utcnow() - timedelta(days=days)

    # 일별 방문자 집계
    daily = db.session.execute(
        select(
            func.date(VisitLog.visited_at).label("date"),
            func.count(VisitLog.id).label("count"),
        )
        .join(Post, VisitLog.post_id == Post.id)
        .where(Post.author_id == user.id)
        .where(VisitLog.visited_at >= since)
        .group_by(func.date(VisitLog.visited_at))
        .order_by(func.date(VisitLog.visited_at))
    ).all()

    # Top 10 포스트 (view_count 기준)
    top_posts = db.session.execute(
        select(Post.id, Post.title, Post.view_count, Post.slug)
        .where(Post.author_id == user.id)
        .where(Post.status == "published")
        .order_by(Post.view_count.desc())
        .limit(10)
    ).all()

    # 전체 통계
    total_views: int = (
        db.session.execute(
            select(func.count(VisitLog.id))
            .join(Post, VisitLog.post_id == Post.id)
            .where(Post.author_id == user.id)
        ).scalar()
        or 0
    )

    post_count: int = (
        db.session.execute(
            select(func.count(Post.id))
            .where(Post.author_id == user.id)
            .where(Post.status == "published")
        ).scalar()
        or 0
    )

    follower_count: int = (
        db.session.execute(
            select(func.count(Follow.id)).where(Follow.following_id == user.id)
        ).scalar()
        or 0
    )

    # 전체 댓글수 (포스트 기준)
    comment_count: int = (
        db.session.execute(
            select(func.count(Comment.id))
            .join(Post, Comment.post_id == Post.id)
            .where(Post.author_id == user.id)
            .where(Comment.status == "approved")
        ).scalar()
        or 0
    )

    return {
        "daily": [{"date": str(r.date), "count": r.count} for r in daily],
        "top_posts": [
            {"id": r.id, "title": r.title, "view_count": r.view_count, "slug": r.slug}
            for r in top_posts
        ],
        "total_views": total_views,
        "total_posts": post_count,
        "follower_count": follower_count,
        "total_comments": comment_count,
    }


@stats_bp.route("/api/blog/<username>/stats", methods=["GET"])
@jwt_required()
def get_blog_stats(username: str) -> tuple:
    current_user_id: int = int(get_jwt_identity())
    current_user: User | None = db.session.get(User, current_user_id)

    target: User | None = db.session.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()
    if not target or target.role == "deactivated":
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404

    # 본인 또는 admin만 조회 가능
    if target.id != current_user_id and (not current_user or current_user.role != "admin"):
        return jsonify({"success": False, "data": {}, "error": "권한이 없습니다."}), 403

    period = request.args.get("period", "7d")
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)

    return jsonify({"success": True, "data": _get_stats(target, days), "error": ""}), 200


@stats_bp.route("/api/admin/stats/<username>", methods=["GET"])
@roles_required("admin")
def get_admin_stats(username: str) -> tuple:
    target: User | None = db.session.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()
    if not target:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404

    period = request.args.get("period", "7d")
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)

    return jsonify({"success": True, "data": _get_stats(target, days), "error": ""}), 200
