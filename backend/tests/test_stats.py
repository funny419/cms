"""통계 API 검증 — GET /api/blog/:username/stats, GET /api/admin/stats/:username."""

import uuid

from database import db as _db


def make_user(role="editor"):
    from models import User

    uname = f"u_{uuid.uuid4().hex[:6]}"
    user = User(username=uname, email=f"{uname}@t.com", role=role)
    user.set_password("pass")
    _db.session.add(user)
    _db.session.commit()
    return user.id, uname


def get_token(client, username):
    res = client.post("/api/auth/login", json={"username": username, "password": "pass"})
    return res.get_json()["data"]["access_token"]


# ────────────────────────────── 접근 권한 ──────────────────────────────


def test_stats_requires_login(client, app):
    """비로그인 시 통계 API 접근 불가 → 401."""
    with app.app_context():
        _, uname = make_user("editor")
    res = client.get(f"/api/blog/{uname}/stats")
    assert res.status_code == 401


def test_stats_owner_can_access_own(client, app):
    """본인은 자신의 통계 조회 가능 → 200."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    res = client.get(f"/api/blog/{uname}/stats", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200


def test_stats_other_user_forbidden(client, app):
    """타인의 통계 조회 불가 → 403."""
    with app.app_context():
        _, target = make_user("editor")
        _, requester = make_user("editor")
    requester_token = get_token(client, requester)
    res = client.get(
        f"/api/blog/{target}/stats",
        headers={"Authorization": f"Bearer {requester_token}"},
    )
    assert res.status_code == 403


def test_stats_admin_can_access_others(client, app):
    """admin은 타인의 통계 조회 가능 → 200."""
    with app.app_context():
        _, target = make_user("editor")
        _, admin = make_user("admin")
    admin_token = get_token(client, admin)
    res = client.get(
        f"/api/blog/{target}/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200


def test_stats_not_found_user(client, app):
    """존재하지 않는 유저 → 404."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    res = client.get(
        "/api/blog/no_such_user_xyz/stats", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 404


# ────────────────────────────── period 파라미터 ──────────────────────────────


def test_stats_default_period_7d(client, app):
    """period 미지정 시 기본값 7d (200 응답)."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    res = client.get(f"/api/blog/{uname}/stats", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "daily" in data


def test_stats_period_30d(client, app):
    """period=30d 정상 응답."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    res = client.get(
        f"/api/blog/{uname}/stats?period=30d",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200


def test_stats_period_90d(client, app):
    """period=90d 정상 응답."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    res = client.get(
        f"/api/blog/{uname}/stats?period=90d",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200


def test_stats_invalid_period_falls_back_to_7d(client, app):
    """잘못된 period 값 → 7d 기본값으로 200 응답 (오류 아님)."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    res = client.get(
        f"/api/blog/{uname}/stats?period=invalid",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "daily" in data  # 오류 없이 응답


# ────────────────────────────── 빈 데이터 처리 ──────────────────────────────


def test_stats_empty_data_structure(client, app):
    """visit_logs 없을 때 daily=[], total_views=0 반환."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    res = client.get(f"/api/blog/{uname}/stats", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["daily"] == []
    assert data["total_views"] == 0
    assert data["total_posts"] == 0
    assert data["follower_count"] == 0
    assert data["total_comments"] == 0
    assert data["top_posts"] == []


# ────────────────────────────── Admin 통계 API ──────────────────────────────


def test_admin_stats_requires_admin(client, app):
    """admin 전용 통계 API — editor는 접근 불가 → 403."""
    with app.app_context():
        _, target = make_user("editor")
        _, editor = make_user("editor")
    editor_token = get_token(client, editor)
    res = client.get(
        f"/api/admin/stats/{target}",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert res.status_code == 403


def test_admin_stats_by_admin(client, app):
    """admin은 /api/admin/stats/:username 접근 가능 → 200."""
    with app.app_context():
        _, target = make_user("editor")
        _, admin = make_user("admin")
    admin_token = get_token(client, admin)
    res = client.get(
        f"/api/admin/stats/{target}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "daily" in data and "top_posts" in data


def test_admin_stats_not_found(client, app):
    """존재하지 않는 유저 → 404."""
    with app.app_context():
        _, admin = make_user("admin")
    admin_token = get_token(client, admin)
    res = client.get(
        "/api/admin/stats/ghost_user_xyz",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 404
