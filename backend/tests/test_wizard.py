"""Setup Wizard API 테스트."""

import os

import pytest

# ─── GET /api/wizard/status ───────────────────────────────────────────────────


class TestWizardStatus:
    def test_status_returns_200(self, client):
        """status 엔드포인트는 항상 200을 반환한다."""
        res = client.get("/api/wizard/status")
        assert res.status_code == 200

    def test_status_response_format(self, client):
        """응답에 completed, db_connected, has_admin 필드가 포함된다."""
        res = client.get("/api/wizard/status")
        data = res.get_json()["data"]
        assert "completed" in data
        assert "db_connected" in data
        assert "has_admin" in data

    def test_status_db_connected_true(self, client):
        """테스트 DB 컨테이너가 실행 중이면 db_connected=True."""
        res = client.get("/api/wizard/status")
        assert res.get_json()["data"]["db_connected"] is True

    def test_status_no_admin_has_admin_false(self, client):
        """admin 계정이 없으면 has_admin=False."""
        res = client.get("/api/wizard/status")
        assert res.get_json()["data"]["has_admin"] is False

    def test_status_with_admin_has_admin_true(self, client, app):
        """admin 계정이 존재하면 has_admin=True, completed=True."""
        from database import db as _db
        from models import User

        with app.app_context():
            admin = User(username="statusadmin", email="statusadmin@test.com", role="admin")
            admin.set_password("adminpass123")
            _db.session.add(admin)
            _db.session.commit()

        res = client.get("/api/wizard/status")
        data = res.get_json()["data"]
        assert data["has_admin"] is True
        assert data["completed"] is True

    def test_status_wizard_completed_env_var(self, client, monkeypatch):
        """WIZARD_COMPLETED=true 환경변수가 있으면 completed=True."""
        monkeypatch.setenv("WIZARD_COMPLETED", "true")
        res = client.get("/api/wizard/status")
        assert res.get_json()["data"]["completed"] is True

    def test_status_no_wizard_completed_env_var(self, client, monkeypatch):
        """WIZARD_COMPLETED 환경변수 없고 admin도 없으면 completed=False."""
        monkeypatch.delenv("WIZARD_COMPLETED", raising=False)
        res = client.get("/api/wizard/status")
        assert res.get_json()["data"]["completed"] is False


# ─── POST /api/wizard/setup ───────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def reset_wizard_env(monkeypatch):
    """각 테스트 전 WIZARD_COMPLETED 환경변수 초기화."""
    monkeypatch.delenv("WIZARD_COMPLETED", raising=False)


