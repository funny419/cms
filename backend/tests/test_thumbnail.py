"""thumbnail_url 필드 — 포스트 생성/수정/조회 테스트."""


def test_create_post_with_thumbnail(client, app, editor_headers):
    res = client.post(
        "/api/posts",
        json={
            "title": "썸네일 테스트",
            "content": "내용",
            "status": "published",
            "thumbnail_url": "https://example.com/image.jpg",
        },
        headers=editor_headers,
    )
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["thumbnail_url"] == "https://example.com/image.jpg"


def test_update_post_thumbnail(client, app, editor_headers):
    # 포스트 생성
    res = client.post(
        "/api/posts",
        json={"title": "수정 전", "content": "내용", "status": "published"},
        headers=editor_headers,
    )
    post_id = res.get_json()["data"]["id"]

    # thumbnail_url 업데이트
    res = client.put(
        f"/api/posts/{post_id}",
        json={"thumbnail_url": "https://cdn.example.com/thumb.png"},
        headers=editor_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["thumbnail_url"] == "https://cdn.example.com/thumb.png"


def test_post_thumbnail_null_by_default(client, app, editor_headers):
    res = client.post(
        "/api/posts",
        json={"title": "기본값 테스트", "content": "내용", "status": "published"},
        headers=editor_headers,
    )
    assert res.status_code == 201
    assert res.get_json()["data"]["thumbnail_url"] is None
