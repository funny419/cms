"""Setup Wizard Phase 2 — DB 연결 테스트, .env 동적 생성, 마이그레이션 실행."""

import os
import subprocess

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ArgumentError, OperationalError

wizard_phase2_bp = Blueprint("wizard_phase2", __name__, url_prefix="/api/wizard")

ENV_PATH = os.environ.get("WIZARD_ENV_PATH", "/app/.env")


def _test_db_connection(host: str, port: str, user: str, password: str, dbname: str) -> dict:
    """DB 연결 테스트 — 4종 오류 분류 반환."""
    url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_engine(
        url,
        pool_size=1,
        max_overflow=0,
        connect_args={"connect_timeout": 5},
    )
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True, "error": None}
    except ArgumentError:
        return {"ok": False, "error": "invalid_url"}
    except OperationalError as e:
        msg = str(e)
        if "Unknown database" in msg or ("Access denied" in msg and "to database" in msg):
            return {"ok": False, "error": "db_not_found"}
        if "Access denied" in msg:
            return {"ok": False, "error": "auth_failed"}
        if "Can't connect" in msg or "timed out" in msg or "Connection refused" in msg:
            return {"ok": False, "error": "host_unreachable"}
        return {"ok": False, "error": "unknown"}
    finally:
        engine.dispose()


def _write_env_file(
    host: str,
    port: str,
    user: str,
    password: str,
    dbname: str,
    secret_key: str = "",
    jwt_secret_key: str = "",
) -> None:
    """검증된 DB 정보로 .env 파일에 필요한 변수를 추가/업데이트."""
    db_url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{dbname}"

    entries: dict[str, str] = {
        "DATABASE_URL": db_url,
        "CMS_DB_USER": user,
        "CMS_DB_APP_PASSWORD": password,
        "CMS_DB_NAME": dbname,
        "DB_ENV_WRITTEN": "true",
    }
    if secret_key:
        entries["SECRET_KEY"] = secret_key
    if jwt_secret_key:
        entries["JWT_SECRET_KEY"] = jwt_secret_key

    # 기존 .env 파일 읽어 키 업데이트 (중복 방지)
    existing: dict[str, str] = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    existing[k.strip()] = v.strip()

    existing.update(entries)

    with open(ENV_PATH, "w") as f:
        for k, v in existing.items():
            f.write(f"{k}={v}\n")

    os.chmod(ENV_PATH, 0o600)


def _migration_done() -> bool:
    """alembic_version 테이블이 존재하고 현재 head인지 확인."""
    try:
        result = subprocess.run(
            ["flask", "db", "current"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode == 0 and "(head)" in result.stdout
    except Exception:
        return False


@wizard_phase2_bp.route("/db-test", methods=["POST"])
def db_test() -> tuple:
    """DB 연결 테스트 (공개 엔드포인트). 비밀번호는 응답에 절대 미포함."""
    data: dict = request.get_json() or {}
    host = data.get("host", "").strip()
    port = str(data.get("port", "3306")).strip()
    user = data.get("user", "").strip()
    password = data.get("password", "")
    dbname = data.get("dbname", "").strip()

    if not all([host, user, password, dbname]):
        return (
            jsonify(
                {
                    "success": False,
                    "data": {},
                    "error": "host, user, password, dbname are required.",
                }
            ),
            400,
        )

    result = _test_db_connection(host, port, user, password, dbname)
    current_app.logger.info(
        "DB connection test: host=%s port=%s user=%s dbname=%s ok=%s error=%s",
        host,
        port,
        user,
        dbname,
        result["ok"],
        result["error"],
    )
    status_code = 200 if result["ok"] else 400
    return (
        jsonify(
            {
                "success": result["ok"],
                "data": {"error_code": result["error"]},
                "error": result["error"] or "",
            }
        ),
        status_code,
    )


@wizard_phase2_bp.route("/env", methods=["POST"])
def save_env() -> tuple:
    """.env 파일에 DB 연결 정보 + 선택 보안 키 저장."""
    # DB_ENV_WRITTEN이 이미 설정된 경우 중복 방지
    if os.environ.get("DB_ENV_WRITTEN") == "true":
        return (
            jsonify({"success": True, "data": {"already_written": True}, "error": ""}),
            200,
        )

    data: dict = request.get_json() or {}
    host = data.get("host", "").strip()
    port = str(data.get("port", "3306")).strip()
    user = data.get("user", "").strip()
    password = data.get("password", "")
    dbname = data.get("dbname", "").strip()
    secret_key = data.get("secret_key", "").strip()
    jwt_secret_key = data.get("jwt_secret_key", "").strip()

    if not all([host, user, password, dbname]):
        return (
            jsonify(
                {
                    "success": False,
                    "data": {},
                    "error": "host, user, password, dbname are required.",
                }
            ),
            400,
        )

    # 저장 전 연결 재확인
    result = _test_db_connection(host, port, user, password, dbname)
    if not result["ok"]:
        return (
            jsonify(
                {
                    "success": False,
                    "data": {"error_code": result["error"]},
                    "error": result["error"] or "",
                }
            ),
            400,
        )

    try:
        _write_env_file(host, port, user, password, dbname, secret_key, jwt_secret_key)
        os.environ["DB_ENV_WRITTEN"] = "true"
    except OSError as e:
        current_app.logger.error("Failed to write .env: %s", str(e))
        return (
            jsonify({"success": False, "data": {}, "error": "Failed to write .env file."}),
            500,
        )

    return jsonify({"success": True, "data": {}, "error": ""}), 201


@wizard_phase2_bp.route("/migrate", methods=["POST"])
def run_migration() -> tuple:
    """DB 마이그레이션 실행 (flask db upgrade)."""
    if os.environ.get("WIZARD_COMPLETED") == "true":
        return (
            jsonify({"success": False, "data": {}, "error": "Wizard already completed."}),
            409,
        )
    try:
        result = subprocess.run(
            ["flask", "db", "upgrade"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            return jsonify({"success": True, "data": {}, "error": ""}), 200

        stderr = result.stderr
        # "already exists" → stamp head 후 재시도
        if "already exists" in stderr:
            stamp = subprocess.run(
                ["flask", "db", "stamp", "head"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if stamp.returncode != 0:
                current_app.logger.error("flask db stamp head failed: %s", stamp.stderr)
                return (
                    jsonify({"success": False, "data": {}, "error": "migration_stamp_failed"}),
                    500,
                )
            retry = subprocess.run(
                ["flask", "db", "upgrade"],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if retry.returncode == 0:
                return jsonify({"success": True, "data": {}, "error": ""}), 200
            current_app.logger.error("flask db upgrade retry failed: %s", retry.stderr)
            return (
                jsonify({"success": False, "data": {}, "error": "migration_failed"}),
                500,
            )

        if "Multiple head" in stderr:
            return (
                jsonify({"success": False, "data": {}, "error": "multiple_heads"}),
                409,
            )

        current_app.logger.error("flask db upgrade failed: %s", stderr)
        return (
            jsonify({"success": False, "data": {}, "error": "migration_failed"}),
            500,
        )

    except subprocess.TimeoutExpired:
        return (
            jsonify({"success": False, "data": {}, "error": "migration_timeout"}),
            504,
        )
    except Exception as e:
        current_app.logger.error("Migration exception: %s", str(e))
        return (
            jsonify({"success": False, "data": {}, "error": "migration_failed"}),
            500,
        )
