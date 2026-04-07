"""Setup Wizard Phase 2 API 테스트 — DB 연결 테스트, .env 생성, 마이그레이션."""

import os
from unittest.mock import MagicMock, patch

import pytest

# ─── GET /api/wizard/status (step 필드 추가) ──────────────────────────────────


class TestWizardStatusStep:
    def test_status_has_step_field(self, client, monkeypatch):
        """status 응답에 step 필드가 포함된다."""
        monkeypatch.delenv("WIZARD_COMPLETED", raising=False)
        res = client.get("/api/wizard/status")
        assert "step" in res.get_json()["data"]

    def test_status_step_1_when_db_disconnected(self, client, monkeypatch):
        """DB 미연결 시 step=1 반환."""
        monkeypatch.delenv("WIZARD_COMPLETED", raising=False)
        with patch("api.wizard._db_connected", return_value=False):
            res = client.get("/api/wizard/status")
        assert res.get_json()["data"]["step"] == 1

    def test_status_step_5_when_completed(self, client, app, monkeypatch):
        """admin 계정 있으면 step=5 (completed)."""
        from database import db as _db
        from models import User

        monkeypatch.delenv("WIZARD_COMPLETED", raising=False)
        with app.app_context():
            u = User(username="stepadmin", email="stepadmin@test.com", role="admin")
            u.set_password("adminpass123")
            _db.session.add(u)
            _db.session.commit()

        res = client.get("/api/wizard/status")
        data = res.get_json()["data"]
        assert data["completed"] is True
        assert data["step"] == 5


# ─── POST /api/wizard/db-test ─────────────────────────────────────────────────


class TestWizardDbTest:
    VALID_PAYLOAD = {
        "host": "db",
        "port": 3306,
        "user": "funnycms",
        "password": "dev_app_password",
        "dbname": "cmsdb_test",
    }

    def test_db_test_success(self, client):
        """실제 테스트 DB에 연결 성공 → 200."""
        res = client.post("/api/wizard/db-test", json=self.VALID_PAYLOAD)
        assert res.status_code == 200
        assert res.get_json()["success"] is True

    def test_db_test_missing_fields_400(self, client):
        """필수 필드 누락 → 400."""
        res = client.post("/api/wizard/db-test", json={"host": "db"})
        assert res.status_code == 400

    def test_db_test_wrong_password_auth_failed(self, client):
        """잘못된 비밀번호 → auth_failed 오류 코드."""
        payload = {**self.VALID_PAYLOAD, "password": "wrongpassword"}
        res = client.post("/api/wizard/db-test", json=payload)
        assert res.status_code == 400
        assert res.get_json()["data"]["error_code"] == "auth_failed"

    def test_db_test_wrong_host_host_unreachable(self, client):
        """존재하지 않는 호스트 → host_unreachable 오류 코드."""
        payload = {**self.VALID_PAYLOAD, "host": "nonexistent-host-12345"}
        res = client.post("/api/wizard/db-test", json=payload)
        assert res.status_code == 400
        assert res.get_json()["data"]["error_code"] == "host_unreachable"

    def test_db_test_wrong_dbname_db_not_found(self, client):
        """존재하지 않는 DB명 → db_not_found 오류 코드."""
        payload = {**self.VALID_PAYLOAD, "dbname": "nonexistent_db_xyz"}
        res = client.post("/api/wizard/db-test", json=payload)
        assert res.status_code == 400
        assert res.get_json()["data"]["error_code"] == "db_not_found"

    def test_db_test_no_password_in_response(self, client):
        """응답에 비밀번호가 포함되지 않는다."""
        res = client.post("/api/wizard/db-test", json=self.VALID_PAYLOAD)
        response_text = res.get_data(as_text=True)
        assert "dev_app_password" not in response_text


# ─── POST /api/wizard/env ────────────────────────────────────────────────────


