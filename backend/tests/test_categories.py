from database import db as _db


def make_category(app, name="기술", slug="tech", parent_id=None):
    from models import Category

    cat = Category(name=name, slug=slug, parent_id=parent_id)
    _db.session.add(cat)
    _db.session.commit()
    return cat.id


def test_list_categories(client):
    res = client.get("/api/categories")
    assert res.status_code == 200
    assert "items" in res.get_json()["data"]


def test_create_category_requires_admin(client, editor_headers):
    res = client.post("/api/categories", json={"name": "기술"}, headers=editor_headers)
    assert res.status_code == 403


def test_create_category(client, app, admin_headers):
    res = client.post("/api/categories", json={"name": "기술"}, headers=admin_headers)
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["name"] == "기술"
    assert "slug" in data


def test_create_child_category(client, app, admin_headers):
    with app.app_context():
        parent_id = make_category(app)
    res = client.post(
        "/api/categories",
        json={"name": "Python", "parent_id": parent_id},
        headers=admin_headers,
    )
    assert res.status_code == 201
    assert res.get_json()["data"]["parent_id"] == parent_id


def test_depth_limit_enforced(client, app, admin_headers):
    """깊이 3단 초과 시 400."""
    with app.app_context():
        d1 = make_category(app, "D1", "d1")
        d2 = make_category(app, "D2", "d2", parent_id=d1)
        d3 = make_category(app, "D3", "d3", parent_id=d2)
    res = client.post(
        "/api/categories",
        json={"name": "D4", "parent_id": d3},
        headers=admin_headers,
    )
    assert res.status_code == 400


def test_delete_category(client, app, admin_headers):
    with app.app_context():
        cat_id = make_category(app, "삭제대상", "delete-me")
    res = client.delete(f"/api/categories/{cat_id}", headers=admin_headers)
    assert res.status_code == 200


# ─── GET /api/categories/<id> ─────────────────────────────────────────────────


def test_get_category_success(client, app):
    with app.app_context():
        cat_id = make_category(app, "단건조회", "single")
    res = client.get(f"/api/categories/{cat_id}")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["name"] == "단건조회"
    assert "children" in data
    assert "post_count" in data


def test_get_category_not_found(client):
    res = client.get("/api/categories/99999")
    assert res.status_code == 404


def test_get_category_with_children(client, app):
    with app.app_context():
        parent_id = make_category(app, "부모", "parent-cat")
        make_category(app, "자식1", "child1", parent_id=parent_id)
        make_category(app, "자식2", "child2", parent_id=parent_id)
    res = client.get(f"/api/categories/{parent_id}")
    assert res.status_code == 200
    children = res.get_json()["data"]["children"]
    assert len(children) == 2


# ─── PUT /api/categories/<id> ─────────────────────────────────────────────────


def test_update_category_success(client, app, admin_headers):
    with app.app_context():
        cat_id = make_category(app, "수정전", "before-update")
    res = client.put(f"/api/categories/{cat_id}", json={"name": "수정후"}, headers=admin_headers)
    assert res.status_code == 200
    assert res.get_json()["data"]["name"] == "수정후"


def test_update_category_not_found(client, admin_headers):
    res = client.put("/api/categories/99999", json={"name": "없음"}, headers=admin_headers)
    assert res.status_code == 404


def test_update_category_requires_admin(client, editor_headers):
    res = client.put("/api/categories/1", json={"name": "해킹"}, headers=editor_headers)
    assert res.status_code == 403


# ─── DELETE /api/categories/<id> ─────────────────────────────────────────────


def test_delete_category_not_found(client, admin_headers):
    res = client.delete("/api/categories/99999", headers=admin_headers)
    assert res.status_code == 404


def test_delete_category_requires_admin(client, editor_headers):
    res = client.delete("/api/categories/1", headers=editor_headers)
    assert res.status_code == 403


# ─── POST /api/categories — 추가 검증 ─────────────────────────────────────────


def test_create_category_missing_name(client, admin_headers):
    res = client.post("/api/categories", json={}, headers=admin_headers)
    assert res.status_code == 400


def test_create_category_duplicate_name_same_parent(client, app, admin_headers):
    with app.app_context():
        parent_id = make_category(app, "부모dup", "parent-dup")
        make_category(app, "중복이름", "dup-child", parent_id=parent_id)
    res = client.post(
        "/api/categories",
        json={"name": "중복이름", "parent_id": parent_id},
        headers=admin_headers,
    )
    assert res.status_code == 400


def test_create_category_with_description(client, app, admin_headers):
    res = client.post(
        "/api/categories",
        json={"name": "설명있는카테고리", "description": "설명입니다"},
        headers=admin_headers,
    )
    assert res.status_code == 201


# ─── GET /api/categories/<id>/posts ──────────────────────────────────────────


def test_list_category_posts_public(client, app):
    with app.app_context():
        from models import Post, User

        user = User(username="catpost_author", email="catpost@test.com", role="editor")
        user.set_password("pass")
        _db.session.add(user)
        _db.session.flush()
        cat_id = make_category(app, "포스트카테고리", "post-cat")
        post = Post(
            title="카테고리 포스트",
            slug="catpost-1",
            author_id=user.id,
            status="published",
            visibility="public",
            category_id=cat_id,
        )
        _db.session.add(post)
        _db.session.commit()
    res = client.get(f"/api/categories/{cat_id}/posts")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["total"] == 1


def test_list_category_posts_not_found(client):
    res = client.get("/api/categories/99999/posts")
    assert res.status_code == 404


def test_list_category_posts_logged_in_sees_members_only(client, app, editor_headers):
    with app.app_context():
        from models import Post, User

        user = User(username="catmonly_author", email="catmonly@test.com", role="editor")
        user.set_password("pass")
        _db.session.add(user)
        _db.session.flush()
        cat_id = make_category(app, "멤버카테고리", "members-cat")
        post = Post(
            title="멤버전용",
            slug="catmonly-post",
            author_id=user.id,
            status="published",
            visibility="members_only",
            category_id=cat_id,
        )
        _db.session.add(post)
        _db.session.commit()
    res = client.get(f"/api/categories/{cat_id}/posts", headers=editor_headers)
    assert res.status_code == 200
    assert res.get_json()["data"]["total"] == 1
