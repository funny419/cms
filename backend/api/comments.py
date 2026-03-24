from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Comment
from database import db

comments_bp = Blueprint("comments", __name__, url_prefix="/api/comments")

SPAM_KEYWORDS = ["casino", "viagra", "click here", "free money", "대출", "도박"]


def _is_spam(content: str) -> bool:
    lower = content.lower()
    return any(kw in lower for kw in SPAM_KEYWORDS)


@comments_bp.route("", methods=["POST"])
def create_comment() -> tuple:
    """댓글 작성 — 로그인 불필요 (게스트 작성 가능)."""
    data: dict = request.get_json() or {}
    if not data.get("post_id") or not data.get("content"):
        return jsonify({"success": False, "data": {}, "error": "post_id and content are required"}), 400
    if not data.get("author_name"):
        return jsonify({"success": False, "data": {}, "error": "author_name is required"}), 400

    content: str = data["content"]
    status = "spam" if _is_spam(content) else "pending"

    try:
        verify_jwt_in_request(optional=True)
        raw_id = get_jwt_identity()
        author_id = int(raw_id) if raw_id else None
    except Exception:
        author_id = None

    comment = Comment(
        post_id=data["post_id"],
        author_id=author_id,
        parent_id=data.get("parent_id"),
        author_name=data["author_name"],
        author_email=data.get("author_email", ""),
        content=content,
        status=status,
    )
    db.session.add(comment)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": comment.to_dict(), "error": ""}), 201


@comments_bp.route("/post/<int:post_id>", methods=["GET"])
def list_comments(post_id: int) -> tuple:
    """포스트별 승인된 댓글 목록 조회."""
    comments = db.session.execute(
        select(Comment).where(
            Comment.post_id == post_id,
            Comment.status == "approved"
        )
    ).scalars().all()
    return jsonify({"success": True, "data": [c.to_dict() for c in comments], "error": ""}), 200


@comments_bp.route("/<int:comment_id>/approve", methods=["PUT"])
@roles_required("admin", "editor")
def approve_comment(comment_id: int) -> tuple:
    """관리자/편집자 전용 — 댓글 승인."""
    comment: Comment | None = db.session.get(Comment, comment_id)
    if not comment:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    comment.status = "approved"
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": comment.to_dict(), "error": ""}), 200


@comments_bp.route("/<int:comment_id>", methods=["DELETE"])
@roles_required("admin")
def delete_comment(comment_id: int) -> tuple:
    """관리자 전용 — 댓글 삭제."""
    comment: Comment | None = db.session.get(Comment, comment_id)
    if not comment:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    db.session.delete(comment)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200
