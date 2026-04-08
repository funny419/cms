"""auth.py 미커버 엔드포인트 추가 테스트."""

import pytest

from database import db as _db


def make_user(username, role="editor"):
    from models import User

    user = User(username=username, email=f"{username}@test.com", role=role)
    user.set_password("pass123")
    _db.session.add(user)
    _db.session.commit()
    return user.id


# ─── POST /api/auth/register ──────────────────────────────────────────────────


class TestRegister:
    def test_register_success(self, client):
        res = client.post(
            "/api/auth/register",
            json={
                "username": "newuser1",
                "email": "newuser1@test.com",
                "password": "pass123",
            },
        )
        assert res.status_code == 201
        assert res.get_json()["success"] is True

    def test_register_missing_fields(self, client):
        res = client.post("/api/auth/register", json={"username": "only_user"})
        assert res.status_code == 400

    def test_register_duplicate_username(self, client, app):
        with app.app_context():
            make_user("dupuser")
        res = client.post(
            "/api/auth/register",
            json={
                "username": "dupuser",
                "email": "new@test.com",
                "password": "pass",
            },
        )
        assert res.status_code == 400
        assert "Username already exists" in res.get_json()["error"]

    def test_register_duplicate_email(self, client, app):
        with app.app_context():
            make_user("emaildup")
        res = client.post(
            "/api/auth/register",
            json={
                "username": "newname",
                "email": "emaildup@test.com",
                "password": "pass",
            },
        )
        assert res.status_code == 400
        assert "Email already exists" in res.get_json()["error"]


# ─── POST /api/auth/login ─────────────────────────────────────────────────────


