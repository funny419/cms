def test_get_user_profile(client, app):
    with app.app_context():
        from database import db as _db
        from models.schema import User

        user = User(
            username="alice",
            email="alice@test.com",
            role="editor",
            bio="개발자입니다",
            avatar_url="/uploads/alice.jpg",
        )
        user.set_password("pass")
        _db.session.add(user)
        _db.session.commit()

    res = client.get("/api/auth/users/alice")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["username"] == "alice"
    assert data["bio"] == "개발자입니다"
    assert "post_count" in data


def test_get_nonexistent_user_returns_404(client):
    res = client.get("/api/auth/users/nobody")
    assert res.status_code == 404


def test_deactivated_user_returns_404(client, app):
    with app.app_context():
        from database import db as _db
        from models.schema import User

        user = User(username="banned", email="banned@test.com", role="deactivated")
        user.set_password("pass")
        _db.session.add(user)
        _db.session.commit()

    res = client.get("/api/auth/users/banned")
    assert res.status_code == 404
