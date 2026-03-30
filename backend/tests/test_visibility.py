def make_post(app, status="published", visibility="public", author_username=None):
    import uuid

    from database import db
    from models.schema import Post, User

    uname = author_username or f"u_{uuid.uuid4().hex[:8]}"
    user = User(username=uname, email=f"{uname}@test.com", role="editor")
    user.set_password("pass")
    db.session.add(user)
    db.session.flush()
    post = Post(
        title=f"Post {visibility}",
        slug=f"post-{uuid.uuid4().hex[:8]}",
        author_id=user.id,
        status=status,
        visibility=visibility,
    )
    db.session.add(post)
    db.session.commit()
    return post.id, user.id


def test_public_post_visible_to_guest(client, app):
    with app.app_context():
        post_id, _ = make_post(app, visibility="public")
    res = client.get("/api/posts")
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    assert any(p["id"] == post_id for p in items)


def test_private_post_not_visible_to_guest(client, app):
    with app.app_context():
        post_id, _ = make_post(app, visibility="private")
    res = client.get("/api/posts")
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    assert not any(p["id"] == post_id for p in items)


def test_members_only_not_visible_to_guest(client, app):
    with app.app_context():
        post_id, _ = make_post(app, visibility="members_only")
    res = client.get("/api/posts")
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    assert not any(p["id"] == post_id for p in items)


def test_members_only_visible_to_logged_in(client, app, editor_headers):
    with app.app_context():
        post_id, _ = make_post(app, visibility="members_only")
    res = client.get("/api/posts", headers=editor_headers)
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    assert any(p["id"] == post_id for p in items)


def test_post_created_with_visibility(client, app, editor_headers):
    res = client.post(
        "/api/posts",
        json={"title": "Members Only Post", "visibility": "members_only", "status": "published"},
        headers=editor_headers,
    )
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["visibility"] == "members_only"


def test_private_post_blocked_for_guest(client, app):
    with app.app_context():
        post_id, _ = make_post(app, visibility="private")
    res = client.get(f"/api/posts/{post_id}")
    assert res.status_code == 403