class TestLogin:
    def test_login_success(self, client, app):
        with app.app_context():
            make_user("loginuser")
        res = client.post(
            "/api/auth/login",
            json={
                "username": "loginuser",
                "password": "pass123",
            },
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert "access_token" in data
        assert data["user"]["username"] == "loginuser"

    def test_login_wrong_password(self, client, app):
        with app.app_context():
            make_user("loginuser2")
        res = client.post(
            "/api/auth/login",
            json={
                "username": "loginuser2",
                "password": "wrongpass",
            },
        )
        assert res.status_code == 401

    def test_login_deactivated_user(self, client, app):
        with app.app_context():
            make_user("deactlogin", role="deactivated")
        res = client.post(
            "/api/auth/login",
            json={
                "username": "deactlogin",
                "password": "pass123",
            },
        )
        assert res.status_code == 401

    def test_login_missing_body(self, client):
        res = client.post(
            "/api/auth/login", json=None, content_type="application/json", data="null"
        )
        assert res.status_code == 400


# ─── GET /api/auth/me ─────────────────────────────────────────────────────────


class TestGetMe:
    def test_get_me_success(self, client, editor_headers):
        res = client.get("/api/auth/me", headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["username"] == "editor_user"

    def test_get_me_unauthorized(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401


# ─── PUT /api/auth/me ─────────────────────────────────────────────────────────


class TestUpdateMe:
    def test_update_bio(self, client, editor_headers):
        res = client.put("/api/auth/me", json={"bio": "새 소개글"}, headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["bio"] == "새 소개글"

    def test_update_username_conflict(self, client, app, editor_headers):
        with app.app_context():
            make_user("existing_name")
        res = client.put("/api/auth/me", json={"username": "existing_name"}, headers=editor_headers)
        assert res.status_code == 400

    def test_update_email_conflict(self, client, app, editor_headers):
        with app.app_context():
            make_user("existing_email_user")
        res = client.put(
            "/api/auth/me", json={"email": "existing_email_user@test.com"}, headers=editor_headers
        )
        assert res.status_code == 400

    def test_update_invalid_blog_color(self, client, editor_headers):
        res = client.put("/api/auth/me", json={"blog_color": "red"}, headers=editor_headers)
        assert res.status_code == 400

    def test_update_valid_blog_color(self, client, editor_headers):
        res = client.put("/api/auth/me", json={"blog_color": "#ff0000"}, headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["blog_color"] == "#ff0000"

    def test_update_invalid_blog_layout(self, client, editor_headers):
        res = client.put(
            "/api/auth/me", json={"blog_layout": "invalid_layout"}, headers=editor_headers
        )
        assert res.status_code == 400

    def test_update_valid_blog_layout(self, client, editor_headers):
        res = client.put("/api/auth/me", json={"blog_layout": "magazine"}, headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["blog_layout"] == "magazine"

    def test_update_requires_auth(self, client):
        res = client.put("/api/auth/me", json={"bio": "무단 변경"})
        assert res.status_code == 401

    def test_update_avatar_url(self, client, editor_headers):
        res = client.put(
            "/api/auth/me", json={"avatar_url": "/uploads/avatar.jpg"}, headers=editor_headers
        )
        assert res.status_code == 200

    def test_update_blog_title(self, client, editor_headers):
        res = client.put("/api/auth/me", json={"blog_title": "내 블로그"}, headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["blog_title"] == "내 블로그"

    def test_update_website_url(self, client, editor_headers):
        res = client.put(
            "/api/auth/me", json={"website_url": "https://example.com"}, headers=editor_headers
        )
        assert res.status_code == 200

    def test_update_social_links(self, client, editor_headers):
        links = {"github": "https://github.com/test"}
        res = client.put("/api/auth/me", json={"social_links": links}, headers=editor_headers)
        assert res.status_code == 200

    def test_update_banner_image_url(self, client, editor_headers):
        res = client.put(
            "/api/auth/me", json={"banner_image_url": "/uploads/banner.jpg"}, headers=editor_headers
        )
        assert res.status_code == 200

    def test_update_own_username_same_is_ok(self, client, editor_headers):
        """자신의 현재 username으로 변경 시도 — 충돌 아님."""
        res = client.put("/api/auth/me", json={"username": "editor_user"}, headers=editor_headers)
        assert res.status_code == 200

    def test_update_own_email_same_is_ok(self, client, editor_headers):
        """자신의 현재 email로 변경 시도 — 충돌 아님."""
        res = client.put("/api/auth/me", json={"email": "editor@test.com"}, headers=editor_headers)
        assert res.status_code == 200


# ─── GET /api/auth/users/search ───────────────────────────────────────────────


class TestSearchUsers:
    def test_search_with_query(self, client, app):
        with app.app_context():
            make_user("searchable")
        res = client.get("/api/auth/users/search?q=search")
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert "items" in data
        assert any(u["username"] == "searchable" for u in data["items"])

    def test_search_empty_query(self, client):
        res = client.get("/api/auth/users/search?q=")
        assert res.status_code == 200
        assert res.get_json()["data"]["items"] == []

    def test_search_no_query(self, client):
        res = client.get("/api/auth/users/search")
        assert res.status_code == 200
        assert res.get_json()["data"]["items"] == []

    def test_search_excludes_deactivated(self, client, app):
        with app.app_context():
            make_user("deact_search", role="deactivated")
        res = client.get("/api/auth/users/search?q=deact_search")
        assert res.status_code == 200
        items = res.get_json()["data"]["items"]
        assert not any(u["username"] == "deact_search" for u in items)


# ─── GET /api/auth/users/<username> (is_following) ───────────────────────────


class TestGetUserProfileFollowStatus:
    def test_is_following_true_when_following(self, client, app, editor_headers):
        """팔로우 중인 유저 조회 시 is_following=True."""
        with app.app_context():
            make_user("profile_target1")
        # 팔로우
        client.post("/api/users/profile_target1/follow", headers=editor_headers)
        res = client.get("/api/auth/users/profile_target1", headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["is_following"] is True

    def test_is_following_false_when_not_following(self, client, app, editor_headers):
        with app.app_context():
            make_user("profile_target2")
        res = client.get("/api/auth/users/profile_target2", headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["is_following"] is False

    def test_self_profile_is_following_false(self, client, editor_headers):
        """자기 자신 조회 시 is_following=False."""
        res = client.get("/api/auth/users/editor_user", headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["is_following"] is False


# ─── POST /api/auth/login — Rate Limiting (#5) ───────────────────────────────


class TestLoginRateLimit:
    """#5 Flask-Limiter — 로그인 10회 초과 시 429 반환."""

    @pytest.fixture
    def rl_client(self):
        """RATELIMIT_ENABLED=True로 초기화된 전용 앱 클라이언트."""
        from app import create_app
        from extensions import limiter

        class RateLimitConfig:
            TESTING = True
            SQLALCHEMY_DATABASE_URI = "mysql+pymysql://funnycms:dev_app_password@db:3306/cmsdb_test"
            SQLALCHEMY_ENGINE_OPTIONS = {"execution_options": {"isolation_level": "READ COMMITTED"}}
            JWT_SECRET_KEY = "test-secret-key"
            JWT_ACCESS_TOKEN_EXPIRES = False
            SQLALCHEMY_TRACK_MODIFICATIONS = False
            SECRET_KEY = "test-secret"
            STORAGE_BACKEND = "local"
            UPLOAD_FOLDER = "/tmp/cms_test_uploads"
            MAX_CONTENT_LENGTH = 10 * 1024 * 1024
            RATELIMIT_ENABLED = True
            RATELIMIT_STORAGE_URI = "memory://"

        rl_app = create_app(RateLimitConfig)
        yield rl_app.test_client()

        # 정리: limiter 비활성화 + 카운터 초기화
        limiter.enabled = False
        try:
            limiter._storage.reset()
        except Exception:
            pass

    def test_login_rate_limit_429(self, rl_client):
        """11회 연속 로그인 시도 → 10/min 초과 → 429 반환."""
        last_res = None
        for _ in range(11):
            last_res = rl_client.post(
                "/api/auth/login",
                json={"username": "nonexistent", "password": "wrong"},
            )
        assert last_res is not None
        assert last_res.status_code == 429
        body = last_res.get_json()
        assert body is not None, "429 응답이 JSON이어야 합니다 (HTML 불가)"
        assert body["success"] is False
        assert "error" in body
