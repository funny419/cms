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