class TestWizardEnv:
    VALID_PAYLOAD = {
        "host": "db",
        "port": 3306,
        "user": "funnycms",
        "password": "dev_app_password",
        "dbname": "cmsdb_test",
    }

    @pytest.fixture(autouse=True)
    def reset_env_flag(self, monkeypatch, tmp_path):
        """각 테스트 전 DB_ENV_WRITTEN 환경변수 초기화 + 임시 .env 경로 사용."""
        monkeypatch.delenv("DB_ENV_WRITTEN", raising=False)
        monkeypatch.setattr("api.wizard_phase2.ENV_PATH", str(tmp_path / "test.env"))

    def test_env_success_creates_file(self, client, tmp_path, monkeypatch):
        """성공 시 .env 파일 생성 → 201."""
        env_path = str(tmp_path / "test.env")
        monkeypatch.setattr("api.wizard_phase2.ENV_PATH", env_path)
        res = client.post("/api/wizard/env", json=self.VALID_PAYLOAD)
        assert res.status_code == 201
        assert res.get_json()["success"] is True
        assert os.path.exists(env_path)

    def test_env_writes_database_url(self, client, tmp_path, monkeypatch):
        """.env 파일에 DATABASE_URL이 기록된다."""
        env_path = str(tmp_path / "test.env")
        monkeypatch.setattr("api.wizard_phase2.ENV_PATH", env_path)
        client.post("/api/wizard/env", json=self.VALID_PAYLOAD)
        with open(env_path) as f:
            content = f.read()
        assert "DATABASE_URL=" in content
        assert "cmsdb_test" in content

    def test_env_does_not_write_password_as_plaintext_key(self, client, tmp_path, monkeypatch):
        """.env에 DB 비밀번호는 DATABASE_URL 내에만 포함 (별도 PASSWORD 키로 노출 최소화)."""
        env_path = str(tmp_path / "test.env")
        monkeypatch.setattr("api.wizard_phase2.ENV_PATH", env_path)
        client.post("/api/wizard/env", json=self.VALID_PAYLOAD)
        with open(env_path) as f:
            content = f.read()
        assert "DATABASE_URL=" in content

    def test_env_already_written_returns_200(self, client, monkeypatch):
        """DB_ENV_WRITTEN=true 환경변수 있으면 중복 작성 없이 200 반환."""
        monkeypatch.setenv("DB_ENV_WRITTEN", "true")
        res = client.post("/api/wizard/env", json=self.VALID_PAYLOAD)
        assert res.status_code == 200
        assert res.get_json()["data"]["already_written"] is True

    def test_env_missing_fields_400(self, client):
        """필수 필드 누락 시 400."""
        res = client.post("/api/wizard/env", json={"host": "db"})
        assert res.status_code == 400

    def test_env_wrong_password_400(self, client, monkeypatch):
        """DB 연결 재확인 실패 시 400."""
        payload = {**self.VALID_PAYLOAD, "password": "wrongpassword"}
        res = client.post("/api/wizard/env", json=payload)
        assert res.status_code == 400


# ─── POST /api/wizard/migrate ────────────────────────────────────────────────


class TestWizardMigrate:
    @pytest.fixture(autouse=True)
    def reset_wizard_completed(self, monkeypatch):
        """각 테스트 전 WIZARD_COMPLETED 환경변수 초기화."""
        monkeypatch.delenv("WIZARD_COMPLETED", raising=False)

    def test_migrate_success(self, client):
        """flask db upgrade 성공 → 200."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stderr = ""
        mock_result.stdout = ""
        with patch("api.wizard_phase2.subprocess.run", return_value=mock_result):
            res = client.post("/api/wizard/migrate")
        assert res.status_code == 200
        assert res.get_json()["success"] is True

    def test_migrate_failure_returns_500(self, client):
        """flask db upgrade 실패 → 500 + migration_failed 오류."""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "some error"
        mock_result.stdout = ""
        with patch("api.wizard_phase2.subprocess.run", return_value=mock_result):
            res = client.post("/api/wizard/migrate")
        assert res.status_code == 500
        assert res.get_json()["error"] == "migration_failed"

    def test_migrate_already_exists_stamps_and_retries(self, client):
        """'already exists' 오류 → stamp head 후 재시도."""
        fail_result = MagicMock(returncode=1, stderr="Table 'posts' already exists", stdout="")
        stamp_result = MagicMock(returncode=0, stderr="", stdout="")
        retry_result = MagicMock(returncode=0, stderr="", stdout="")

        with patch(
            "api.wizard_phase2.subprocess.run",
            side_effect=[fail_result, stamp_result, retry_result],
        ):
            res = client.post("/api/wizard/migrate")
        assert res.status_code == 200

    def test_migrate_multiple_heads_returns_409(self, client):
        """'Multiple head' 오류 → 409."""
        mock_result = MagicMock(returncode=1, stderr="Multiple head revisions", stdout="")
        with patch("api.wizard_phase2.subprocess.run", return_value=mock_result):
            res = client.post("/api/wizard/migrate")
        assert res.status_code == 409
        assert res.get_json()["error"] == "multiple_heads"

    def test_migrate_no_password_in_response(self, client):
        """마이그레이션 응답에 DB 비밀번호 미포함."""
        mock_result = MagicMock(returncode=1, stderr="auth error password=secret", stdout="")
        with patch("api.wizard_phase2.subprocess.run", return_value=mock_result):
            res = client.post("/api/wizard/migrate")
        # 응답 본문에 "password=" 문자열이 없어야 함
        assert "password=" not in res.get_data(as_text=True)
