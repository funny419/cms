def test_approve_pending_comment(client, app, admin_headers):
    with app.app_context():
        from tests.conftest import make_comment

        comment_id = make_comment(app, status="pending")
    res = client.put(f"/api/admin/comments/{comment_id}/approve", headers=admin_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["status"] == "approved"


def test_reject_pending_comment(client, app, admin_headers):
    with app.app_context():
        from tests.conftest import make_comment

        comment_id = make_comment(app, status="pending")
    res = client.put(f"/api/admin/comments/{comment_id}/reject", headers=admin_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["status"] == "spam"


def test_approve_requires_admin(client, editor_headers):
    res = client.put("/api/admin/comments/999/approve", headers=editor_headers)
    assert res.status_code == 403


def test_approve_not_found(client, admin_headers):
    res = client.put("/api/admin/comments/99999/approve", headers=admin_headers)
    assert res.status_code == 404


def test_reject_not_found(client, admin_headers):
    res = client.put("/api/admin/comments/99999/reject", headers=admin_headers)
    assert res.status_code == 404
