def test_update_bio(client, app, editor_headers):
    res = client.put(
        "/api/auth/me",
        json={"bio": "안녕하세요, 저는 블로거입니다."},
        headers=editor_headers,
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["bio"] == "안녕하세요, 저는 블로거입니다."


def test_update_avatar_url(client, app, editor_headers):
    res = client.put(
        "/api/auth/me",
        json={"avatar_url": "/uploads/my_avatar.jpg"},
        headers=editor_headers,
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["avatar_url"] == "/uploads/my_avatar.jpg"


def test_me_response_includes_bio_avatar(client, app, editor_headers):
    res = client.get("/api/auth/me", headers=editor_headers)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "bio" in data
    assert "avatar_url" in data
