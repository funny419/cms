def test_update_blog_title(client, app, editor_headers):
    res = client.put(
        "/api/auth/me",
        json={"blog_title": "나의 개발 블로그"},
        headers=editor_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["blog_title"] == "나의 개발 블로그"


def test_update_blog_color(client, app, editor_headers):
    res = client.put(
        "/api/auth/me",
        json={"blog_color": "#3b82f6"},
        headers=editor_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["blog_color"] == "#3b82f6"


def test_update_website_url(client, app, editor_headers):
    res = client.put(
        "/api/auth/me",
        json={"website_url": "https://example.com"},
        headers=editor_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["website_url"] == "https://example.com"


def test_update_social_links(client, app, editor_headers):
    links = {"github": "https://github.com/testuser", "twitter": "", "linkedin": ""}
    res = client.put(
        "/api/auth/me",
        json={"social_links": links},
        headers=editor_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["social_links"]["github"] == "https://github.com/testuser"


def test_me_response_includes_customization_fields(client, app, editor_headers):
    res = client.get("/api/auth/me", headers=editor_headers)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "blog_title" in data
    assert "blog_color" in data
    assert "website_url" in data
    assert "social_links" in data


def test_update_blog_layout(client, app, editor_headers):
    res = client.put("/api/auth/me", json={"blog_layout": "compact"}, headers=editor_headers)
    assert res.status_code == 200
    assert res.get_json()["data"]["blog_layout"] == "compact"


def test_blog_layout_invalid_value(client, app, editor_headers):
    res = client.put("/api/auth/me", json={"blog_layout": "magazine"}, headers=editor_headers)
    assert res.status_code == 400


def test_me_includes_blog_layout(client, app, editor_headers):
    res = client.get("/api/auth/me", headers=editor_headers)
    assert res.status_code == 200
    assert "blog_layout" in res.get_json()["data"]