class TestWizardSetup:
    VALID_PAYLOAD = {
        "admin": {
            "username": "newadmin",
            "email": "newadmin@test.com",
            "password": "adminpass123",
        },
        "site": {
            "site_title": "My CMS",
            "site_url": "https://example.com",
            "tagline": "A great CMS",
        },
    }

    def test_setup_success(self, client):
        """정상 setup → 201, 성공 응답."""
        res = client.post("/api/wizard/setup", json=self.VALID_PAYLOAD)
        assert res.status_code == 201
        assert res.get_json()["success"] is True

    def test_setup_creates_admin_user(self, client, app):
        """setup 후 admin 계정이 DB에 생성된다."""
        client.post("/api/wizard/setup", json=self.VALID_PAYLOAD)
        from database import db as _db
        from models import User

        with app.app_context():
            from sqlalchemy import select

            user = _db.session.execute(
                select(User).where(User.username == "newadmin")
            ).scalar_one_or_none()
            assert user is not None
            assert user.role == "admin"

    def test_setup_saves_site_settings(self, client, app):
        """setup 후 options 테이블에 site_title이 저장된다."""
        client.post("/api/wizard/setup", json=self.VALID_PAYLOAD)
        from database import db as _db
        from models import Option

        with app.app_context():
            from sqlalchemy import select

            opt = _db.session.execute(
                select(Option).where(Option.option_name == "site_title")
            ).scalar_one_or_none()
            assert opt is not None
            assert opt.option_value == "My CMS"

    def test_setup_sets_wizard_completed_env(self, client, monkeypatch):
        """setup 성공 후 WIZARD_COMPLETED 환경변수가 true로 설정된다."""
        monkeypatch.setattr("api.wizard.ENV_PATH", "/tmp/test_wizard.env")
        client.post("/api/wizard/setup", json=self.VALID_PAYLOAD)
        assert os.environ.get("WIZARD_COMPLETED") == "true"

    def test_setup_duplicate_blocked_409(self, client, monkeypatch):
        """이미 완료된 경우 재호출 시 409 반환."""
        monkeypatch.setattr("api.wizard.ENV_PATH", "/tmp/test_wizard.env")
        client.post("/api/wizard/setup", json=self.VALID_PAYLOAD)
        # 두 번째 호출
        res = client.post("/api/wizard/setup", json=self.VALID_PAYLOAD)
        assert res.status_code == 409
        assert res.get_json()["success"] is False

    def test_setup_admin_exists_blocked_409(self, client, app, monkeypatch):
        """admin 계정이 이미 존재하면 setup 시 409 반환."""
        from database import db as _db
        from models import User

        with app.app_context():
            admin = User(username="existadmin", email="existadmin@test.com", role="admin")
            admin.set_password("adminpass123")
            _db.session.add(admin)
            _db.session.commit()

        res = client.post("/api/wizard/setup", json=self.VALID_PAYLOAD)
        assert res.status_code == 409

    def test_setup_missing_username_400(self, client):
        """username 누락 시 400."""
        payload = {
            "admin": {"email": "a@test.com", "password": "adminpass123"},
            "site": {},
        }
        res = client.post("/api/wizard/setup", json=payload)
        assert res.status_code == 400

    def test_setup_missing_email_400(self, client):
        """email 누락 시 400."""
        payload = {
            "admin": {"username": "admin2", "password": "adminpass123"},
            "site": {},
        }
        res = client.post("/api/wizard/setup", json=payload)
        assert res.status_code == 400

    def test_setup_missing_password_400(self, client):
        """password 누락 시 400."""
        payload = {
            "admin": {"username": "admin3", "email": "admin3@test.com"},
            "site": {},
        }
        res = client.post("/api/wizard/setup", json=payload)
        assert res.status_code == 400

    def test_setup_short_password_400(self, client):
        """비밀번호 8자 미만 시 400."""
        payload = {
            "admin": {
                "username": "admin4",
                "email": "admin4@test.com",
                "password": "short",
            },
            "site": {},
        }
        res = client.post("/api/wizard/setup", json=payload)
        assert res.status_code == 400
        assert "8" in res.get_json()["error"]

    def test_setup_duplicate_username_400(self, client, app):
        """이미 존재하는 username으로 setup 시도 → 400."""
        from database import db as _db
        from models import User

        with app.app_context():
            existing = User(username="newadmin", email="other@test.com", role="editor")
            existing.set_password("pass1234")
            _db.session.add(existing)
            _db.session.commit()

        res = client.post("/api/wizard/setup", json=self.VALID_PAYLOAD)
        assert res.status_code == 400
        assert "Username" in res.get_json()["error"]

    def test_setup_duplicate_email_400(self, client, app):
        """이미 존재하는 email로 setup 시도 → 400."""
        from database import db as _db
        from models import User

        with app.app_context():
            existing = User(username="other", email="newadmin@test.com", role="editor")
            existing.set_password("pass1234")
            _db.session.add(existing)
            _db.session.commit()

        res = client.post("/api/wizard/setup", json=self.VALID_PAYLOAD)
        assert res.status_code == 400
        assert "Email" in res.get_json()["error"]

    def test_setup_empty_body_400(self, client):
        """빈 body 전송 시 400."""
        res = client.post("/api/wizard/setup", json={})
        assert res.status_code == 400

    def test_setup_site_fields_optional(self, client, monkeypatch):
        """site 필드 없이 admin 정보만으로도 setup 성공."""
        monkeypatch.setattr("api.wizard.ENV_PATH", "/tmp/test_wizard.env")
        payload = {
            "admin": {
                "username": "adminonly",
                "email": "adminonly@test.com",
                "password": "adminpass123",
            }
        }
        res = client.post("/api/wizard/setup", json=payload)
        assert res.status_code == 201

    def test_setup_password_exactly_8_chars(self, client, monkeypatch):
        """정확히 8자 비밀번호 허용."""
        monkeypatch.setattr("api.wizard.ENV_PATH", "/tmp/test_wizard.env")
        payload = {
            "admin": {
                "username": "admin8",
                "email": "admin8@test.com",
                "password": "12345678",
            }
        }
        res = client.post("/api/wizard/setup", json=payload)
        assert res.status_code == 201
