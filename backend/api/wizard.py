import os
import subprocess

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import select

from database import db
from models import Option, User

wizard_bp = Blueprint("wizard", __name__, url_prefix="/api/wizard")

ENV_PATH = os.environ.get("WIZARD_ENV_PATH", "/app/.env")


def _wizard_completed() -> bool:
    """WIZARD_COMPLETED 환경변수 또는 admin 계정 존재 여부로 완료 판단."""
    if os.environ.get("WIZARD_COMPLETED") == "true":
        return True
    return _has_admin()


def _has_admin() -> bool:
    """admin 계정이 존재하는지 확인."""
    try:
        return (
            db.session.execute(select(User).where(User.role == "admin")).scalar_one_or_none()
            is not None
        )
    except Exception:
        return False


def _db_connected() -> bool:
    """DB 연결 상태 확인."""
    try:
        db.session.execute(db.text("SELECT 1"))
        return True
    except Exception:
        return False


def _migration_done() -> bool:
    """flask db current 출력에 (head) 포함 여부로 마이그레이션 완료 판단."""
    try:
        result = subprocess.run(
            ["flask", "db", "current"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        return result.returncode == 0 and "(head)" in result.stdout
    except Exception:
        return False


def _current_step(db_connected: bool, has_admin: bool) -> int:
    """현재 Wizard 단계 번호 반환.

    1: DB 연결 정보 입력 필요
    3: DB 연결됨 + 마이그레이션 필요
    4: 마이그레이션 완료 + 관리자 계정 생성 필요
    5: 완료
    """
    if not db_connected:
        return 1
    if not _migration_done():
        return 3
    if not has_admin:
        return 4
    return 5


@wizard_bp.route("/status", methods=["GET"])
def get_wizard_status() -> tuple:
    """Setup Wizard 완료 여부 및 DB 연결 상태 반환 (공개 엔드포인트)."""
    try:
        db_connected = _db_connected()
        has_admin = _has_admin() if db_connected else False
        completed = (os.environ.get("WIZARD_COMPLETED") == "true") or has_admin
        step = 5 if completed else _current_step(db_connected, has_admin)
        return (
            jsonify(
                {
                    "success": True,
                    "data": {
                        "completed": completed,
                        "db_connected": db_connected,
                        "has_admin": has_admin,
                        "step": step,
                    },
                    "error": "",
                }
            ),
            200,
        )
    except Exception:
        return (
            jsonify(
                {
                    "success": True,
                    "data": {
                        "completed": False,
                        "db_connected": False,
                        "has_admin": False,
                        "step": 1,
                    },
                    "error": "",
                }
            ),
            200,
        )


@wizard_bp.route("/setup", methods=["POST"])
def setup_wizard() -> tuple:
    """관리자 계정 생성 + 사이트 설정 저장 (공개 엔드포인트, 1회만 허용)."""
    # 이미 완료된 경우 차단
    if _wizard_completed():
        return (
            jsonify({"success": False, "data": {}, "error": "Setup already completed."}),
            409,
        )

    data: dict = request.get_json() or {}
    admin_data: dict = data.get("admin", {})
    site_data: dict = data.get("site", {})

    # 필수 필드 검증
    username = admin_data.get("username", "").strip()
    email = admin_data.get("email", "").strip()
    password = admin_data.get("password", "")

    if not username or not email or not password:
        return (
            jsonify(
                {
                    "success": False,
                    "data": {},
                    "error": "username, email, password are required.",
                }
            ),
            400,
        )

    if len(password) < 8:
        return (
            jsonify(
                {
                    "success": False,
                    "data": {},
                    "error": "Password must be at least 8 characters.",
                }
            ),
            400,
        )

    # 중복 확인
    existing_username = db.session.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()
    if existing_username:
        return (
            jsonify({"success": False, "data": {}, "error": "Username already exists."}),
            400,
        )

    existing_email = db.session.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()
    if existing_email:
        return (
            jsonify({"success": False, "data": {}, "error": "Email already exists."}),
            400,
        )

    try:
        # admin 계정 생성
        admin_user = User(username=username, email=email, role="admin")
        admin_user.set_password(password)
        db.session.add(admin_user)

        # 사이트 설정 저장
        site_fields = {
            "site_title": site_data.get("site_title", ""),
            "site_url": site_data.get("site_url", ""),
            "tagline": site_data.get("tagline", ""),
        }
        for key, value in site_fields.items():
            if not value:
                continue
            option = db.session.execute(
                select(Option).where(Option.option_name == key)
            ).scalar_one_or_none()
            if option:
                option.option_value = value
            else:
                db.session.add(Option(option_name=key, option_value=value))

        db.session.commit()

        # .env 파일에 WIZARD_COMPLETED=true 기록
        _mark_wizard_completed()

        return jsonify({"success": True, "data": {}, "error": ""}), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error("Wizard setup failed: %s", str(e))
        return (
            jsonify({"success": False, "data": {}, "error": "An internal error occurred."}),
            500,
        )


def _mark_wizard_completed() -> None:
    """환경변수 설정 + .env 파일에 WIZARD_COMPLETED=true 추가."""
    os.environ["WIZARD_COMPLETED"] = "true"
    try:
        with open(ENV_PATH, "a") as f:
            f.write("\nWIZARD_COMPLETED=true\n")
        os.chmod(ENV_PATH, 0o600)
    except OSError as e:
        current_app.logger.warning("Could not write WIZARD_COMPLETED to .env: %s", str(e))
