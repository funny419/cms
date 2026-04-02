"""시리즈 API 검증 — 8개 엔드포인트 권한/동작."""

import uuid

from database import db as _db


def make_user(role="editor"):
    from models import User

    uname = f"u_{uuid.uuid4().hex[:6]}"
    user = User(username=uname, email=f"{uname}@t.com", role=role)
    user.set_password("pass")
    _db.session.add(user)
    _db.session.commit()
    return user.id, uname


def get_token(client, username):
    res = client.post("/api/auth/login", json={"username": username, "password": "pass"})
    return res.get_json()["data"]["access_token"]


def make_post(author_id):
    from models import Post

    post = Post(
        title=f"Post {uuid.uuid4().hex[:4]}",
        slug=uuid.uuid4().hex[:8],
        author_id=author_id,
        status="published",
    )
    _db.session.add(post)
    _db.session.commit()
    return post.id


# ────────────────────────────── 기본 CRUD ──────────────────────────────


def test_create_series_by_editor(client, app):
    """editor가 시리즈를 생성할 수 있어야 한다."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    res = client.post(
        "/api/series",
        json={"title": "My Series", "description": "테스트 시리즈"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["title"] == "My Series"
    assert data["total"] == 0


def test_create_series_requires_login(client, app):
    """비로그인 시 시리즈 생성 거부."""
    res = client.post("/api/series", json={"title": "Unauthorized"})
    assert res.status_code == 401


def test_create_series_requires_title(client, app):
    """title 없으면 400 반환."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    res = client.post(
        "/api/series",
        json={"description": "no title"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400


def test_get_series(client, app):
    """GET /api/series/:id — 정상 조회."""
    with app.app_context():
        uid, uname = make_user("editor")
    token = get_token(client, uname)
    create_res = client.post(
        "/api/series",
        json={"title": "Readable Series"},
        headers={"Authorization": f"Bearer {token}"},
    )
    series_id = create_res.get_json()["data"]["id"]

    res = client.get(f"/api/series/{series_id}")
    assert res.status_code == 200
    assert res.get_json()["data"]["id"] == series_id


def test_get_series_not_found(client, app):
    """존재하지 않는 시리즈 → 404."""
    res = client.get("/api/series/99999")
    assert res.status_code == 404


def test_get_user_series(client, app):
    """GET /api/users/:username/series — 유저 시리즈 목록."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    client.post("/api/series", json={"title": "S1"}, headers={"Authorization": f"Bearer {token}"})
    client.post("/api/series", json={"title": "S2"}, headers={"Authorization": f"Bearer {token}"})

    res = client.get(f"/api/users/{uname}/series")
    assert res.status_code == 200
    items = res.get_json()["data"]
    assert len(items) >= 2


def test_update_series_by_owner(client, app):
    """소유자는 시리즈 제목/설명 수정 가능."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    create_res = client.post(
        "/api/series", json={"title": "Original"}, headers={"Authorization": f"Bearer {token}"}
    )
    series_id = create_res.get_json()["data"]["id"]

    res = client.put(
        f"/api/series/{series_id}",
        json={"title": "Updated Title"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["title"] == "Updated Title"


def test_update_series_by_other_user_forbidden(client, app):
    """타인은 시리즈 수정 불가 → 403."""
    with app.app_context():
        _, owner = make_user("editor")
        _, other = make_user("editor")
    owner_token = get_token(client, owner)
    other_token = get_token(client, other)

    create_res = client.post(
        "/api/series",
        json={"title": "Owner Series"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    series_id = create_res.get_json()["data"]["id"]

    res = client.put(
        f"/api/series/{series_id}",
        json={"title": "Hacked"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res.status_code == 403


def test_delete_series_by_owner(client, app):
    """소유자는 시리즈 삭제 가능."""
    with app.app_context():
        _, uname = make_user("editor")
    token = get_token(client, uname)
    create_res = client.post(
        "/api/series", json={"title": "To Delete"}, headers={"Authorization": f"Bearer {token}"}
    )
    series_id = create_res.get_json()["data"]["id"]

    res = client.delete(f"/api/series/{series_id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

    # 삭제 후 조회 → 404
    assert client.get(f"/api/series/{series_id}").status_code == 404


def test_delete_series_by_other_forbidden(client, app):
    """타인은 시리즈 삭제 불가 → 403."""
    with app.app_context():
        _, owner = make_user("editor")
        _, other = make_user("editor")
    owner_token = get_token(client, owner)
    other_token = get_token(client, other)

    create_res = client.post(
        "/api/series",
        json={"title": "Protected Series"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    series_id = create_res.get_json()["data"]["id"]

    res = client.delete(
        f"/api/series/{series_id}", headers={"Authorization": f"Bearer {other_token}"}
    )
    assert res.status_code == 403


# ────────────────────────────── 포스트 추가/제거 ──────────────────────────────


def test_add_post_to_series(client, app):
    """소유자가 시리즈에 포스트 추가 가능."""
    with app.app_context():
        uid, uname = make_user("editor")
        post_id = make_post(uid)
    token = get_token(client, uname)

    create_res = client.post(
        "/api/series", json={"title": "With Posts"}, headers={"Authorization": f"Bearer {token}"}
    )
    series_id = create_res.get_json()["data"]["id"]

    res = client.post(
        f"/api/series/{series_id}/posts",
        json={"post_id": post_id, "order": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["total"] == 1
    assert data["posts"][0]["id"] == post_id


def test_add_duplicate_post_to_series_returns_409(client, app):
    """같은 포스트 중복 추가 시 409 반환 (UNIQUE 제약)."""
    with app.app_context():
        uid, uname = make_user("editor")
        post_id = make_post(uid)
    token = get_token(client, uname)

    create_res = client.post(
        "/api/series", json={"title": "Dup Test"}, headers={"Authorization": f"Bearer {token}"}
    )
    series_id = create_res.get_json()["data"]["id"]

    client.post(
        f"/api/series/{series_id}/posts",
        json={"post_id": post_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    res = client.post(
        f"/api/series/{series_id}/posts",
        json={"post_id": post_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 409


def test_remove_post_from_series(client, app):
    """소유자가 시리즈에서 포스트 제거 가능."""
    with app.app_context():
        uid, uname = make_user("editor")
        post_id = make_post(uid)
    token = get_token(client, uname)

    create_res = client.post(
        "/api/series", json={"title": "Remove Test"}, headers={"Authorization": f"Bearer {token}"}
    )
    series_id = create_res.get_json()["data"]["id"]
    client.post(
        f"/api/series/{series_id}/posts",
        json={"post_id": post_id},
        headers={"Authorization": f"Bearer {token}"},
    )

    res = client.delete(
        f"/api/series/{series_id}/posts/{post_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200


def test_reorder_series_posts(client, app):
    """포스트 순서 변경 가능."""
    with app.app_context():
        uid, uname = make_user("editor")
        pid1 = make_post(uid)
        pid2 = make_post(uid)
    token = get_token(client, uname)

    create_res = client.post(
        "/api/series", json={"title": "Reorder Test"}, headers={"Authorization": f"Bearer {token}"}
    )
    series_id = create_res.get_json()["data"]["id"]
    client.post(
        f"/api/series/{series_id}/posts",
        json={"post_id": pid1, "order": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        f"/api/series/{series_id}/posts",
        json={"post_id": pid2, "order": 2},
        headers={"Authorization": f"Bearer {token}"},
    )

    res = client.put(
        f"/api/series/{series_id}/posts/reorder",
        json={"items": [{"post_id": pid1, "order": 2}, {"post_id": pid2, "order": 1}]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200


# ────────────────────────────── GET /api/posts/:id series 임베드 ──────────────────────────────


def test_post_detail_includes_series_field(client, app):
    """GET /api/posts/:id 응답에 series 필드가 항상 포함되어야 한다."""
    with app.app_context():
        uid, uname = make_user("editor")
        post_id = make_post(uid)
    get_token(client, uname)

    # 시리즈 없는 포스트 → series=None
    res = client.get(f"/api/posts/{post_id}")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "series" in data
    assert data["series"] is None


def test_post_detail_series_info_when_in_series(client, app):
    """시리즈에 속한 포스트 조회 시 series 정보가 정확히 임베드되어야 한다."""
    with app.app_context():
        uid, uname = make_user("editor")
        pid1 = make_post(uid)
        pid2 = make_post(uid)
        pid3 = make_post(uid)
    token = get_token(client, uname)

    create_res = client.post(
        "/api/series",
        json={"title": "Detail Test Series"},
        headers={"Authorization": f"Bearer {token}"},
    )
    series_id = create_res.get_json()["data"]["id"]

    for i, pid in enumerate([pid1, pid2, pid3], 1):
        client.post(
            f"/api/series/{series_id}/posts",
            json={"post_id": pid, "order": i},
            headers={"Authorization": f"Bearer {token}"},
        )

    # 두 번째 포스트 조회 → prev/next 모두 있어야 함
    res = client.get(f"/api/posts/{pid2}?skip_count=1")
    assert res.status_code == 200
    series = res.get_json()["data"]["series"]
    assert series is not None
    assert series["total"] == 3
    assert series["prev_post"] is not None and series["prev_post"]["id"] == pid1
    assert series["next_post"] is not None and series["next_post"]["id"] == pid3

    # 첫 번째 포스트 → prev=None, next=pid2
    res = client.get(f"/api/posts/{pid1}?skip_count=1")
    s = res.get_json()["data"]["series"]
    assert s["prev_post"] is None
    assert s["next_post"]["id"] == pid2

    # 마지막 포스트 → prev=pid2, next=None
    res = client.get(f"/api/posts/{pid3}?skip_count=1")
    s = res.get_json()["data"]["series"]
    assert s["prev_post"]["id"] == pid2
    assert s["next_post"] is None
