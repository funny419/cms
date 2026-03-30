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
