from functools import wraps
from typing import Callable
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from models import User
from database import db


def roles_required(*roles: str) -> Callable:
    """JWT 토큰의 사용자 역할을 검증하는 데코레이터.

    사용법:
        @roles_required("admin")
        @roles_required("admin", "editor")
    """
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id: int = get_jwt_identity()
            user: User | None = db.session.get(User, user_id)
            if not user or user.role not in roles:
                return jsonify({
                    "success": False,
                    "data": {},
                    "error": "Permission denied"
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator