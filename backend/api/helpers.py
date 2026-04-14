from __future__ import annotations

from typing import TYPE_CHECKING

from flask import jsonify, request
from werkzeug.security import check_password_hash

if TYPE_CHECKING:
    from models import Comment


def get_client_ip() -> str:
    """클라이언트 IP 추출 — 조작 불가 순서로 우선순위 적용.

    1. X-Real-IP: Nginx가 설정한 신뢰 가능한 헤더
    2. request.remote_addr: 직접 연결 IP (조작 불가)
    """
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()[:45]
    return (request.remote_addr or "unknown")[:45]


def get_pagination_params() -> tuple[int, int, int]:
    """페이지네이션 파라미터 추출 — page, per_page, offset."""
    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
    return page, per_page, (page - 1) * per_page


def verify_guest_auth(comment: Comment, data: dict) -> tuple | None:
    """게스트 댓글 인증 — 이메일+패스워드 검증.

    성공 시 None 반환, 실패 시 (Response, status_code) tuple 반환.
    호출부: ``err = verify_guest_auth(comment, data); if err: return err``
    """
    author_email: str = (data.get("author_email") or "").strip()
    author_password: str = (data.get("author_password") or "").strip()
    if not author_email or not author_password:
        return (
            jsonify({"success": False, "data": {}, "error": "이메일과 패스워드를 입력하세요."}),
            400,
        )
    if (
        comment.author_id is not None
        or comment.author_email != author_email
        or not comment.author_password_hash
        or not check_password_hash(comment.author_password_hash, author_password)
    ):
        return (
            jsonify(
                {"success": False, "data": {}, "error": "이메일 또는 패스워드가 올바르지 않습니다."}
            ),
            401,
        )
    return None


def success_response(data: dict | list, status: int = 200) -> tuple:
    return jsonify({"success": True, "data": data, "error": ""}), status


def error_response(msg: str, status: int = 400) -> tuple:
    return jsonify({"success": False, "data": {}, "error": msg}), status
