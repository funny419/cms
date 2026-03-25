from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Comment, User
from database import db
from werkzeug.security import generate_password_hash, check_password_hash

comments_bp = Blueprint("comments", __name__, url_prefix="/api/comments")

SPAM_KEYWORDS = ["casino", "viagra", "click here", "free money", "대출", "도박"]


def _is_spam(content: str) -> bool:
    lower = content.lower()
    return any(kw in lower for kw in SPAM_KEYWORDS)


@comments_bp.route("", methods=["POST"])
def create_comment() -> tuple:
    """댓글 작성 — 로그인 사용자(즉시 공개) 또는 게스트(이름+이메일+패스워드 필수, 승인 대기)."""
    data: dict = request.get_json() or {}
    post_id = data.get("post_id")
    content: str = (data.get("content") or "").strip()

    if not post_id or not content:
        return jsonify({"success": False, "data": {}, "error": "post_id and content are required"}), 400
    if len(content) > 2000:
        return jsonify({"success": False, "data": {}, "error": "댓글은 2000자 이하여야 합니다."}), 400

    # parent_id 유효성 검사
    parent_id = data.get("parent_id")
    if parent_id:
        parent: Comment | None = db.session.get(Comment, parent_id)
        if not parent:
            return jsonify({"success": False, "data": {}, "error": "부모 댓글을 찾을 수 없습니다."}), 404
        if parent.post_id != post_id:
            return jsonify({"success": False, "data": {}, "error": "잘못된 parent_id입니다."}), 400
        if parent.parent_id is not None:
            return jsonify({"success": False, "data": {}, "error": "답글에는 답글을 달 수 없습니다."}), 400

    # JWT 확인 (optional)
    try:
        verify_jwt_in_request(optional=True)
        raw_id = get_jwt_identity()
    except Exception:
        raw_id = None

    if raw_id:
        # 로그인 사용자
        user: User | None = db.session.get(User, int(raw_id))
        if not user or user.role == "deactivated":
            return jsonify({"success": False, "data": {}, "error": "Permission denied"}), 403
        comment = Comment(
            post_id=post_id,
            author_id=user.id,
            parent_id=parent_id,
            author_name=user.username,
            author_email="",
            author_password_hash=None,
            content=content,
            status="approved",
        )
    else:
        # 게스트
        author_name: str = (data.get("author_name") or "").strip()
        author_email: str = (data.get("author_email") or "").strip()
        author_password: str = (data.get("author_password") or "").strip()
        if not author_name or not author_email or not author_password:
            return jsonify({"success": False, "data": {}, "error": "게스트 댓글은 이름, 이메일, 패스워드가 필요합니다."}), 400

        status = "spam" if _is_spam(content) else "pending"
        comment = Comment(
            post_id=post_id,
            author_id=None,
            parent_id=parent_id,
            author_name=author_name,
            author_email=author_email,
            author_password_hash=generate_password_hash(author_password),
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
