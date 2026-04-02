from flask import jsonify, request


def get_pagination_params() -> tuple[int, int, int]:
    """페이지네이션 파라미터 추출 — page, per_page, offset."""
    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
    return page, per_page, (page - 1) * per_page


def success_response(data: dict | list, status: int = 200) -> tuple:
    return jsonify({"success": True, "data": data, "error": ""}), status


def error_response(msg: str, status: int = 400) -> tuple:
    return jsonify({"success": False, "data": {}, "error": msg}), status
