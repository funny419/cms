from flask import Blueprint, jsonify, request
from slugify import slugify
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from api.decorators import roles_required
from database import db
from models.schema import MAX_CATEGORY_DEPTH, Category, Post

categories_bp = Blueprint("categories", __name__, url_prefix="/api/categories")


def _get_depth(category_id: int | None) -> int:
    """카테고리 깊이 계산 (루트=1)."""
    if not category_id:
        return 0
    depth = 0
    current_id: int | None = category_id
    while current_id is not None:
        cat: Category | None = db.session.get(Category, current_id)
        if not cat:
            break
        depth += 1
        current_id = cat.parent_id
        if depth > MAX_CATEGORY_DEPTH + 1:
            break
    return depth


@categories_bp.route("", methods=["GET"])
def list_categories() -> tuple:
    """카테고리 목록 (포스트 수 포함, flat list)."""
    count_sq = (
        select(func.count(Post.id))
        .where(Post.category_id == Category.id)
        .where(Post.status == "published")
        .correlate(Category)
        .scalar_subquery()
    )
    cats = db.session.execute(
        select(Category, count_sq.label("post_count")).order_by(
            Category.parent_id.asc().nulls_first(), Category.order.asc()
        )
    ).all()

    items = [c.to_dict(post_count=pc or 0) for c, pc in cats]
    return jsonify(
        {"success": True, "data": {"items": items, "total": len(items)}, "error": ""}
    ), 200


@categories_bp.route("", methods=["POST"])
@roles_required("admin")
def create_category() -> tuple:
    """카테고리 생성 (admin only, 깊이 3단 제한)."""
    data: dict = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"success": False, "data": {}, "error": "name is required"}), 400

    parent_id: int | None = data.get("parent_id")
    if parent_id:
        parent_depth = _get_depth(parent_id)
        if parent_depth >= MAX_CATEGORY_DEPTH:
            return jsonify(
                {
                    "success": False,
                    "data": {},
                    "error": f"카테고리 깊이는 {MAX_CATEGORY_DEPTH}단까지만 허용됩니다.",
                }
            ), 400

    existing = db.session.execute(
        select(Category).where((Category.name == name) & (Category.parent_id == parent_id))
    ).scalar_one_or_none()
    if existing:
        return jsonify(
            {
                "success": False,
                "data": {},
                "error": "같은 부모 카테고리 내에 같은 이름이 존재합니다.",
            }
        ), 400

    slug = data.get("slug") or slugify(name, allow_unicode=False)
    cat = Category(
        name=name,
        slug=slug,
        description=data.get("description"),
        parent_id=parent_id,
        order=data.get("order", 0),
    )
    db.session.add(cat)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "Slug already exists"}), 400
    return jsonify({"success": True, "data": cat.to_dict(), "error": ""}), 201


@categories_bp.route("/<int:cat_id>", methods=["GET"])
def get_category(cat_id: int) -> tuple:
    """카테고리 단건 + 자식 목록."""
    cat: Category | None = db.session.get(Category, cat_id)
    if not cat:
        return jsonify({"success": False, "data": {}, "error": "Category not found"}), 404
    post_count: int = (
        db.session.execute(
            select(func.count(Post.id))
            .where(Post.category_id == cat_id)
            .where(Post.status == "published")
        ).scalar()
        or 0
    )
    d = cat.to_dict(post_count=post_count)
    d["children"] = [c.to_dict() for c in cat.children]
    return jsonify({"success": True, "data": d, "error": ""}), 200


@categories_bp.route("/<int:cat_id>", methods=["PUT"])
@roles_required("admin")
def update_category(cat_id: int) -> tuple:
    """카테고리 수정."""
    cat: Category | None = db.session.get(Category, cat_id)
    if not cat:
        return jsonify({"success": False, "data": {}, "error": "Category not found"}), 404
    data: dict = request.get_json() or {}
    for field in ("name", "slug", "description", "parent_id", "order"):
        if field in data:
            setattr(cat, field, data[field])
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": cat.to_dict(), "error": ""}), 200


@categories_bp.route("/<int:cat_id>", methods=["DELETE"])
@roles_required("admin")
def delete_category(cat_id: int) -> tuple:
    """카테고리 삭제 (Post.category_id → NULL)."""
    cat: Category | None = db.session.get(Category, cat_id)
    if not cat:
        return jsonify({"success": False, "data": {}, "error": "Category not found"}), 404
    db.session.delete(cat)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200


@categories_bp.route("/<int:cat_id>/posts", methods=["GET"])
def list_category_posts(cat_id: int) -> tuple:
    """카테고리별 포스트 목록."""
    from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
    from sqlalchemy import or_

    from models.schema import User

    cat: Category | None = db.session.get(Category, cat_id)
    if not cat:
        return jsonify({"success": False, "data": {}, "error": "Category not found"}), 404

    try:
        verify_jwt_in_request(optional=True)
        raw_id = get_jwt_identity()
        current_user_id = int(raw_id) if raw_id else None
    except Exception:
        current_user_id = None

    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
    offset = (page - 1) * per_page

    base = select(Post).where(Post.category_id == cat_id).where(Post.status == "published")
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
