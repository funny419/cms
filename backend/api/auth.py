from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from sqlalchemy import select

from api.decorators import roles_required
from database import db
from models import User

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
