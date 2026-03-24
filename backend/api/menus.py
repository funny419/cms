from flask import Blueprint, request, jsonify
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Menu, MenuItem
from database import db

menus_bp = Blueprint("menus", __name__, url_prefix="/api/menus")


@menus_bp.route("", methods=["GET"])
def list_menus() -> tuple:
    """전체 메뉴 목록 조회 (공개)."""
    menus = db.session.execute(select(Menu)).scalars().all()
    return jsonify({
        "success": True,
        "data": [{"id": m.id, "name": m.name, "location": m.location} for m in menus],
        "error": ""
    }), 200


@menus_bp.route("/<int:menu_id>/items", methods=["GET"])
def get_menu_items(menu_id: int) -> tuple:
    """메뉴의 아이템 목록 조회 (공개, order 순 정렬)."""
    menu: Menu | None = db.session.get(Menu, menu_id)
    if not menu:
        return jsonify({"success": False, "data": {}, "error": "Menu not found"}), 404
    items = db.session.execute(
        select(MenuItem)
        .where(MenuItem.menu_id == menu_id)
        .order_by(MenuItem.order)
    ).scalars().all()
    return jsonify({
        "success": True,
        "data": [
            {"id": i.id, "title": i.title, "url": i.url, "parent_id": i.parent_id, "order": i.order}
            for i in items
        ],
        "error": ""
    }), 200


@menus_bp.route("", methods=["POST"])
@roles_required("admin")
def create_menu() -> tuple:
    """관리자 전용 — 메뉴 생성."""
    data: dict = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"success": False, "data": {}, "error": "name is required"}), 400
    menu = Menu(name=data["name"], location=data.get("location"))
    db.session.add(menu)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({
        "success": True,
        "data": {"id": menu.id, "name": menu.name, "location": menu.location},
        "error": ""
    }), 201


@menus_bp.route("/<int:menu_id>/items", methods=["POST"])
@roles_required("admin")
def create_menu_item(menu_id: int) -> tuple:
    """관리자 전용 — 메뉴 아이템 추가."""
    menu: Menu | None = db.session.get(Menu, menu_id)
    if not menu:
        return jsonify({"success": False, "data": {}, "error": "Menu not found"}), 404
    data: dict = request.get_json() or {}
    if not data.get("title") or not data.get("url"):
        return jsonify({"success": False, "data": {}, "error": "title and url are required"}), 400
    item = MenuItem(
        menu_id=menu_id,
        parent_id=data.get("parent_id"),
        title=data["title"],
        url=data["url"],
        order=data.get("order", 0),
    )
    db.session.add(item)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({
        "success": True,
        "data": {"id": item.id, "title": item.title, "url": item.url, "parent_id": item.parent_id, "order": item.order},
        "error": ""
    }), 201
