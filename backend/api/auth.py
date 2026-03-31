from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
    verify_jwt_in_request,
)
from sqlalchemy import func, select

from api.decorators import roles_required
from database import db
from models.schema import Follow, Post, User

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register() -> tuple:
    data = request.get_json()
    if not data or not data.get("username") or not data.get("email") or not data.get("password"):
        return jsonify({"success": False, "data": {}, "error": "Missing required fields"}), 400
    if db.session.execute(
        select(User).where(User.username == data["username"])
    ).scalar_one_or_none():
        return jsonify({"success": False, "data": {}, "error": "Username already exists"}), 400
    if db.session.execute(select(User).where(User.email == data["email"])).scalar_one_or_none():
        return jsonify({"success": False, "data": {}, "error": "Email already exists"}), 400
    new_user = User(username=data["username"], email=data["email"], role="editor")
    new_user.set_password(data["password"])
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify(
            {"success": True, "data": {"message": "User registered successfully"}, "error": ""}
        ), 201
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500


@auth_bp.route("/login", methods=["POST"])
def login() -> tuple:
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "data": {}, "error": "Missing request body"}), 400
    user = db.session.execute(
        select(User).where(User.username == data.get("username"))
    ).scalar_one_or_none()
    if user and user.check_password(data.get("password")):
        if user.role == "deactivated":
            return jsonify({"success": False, "data": {}, "error": "비활성화된 계정입니다."}), 401
        access_token = create_access_token(identity=str(user.id))
        return jsonify(
            {
                "success": True,
                "data": {"access_token": access_token, "user": user.to_dict()},
                "error": "",
            }
        ), 200
    return jsonify({"success": False, "data": {}, "error": "Invalid username or password"}), 401


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me() -> tuple:
    current_user_id: int = int(get_jwt_identity())
    user: User | None = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    return jsonify({"success": True, "data": user.to_dict(), "error": ""}), 200


@auth_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_me() -> tuple:
    current_user_id: int = int(get_jwt_identity())
    user: User | None = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    data: dict = request.get_json() or {}
    if "username" in data:
        existing = db.session.execute(
            select(User).where(User.username == data["username"])
        ).scalar_one_or_none()
        if existing and existing.id != current_user_id:
            return jsonify({"success": False, "data": {}, "error": "Username already exists"}), 400
        user.username = data["username"]
    if "email" in data:
        existing = db.session.execute(
            select(User).where(User.email == data["email"])
        ).scalar_one_or_none()
        if existing and existing.id != current_user_id:
            return jsonify({"success": False, "data": {}, "error": "Email already exists"}), 400
        user.email = data["email"]
    if "bio" in data:
        user.bio = data["bio"]
    if "avatar_url" in data:
        user.avatar_url = data["avatar_url"]
    if "blog_title" in data:
        user.blog_title = data["blog_title"] or None
    if "blog_color" in data:
        color = data["blog_color"]
        if color and (len(color) != 7 or not color.startswith("#")):
            return jsonify(
                {"success": False, "data": {}, "error": "blog_color는 #rrggbb 형식이어야 합니다."}
            ), 400
        user.blog_color = color or None
    if "website_url" in data:
        user.website_url = data["website_url"] or None
    if "social_links" in data:
        user.social_links = data["social_links"] or None
    if "blog_layout" in data:
        layout = data["blog_layout"]
        if layout and layout not in ("default", "compact"):
            return jsonify(
                {"success": False, "data": {}, "error": "허용되지 않는 layout 값입니다."}
            ), 400
        user.blog_layout = layout or None
    if "banner_image_url" in data:
        user.banner_image_url = data["banner_image_url"] or None
    try:
        db.session.commit()
        return jsonify({"success": True, "data": user.to_dict(), "error": ""}), 200
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500


@auth_bp.route("/users", methods=["GET"])
@roles_required("admin")
def list_users() -> tuple:
    users = db.session.execute(select(User)).scalars().all()
    return jsonify({"success": True, "data": [u.to_dict() for u in users], "error": ""}), 200


@auth_bp.route("/users/search", methods=["GET"])
def search_users() -> tuple:
    """작성자 자동완성용 유저 검색 (공개, username prefix 매칭)."""
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"success": True, "data": {"items": []}, "error": ""}), 200

    users = (
        db.session.execute(
            select(User)
            .where(User.username.ilike(f"{q}%"))
            .where(User.role != "deactivated")
            .order_by(User.username)
            .limit(10)
        )
        .scalars()
        .all()
    )

    items = [{"id": u.id, "username": u.username} for u in users]
    return jsonify({"success": True, "data": {"items": items}, "error": ""}), 200


@auth_bp.route("/users/<username>", methods=["GET"])
def get_user_profile(username: str) -> tuple:
    """유저 블로그 프로필 조회 — 비로그인도 접근 가능."""
    user: User | None = db.session.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()

    if not user or user.role == "deactivated":
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404

    post_count: int = (
        db.session.execute(
            select(func.count(Post.id)).where(
                (Post.author_id == user.id)
                & (Post.status == "published")
                & (Post.visibility.in_(["public", "members_only"]))
            )
        ).scalar()
        or 0
    )

    # 팔로워/팔로잉 수
    follower_count: int = (
        db.session.execute(
            select(func.count(Follow.id)).where(Follow.following_id == user.id)
        ).scalar()
        or 0
    )
    following_count: int = (
        db.session.execute(
            select(func.count(Follow.id)).where(Follow.follower_id == user.id)
        ).scalar()
        or 0
    )

    # 현재 로그인 유저의 팔로우 여부 (optional JWT)
    is_following: bool = False
    try:
        verify_jwt_in_request(optional=True)
        raw_id = get_jwt_identity()
        viewer_id = int(raw_id) if raw_id else None
    except Exception:
        viewer_id = None

    if viewer_id and viewer_id != user.id:
        is_following = bool(
            db.session.execute(
                select(Follow)
                .where(Follow.follower_id == viewer_id)
                .where(Follow.following_id == user.id)
            ).scalar_one_or_none()
        )

    d = user.to_dict()
    d["post_count"] = post_count
    d["follower_count"] = follower_count
    d["following_count"] = following_count
    d["is_following"] = is_following
    return jsonify({"success": True, "data": d, "error": ""}), 200
