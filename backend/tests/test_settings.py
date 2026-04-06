"""settings.py 커버리지 테스트."""

from database import db as _db


def create_option(app, name, value):
    from models.schema import Option

    opt = Option(option_name=name, option_value=value)
    _db.session.add(opt)
    _db.session.commit()
    return opt


# ─── GET /api/settings ────────────────────────────────────────────────────────


class TestGetSettings:
    def test_returns_public_keys_only(self, client, app):
        with app.app_context():
            create_option(app, "site_title", "내 블로그")
            create_option(app, "site_skin", "forest")
            create_option(app, "admin_email", "secret@admin.com")  # 비공개 키
        res = client.get("/api/settings")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert "site_title" in data["data"]
        assert "site_skin" in data["data"]
        assert "admin_email" not in data["data"]  # PUBLIC_KEYS에 없으므로 미포함

    def test_empty_settings(self, client):
        res = client.get("/api/settings")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert isinstance(data["data"], dict)

    def test_no_auth_required(self, client):
        """비로그인 상태에서도 조회 가능."""
        res = client.get("/api/settings")
        assert res.status_code == 200

    def test_returns_all_public_keys_present(self, client, app):
        with app.app_context():
            create_option(app, "site_title", "테스트 블로그")
            create_option(app, "tagline", "부제목")
            create_option(app, "site_url", "https://example.com")
            create_option(app, "site_skin", "ocean")
        res = client.get("/api/settings")
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["site_title"] == "테스트 블로그"
        assert data["tagline"] == "부제목"
        assert data["site_url"] == "https://example.com"
        assert data["site_skin"] == "ocean"


# ─── PUT /api/settings ────────────────────────────────────────────────────────


class TestUpdateSettings:
    def test_admin_can_update_site_title(self, client, app, admin_headers):
        res = client.put("/api/settings", json={"site_title": "새 제목"}, headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True

        # 실제 저장 확인
        get_res = client.get("/api/settings")
        assert get_res.get_json()["data"]["site_title"] == "새 제목"

    def test_admin_can_update_site_skin(self, client, app, admin_headers):
        res = client.put("/api/settings", json={"site_skin": "rose"}, headers=admin_headers)
        assert res.status_code == 200
        get_res = client.get("/api/settings")
        assert get_res.get_json()["data"]["site_skin"] == "rose"

    def test_update_creates_new_option_if_not_exists(self, client, app, admin_headers):
        """존재하지 않는 옵션도 새로 생성."""
        res = client.put("/api/settings", json={"tagline": "새 부제목"}, headers=admin_headers)
        assert res.status_code == 200
        get_res = client.get("/api/settings")
        assert get_res.get_json()["data"]["tagline"] == "새 부제목"

    def test_update_overwrites_existing_option(self, client, app, admin_headers):
        with app.app_context():
            create_option(app, "site_title", "기존 제목")
        res = client.put("/api/settings", json={"site_title": "변경된 제목"}, headers=admin_headers)
        assert res.status_code == 200
        get_res = client.get("/api/settings")
        assert get_res.get_json()["data"]["site_title"] == "변경된 제목"

    def test_disallowed_keys_ignored(self, client, app, admin_headers):
        """ADMIN_ALLOWED_KEYS에 없는 키는 무시."""
        res = client.put(
            "/api/settings",
            json={
                "site_title": "허용 키",
                "unknown_key": "무시됨",
            },
            headers=admin_headers,
        )
        assert res.status_code == 200
        # unknown_key가 DB에 저장되지 않았는지 확인
        with app.app_context():
            from sqlalchemy import select

            from models.schema import Option

            opt = _db.session.execute(
                select(Option).where(Option.option_name == "unknown_key")
            ).scalar_one_or_none()
            assert opt is None

    def test_requires_admin(self, client, editor_headers):
        res = client.put("/api/settings", json={"site_title": "해킹"}, headers=editor_headers)
        assert res.status_code == 403

    def test_requires_auth(self, client):
        res = client.put("/api/settings", json={"site_title": "비로그인 해킹"})
        assert res.status_code == 401

    def test_update_multiple_keys_at_once(self, client, app, admin_headers):
        res = client.put(
            "/api/settings",
            json={
                "site_title": "멀티 제목",
                "tagline": "멀티 부제목",
                "site_skin": "notion",
            },
            headers=admin_headers,
        )
        assert res.status_code == 200
        get_res = client.get("/api/settings")
        d = get_res.get_json()["data"]
        assert d["site_title"] == "멀티 제목"
        assert d["tagline"] == "멀티 부제목"
        assert d["site_skin"] == "notion"

    def test_posts_per_page_allowed(self, client, app, admin_headers):
        """posts_per_page는 허용된 admin 키."""
        res = client.put("/api/settings", json={"posts_per_page": "10"}, headers=admin_headers)
        assert res.status_code == 200

    def test_admin_email_allowed_but_not_public(self, client, app, admin_headers):
        """admin_email은 admin이 설정 가능하지만 GET에서 미노출."""
        res = client.put(
            "/api/settings", json={"admin_email": "admin@priv.com"}, headers=admin_headers
        )
        assert res.status_code == 200
        get_res = client.get("/api/settings")
        assert "admin_email" not in get_res.get_json()["data"]
