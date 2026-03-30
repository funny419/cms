from database import db as _db


def make_category(app, name="기술", slug="tech", parent_id=None):
    from models.schema import Category

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
