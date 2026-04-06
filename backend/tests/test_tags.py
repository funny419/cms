from database import db as _db


def make_tag(app, name="Python", slug="python"):
    from models.schema import Tag

    tag = Tag(name=name, slug=slug)
    _db.session.add(tag)
    _db.session.commit()
    return tag.id


def test_list_tags(client):
    res = client.get("/api/tags")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "items" in data


def test_create_tag_requires_admin(client, editor_headers):
    res = client.post("/api/tags", json={"name": "Python"}, headers=editor_headers)
    assert res.status_code == 403


def test_create_tag(client, app, admin_headers):
    res = client.post("/api/tags", json={"name": "Python"}, headers=admin_headers)
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["name"] == "Python"
    assert "slug" in data  # python-slugify 자동 생성


def test_delete_tag(client, app, admin_headers):
    with app.app_context():
        tag_id = make_tag(app)
    res = client.delete(f"/api/tags/{tag_id}", headers=admin_headers)
    assert res.status_code == 200


def test_delete_nonexistent_tag(client, admin_headers):
    res = client.delete("/api/tags/99999", headers=admin_headers)
    assert res.status_code == 404


def test_create_post_with_tags(client, app, editor_headers):
    with app.app_context():
        t1 = make_tag(app, "React", "react")
        t2 = make_tag(app, "JS", "js")
    res = client.post(
        "/api/posts",
        json={"title": "React 기초", "tags": [t1, t2], "status": "published"},
        headers=editor_headers,
    )
    assert res.status_code == 201
    assert len(res.get_json()["data"]["tags"]) == 2


def test_update_post_tags_replaces(client, app, editor_headers):
    with app.app_context():
        t1 = make_tag(app, "Vue", "vue")
        t2 = make_tag(app, "Angular", "angular")
    # 포스트 생성
    res = client.post(
        "/api/posts", json={"title": "FE Framework", "tags": [t1, t2]}, headers=editor_headers
    )
    post_id = res.get_json()["data"]["id"]
    # 수정 — 태그 [t2]만
    res = client.put(f"/api/posts/{post_id}", json={"tags": [t2]}, headers=editor_headers)
    assert res.status_code == 200
    assert len(res.get_json()["data"]["tags"]) == 1
    assert res.get_json()["data"]["tags"][0]["id"] == t2


# ─── GET /api/tags/<id> ───────────────────────────────────────────────────────


def test_get_tag_success(client, app):
    with app.app_context():
        tag_id = make_tag(app, "Flask", "flask")
    res = client.get(f"/api/tags/{tag_id}")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["name"] == "Flask"
    assert "post_count" in data


def test_get_tag_not_found(client):
    res = client.get("/api/tags/99999")
    assert res.status_code == 404


def test_create_tag_missing_name(client, admin_headers):
    res = client.post("/api/tags", json={}, headers=admin_headers)
    assert res.status_code == 400


def test_create_tag_duplicate(client, app, admin_headers):
    with app.app_context():
        make_tag(app, "Duplicate", "duplicate")
    res = client.post(
        "/api/tags", json={"name": "Duplicate", "slug": "duplicate"}, headers=admin_headers
    )
    assert res.status_code == 400


# ─── GET /api/tags/<id>/posts ─────────────────────────────────────────────────


def test_list_tag_posts_public(client, app):
    """비로그인 사용자는 public 포스트만 조회."""
    with app.app_context():
        from models.schema import Post, PostTag, User

        user = User(username="tagpost_author", email="tagpost@test.com", role="editor")
        user.set_password("pass")
        _db.session.add(user)
        _db.session.flush()
        tag_id = make_tag(app, "TagPostTest", "tagposttest")
        post = Post(
            title="태그 포스트",
            slug="tagpost-1",
            author_id=user.id,
            status="published",
            visibility="public",
        )
        _db.session.add(post)
        _db.session.flush()
        _db.session.add(PostTag(post_id=post.id, tag_id=tag_id))
        _db.session.commit()

    res = client.get(f"/api/tags/{tag_id}/posts")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["title"] == "태그 포스트"


def test_list_tag_posts_not_found(client):
    res = client.get("/api/tags/99999/posts")
    assert res.status_code == 404


def test_list_tag_posts_logged_in_sees_members_only(client, app, editor_headers):
    """로그인 사용자는 members_only 포스트도 조회."""
    with app.app_context():
        from models.schema import Post, PostTag, User

        user = User(username="monly_author2", email="monly2@test.com", role="editor")
        user.set_password("pass")
        _db.session.add(user)
        _db.session.flush()
        tag_id = make_tag(app, "MembersOnlyTag2", "members-only-tag2")
        post = Post(
            title="멤버 전용 포스트2",
            slug="monly-post2",
            author_id=user.id,
            status="published",
            visibility="members_only",
        )
        _db.session.add(post)
        _db.session.flush()
        _db.session.add(PostTag(post_id=post.id, tag_id=tag_id))
        _db.session.commit()

    res = client.get(f"/api/tags/{tag_id}/posts", headers=editor_headers)
    assert res.status_code == 200
    assert res.get_json()["data"]["total"] == 1


def test_list_tags_pagination(client, app):
    """태그 목록 페이지네이션."""
    with app.app_context():
        for i in range(5):
            make_tag(app, f"PageTag{i}", f"pagetag{i}")
    res = client.get("/api/tags?page=1&per_page=2")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert len(data["items"]) == 2
    assert data["total"] == 5
