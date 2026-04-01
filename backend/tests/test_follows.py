import uuid

from database import db as _db


def make_user(role="editor"):
    from models.schema import User

    uname = f"u_{uuid.uuid4().hex[:6]}"
    user = User(username=uname, email=f"{uname}@t.com", role=role)
    user.set_password("pass")
    _db.session.add(user)
    _db.session.commit()
    return user.id, uname


def get_token(client, username):
    res = client.post("/api/auth/login", json={"username": username, "password": "pass"})
    return res.get_json()["data"]["access_token"]


def test_follow_user(client, app):
    with app.app_context():
        uid1, u1 = make_user()
        uid2, u2 = make_user()
    token1 = get_token(client, u1)
    res = client.post(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    assert res.status_code == 201
    assert res.get_json()["data"]["following"] is True


def test_unfollow_user(client, app):
    with app.app_context():
        uid1, u1 = make_user()
        uid2, u2 = make_user()
    token1 = get_token(client, u1)
    client.post(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    res = client.delete(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    assert res.status_code == 200
    assert res.get_json()["data"]["following"] is False


def test_cannot_follow_self(client, app):
    with app.app_context():
        uid1, u1 = make_user()
    token1 = get_token(client, u1)
    res = client.post(f"/api/users/{u1}/follow", headers={"Authorization": f"Bearer {token1}"})
    assert res.status_code == 400


def test_follow_requires_login(client, app):
    with app.app_context():
        _, u2 = make_user()
    res = client.post(f"/api/users/{u2}/follow")
    assert res.status_code == 401


def test_get_feed_empty(client, app, editor_headers):
    res = client.get("/api/feed", headers=editor_headers)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "items" in data
    assert data["total"] == 0


def test_get_feed_with_follows(client, app):
    with app.app_context():
        uid1, u1 = make_user()
        uid2, u2 = make_user()
        from models.schema import Post

        post = Post(
            title="Feed Test Post",
            slug=uuid.uuid4().hex[:8],
            author_id=uid2,
            status="published",
            visibility="public",
        )
        _db.session.add(post)
        _db.session.commit()
        post_id = post.id
    token1 = get_token(client, u1)
    client.post(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    res = client.get("/api/feed", headers={"Authorization": f"Bearer {token1}"})
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    assert any(p["id"] == post_id for p in items)


# ─── GET /api/users/<username>/followers ─────────────────────────────────────


def test_list_followers_success(client, app):
    with app.app_context():
        uid1, u1 = make_user()
        uid2, u2 = make_user()
    token1 = get_token(client, u1)
    client.post(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    res = client.get(f"/api/users/{u2}/followers")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["username"] == u1


def test_list_followers_not_found(client):
    res = client.get("/api/users/nobody_xyz/followers")
    assert res.status_code == 404


def test_list_followers_empty(client, app):
    with app.app_context():
        _, u1 = make_user()
    res = client.get(f"/api/users/{u1}/followers")
    assert res.status_code == 200
    assert res.get_json()["data"]["total"] == 0


# ─── GET /api/users/<username>/following ─────────────────────────────────────


def test_list_following_success(client, app):
    with app.app_context():
        uid1, u1 = make_user()
        uid2, u2 = make_user()
    token1 = get_token(client, u1)
    client.post(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    res = client.get(f"/api/users/{u1}/following")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["username"] == u2


def test_list_following_not_found(client):
    res = client.get("/api/users/nobody_xyz/following")
    assert res.status_code == 404


def test_list_following_empty(client, app):
    with app.app_context():
        _, u1 = make_user()
    res = client.get(f"/api/users/{u1}/following")
    assert res.status_code == 200
    assert res.get_json()["data"]["total"] == 0


# ─── 팔로우 추가 케이스 ──────────────────────────────────────────────────────


def test_follow_already_following_returns_200(client, app):
    """이미 팔로우 중이면 200 반환."""
    with app.app_context():
        _, u1 = make_user()
        _, u2 = make_user()
    token1 = get_token(client, u1)
    client.post(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    res = client.post(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    assert res.status_code == 200
    assert res.get_json()["data"]["following"] is True


def test_follow_nonexistent_user(client, app):
    with app.app_context():
        _, u1 = make_user()
    token1 = get_token(client, u1)
    res = client.post(
        "/api/users/nobody_xyz99/follow", headers={"Authorization": f"Bearer {token1}"}
    )
    assert res.status_code == 404


def test_unfollow_nonexistent_user(client, app):
    with app.app_context():
        _, u1 = make_user()
    token1 = get_token(client, u1)
    res = client.delete(
        "/api/users/nobody_xyz88/follow", headers={"Authorization": f"Bearer {token1}"}
    )
    assert res.status_code == 404


def test_unfollow_not_following_still_ok(client, app):
    """팔로우하지 않은 상태에서 언팔로우 — 200으로 정상 처리."""
    with app.app_context():
        _, u1 = make_user()
        _, u2 = make_user()
    token1 = get_token(client, u1)
    res = client.delete(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    assert res.status_code == 200
    assert res.get_json()["data"]["following"] is False


def test_follow_deactivated_user(client, app):
    with app.app_context():
        _, u1 = make_user()
        _, u2 = make_user(role="deactivated")
    token1 = get_token(client, u1)
    res = client.post(f"/api/users/{u2}/follow", headers={"Authorization": f"Bearer {token1}"})
    assert res.status_code == 404


def test_feed_requires_login(client):
    res = client.get("/api/feed")
    assert res.status_code == 401
