import uuid

from database import db as _db


def make_post(app, title, content="", status="published", visibility="public"):
    from models import Post, User

    uname = f"u_{uuid.uuid4().hex[:6]}"
    user = User(username=uname, email=f"{uname}@t.com", role="editor")
    user.set_password("p")
    _db.session.add(user)
    _db.session.flush()
    post = Post(
        title=title,
        slug=uuid.uuid4().hex[:8],
        content=content,
        author_id=user.id,
        status=status,
        visibility=visibility,
    )
    _db.session.add(post)
    _db.session.commit()
    return post.id, user.username


def test_search_returns_ok(client, app):
    """?q= 파라미터로 검색 시 200 응답."""
    with app.app_context():
        make_post(app, title="Flask Tutorial")
    res = client.get("/api/posts?q=Flask")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "items" in data and "total" in data


def test_search_empty_returns_all(client, app):
    """q 없으면 전체 포스트 반환."""
    with app.app_context():
        make_post(app, title="Post Alpha")
        make_post(app, title="Post Beta")
    res = client.get("/api/posts")
    assert res.status_code == 200
    assert res.get_json()["data"]["total"] >= 2


def test_tags_filter(client, app):
    """?tags=id 필터로 태그 포스트 조회."""
    with app.app_context():
        from models import Tag

        tag = Tag(name=f"T_{uuid.uuid4().hex[:4]}", slug=f"t-{uuid.uuid4().hex[:4]}")
        _db.session.add(tag)
        _db.session.flush()
        tag_id = tag.id
        post_id, _ = make_post(app, title="Tagged Post")
        from models import Post

        post = _db.session.get(Post, post_id)
        post.tags.append(tag)
        _db.session.commit()
    res = client.get(f"/api/posts?tags={tag_id}")
    assert res.status_code == 200
    assert any(p["id"] == post_id for p in res.get_json()["data"]["items"])


def test_author_filter(client, app):
    """?author=username 필터."""
    with app.app_context():
        post_id, username = make_post(app, title="Author Filter Post")
    res = client.get(f"/api/posts?author={username}")
    assert res.status_code == 200
    assert any(p["id"] == post_id for p in res.get_json()["data"]["items"])
