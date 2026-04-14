"""posts.py 미커버 라인 추가 테스트."""

import uuid

from database import db as _db


def make_user_and_post(
    app, username=None, status="published", visibility="public", category_id=None
):
    from models import Post, User

    username = username or f"u_{uuid.uuid4().hex[:6]}"
    user = User(username=username, email=f"{username}@test.com", role="editor")
    user.set_password("pass123")
    _db.session.add(user)
    _db.session.flush()
    post = Post(
        title=f"{username}의 포스트",
        slug=f"post-{uuid.uuid4().hex[:8]}",
        author_id=user.id,
        status=status,
        visibility=visibility,
        category_id=category_id,
    )
    _db.session.add(post)
    _db.session.commit()
    return user.id, post.id, username


def get_token(client, username):
    res = client.post("/api/auth/login", json={"username": username, "password": "pass123"})
    return res.get_json()["data"]["access_token"]


# ─── GET /api/posts — 필터 케이스 ────────────────────────────────────────────


class TestListPostsFilters:
    def test_filter_by_author_existing(self, client, app):
        with app.app_context():
            _, post_id, username = make_user_and_post(app, "filter_author1")
        res = client.get(f"/api/posts?author={username}")
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["total"] >= 1

    def test_filter_by_nonexistent_author_empty(self, client):
        res = client.get("/api/posts?author=nobody_xyz_abc")
        assert res.status_code == 200
        assert res.get_json()["data"]["total"] == 0

    def test_filter_by_category_id(self, client, app):
        with app.app_context():
            from models import Category

            cat = Category(name="필터카테고리", slug="filter-cat")
            _db.session.add(cat)
            _db.session.commit()
            cat_id = cat.id
            make_user_and_post(app, "catfilter1", category_id=cat_id)
        res = client.get(f"/api/posts?category_id={cat_id}")
        assert res.status_code == 200
        assert res.get_json()["data"]["total"] == 1

    def test_filter_by_tags(self, client, app):
        with app.app_context():
            from models import Post, PostTag, Tag, User

            user = User(username="tagfilter_u", email="tagfilter_u@test.com", role="editor")
            user.set_password("pass123")
            _db.session.add(user)
            _db.session.flush()
            tag = Tag(name="FilterTag", slug="filter-tag")
            _db.session.add(tag)
            _db.session.flush()
            post = Post(
                title="태그필터포스트",
                slug=f"tagfilter-{uuid.uuid4().hex[:6]}",
                author_id=user.id,
                status="published",
                visibility="public",
            )
            _db.session.add(post)
            _db.session.flush()
            _db.session.add(PostTag(post_id=post.id, tag_id=tag.id))
            _db.session.commit()
            tag_id = tag.id

        res = client.get(f"/api/posts?tags={tag_id}")
        assert res.status_code == 200
        assert res.get_json()["data"]["total"] >= 1

    def test_logged_in_admin_sees_all_visibility(self, client, app, admin_headers):
        """admin은 private 포스트도 조회 가능."""
        with app.app_context():
            make_user_and_post(app, "priv_author", visibility="private")
        res = client.get("/api/posts", headers=admin_headers)
        assert res.status_code == 200
        # admin은 visibility 제한 없이 조회
        data = res.get_json()["data"]
        assert data["total"] >= 1

    def test_logged_in_editor_sees_members_only(self, client, app, editor_headers):
        with app.app_context():
            make_user_and_post(app, "monly_a", visibility="members_only")
        res = client.get("/api/posts", headers=editor_headers)
        assert res.status_code == 200


# ─── GET /api/posts/mine ─────────────────────────────────────────────────────


class TestGetMyPosts:
    def test_get_mine_success(self, client, app, editor_headers):
        with app.app_context():
            from models import Post, User

            editor = _db.session.execute(
                _db.select(User).where(User.username == "editor_user")
            ).scalar_one()
            post = Post(
                title="내 포스트",
                slug=f"my-{uuid.uuid4().hex[:8]}",
                author_id=editor.id,
                status="draft",
            )
            _db.session.add(post)
            _db.session.commit()
        res = client.get("/api/posts/mine", headers=editor_headers)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["total"] >= 1

    def test_get_mine_requires_auth(self, client):
        res = client.get("/api/posts/mine")
        assert res.status_code == 401


# ─── POST /api/posts/:id/like ─────────────────────────────────────────────────


class TestPostLike:
    def test_like_post(self, client, app, editor_headers):
        with app.app_context():
            _, post_id, _ = make_user_and_post(app, "like_host1")
        res = client.post(f"/api/posts/{post_id}/like", headers=editor_headers)
        assert res.status_code in (200, 201)
        assert res.get_json()["data"]["liked"] is True

    def test_unlike_post(self, client, app, editor_headers):
        """두 번 누르면 언라이크."""
        with app.app_context():
            _, post_id, _ = make_user_and_post(app, "like_host2")
        client.post(f"/api/posts/{post_id}/like", headers=editor_headers)
        res = client.post(f"/api/posts/{post_id}/like", headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["liked"] is False

    def test_cannot_like_own_post(self, client, app):
        with app.app_context():
            uid, post_id, username = make_user_and_post(app, "like_own_author")
        token = get_token(client, username)
        res = client.post(
            f"/api/posts/{post_id}/like", headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 400

    def test_like_nonexistent_post(self, client, editor_headers):
        res = client.post("/api/posts/99999/like", headers=editor_headers)
        assert res.status_code == 404

    def test_like_requires_auth(self, client, app):
        with app.app_context():
            _, post_id, _ = make_user_and_post(app, "like_noauth")
        res = client.post(f"/api/posts/{post_id}/like")
        assert res.status_code == 401


# ─── POST /api/posts (추가 케이스) ───────────────────────────────────────────


class TestCreatePost:
    def test_create_minimal_post(self, client, editor_headers):
        res = client.post("/api/posts", json={"title": "최소 포스트"}, headers=editor_headers)
        assert res.status_code == 201
        assert res.get_json()["data"]["title"] == "최소 포스트"

    def test_create_post_requires_auth(self, client):
        res = client.post("/api/posts", json={"title": "비로그인 포스트"})
        assert res.status_code == 401

    def test_create_post_missing_title(self, client, editor_headers):
        res = client.post("/api/posts", json={"content": "제목 없음"}, headers=editor_headers)
        assert res.status_code == 400


# ─── DELETE /api/posts/:id ────────────────────────────────────────────────────


class TestDeletePost:
    def test_editor_can_delete_own_post(self, client, app, editor_headers):
        with app.app_context():
            from models import Post, User

            editor = _db.session.execute(
                _db.select(User).where(User.username == "editor_user")
            ).scalar_one()
            post = Post(
                title="삭제할 포스트",
                slug=f"del-post-{uuid.uuid4().hex[:8]}",
                author_id=editor.id,
                status="draft",
            )
            _db.session.add(post)
            _db.session.commit()
            post_id = post.id
        res = client.delete(f"/api/posts/{post_id}", headers=editor_headers)
        assert res.status_code == 200

    def test_editor_cannot_delete_others_post(self, client, app, editor_headers):
        with app.app_context():
            _, post_id, _ = make_user_and_post(app, "del_other_host")
        res = client.delete(f"/api/posts/{post_id}", headers=editor_headers)
        assert res.status_code == 403

    def test_admin_can_delete_any_post(self, client, app, admin_headers):
        with app.app_context():
            _, post_id, _ = make_user_and_post(app, "del_admin_host")
        res = client.delete(f"/api/posts/{post_id}", headers=admin_headers)
        assert res.status_code == 200

    def test_delete_nonexistent_post(self, client, editor_headers):
        res = client.delete("/api/posts/99999", headers=editor_headers)
        assert res.status_code == 404


# ─── PUT /api/posts/:id ───────────────────────────────────────────────────────


class TestUpdatePost:
    def test_editor_can_update_own_post(self, client, app, editor_headers):
        with app.app_context():
            from models import Post, User

            editor = _db.session.execute(
                _db.select(User).where(User.username == "editor_user")
            ).scalar_one()
            post = Post(
                title="수정 전",
                slug=f"upd-post-{uuid.uuid4().hex[:8]}",
                author_id=editor.id,
                status="draft",
            )
            _db.session.add(post)
            _db.session.commit()
            post_id = post.id
        res = client.put(f"/api/posts/{post_id}", json={"title": "수정 후"}, headers=editor_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["title"] == "수정 후"

    def test_editor_cannot_update_others_post(self, client, app, editor_headers):
        with app.app_context():
            _, post_id, _ = make_user_and_post(app, "upd_other_host")
        res = client.put(f"/api/posts/{post_id}", json={"title": "해킹"}, headers=editor_headers)
        assert res.status_code == 403

    def test_update_nonexistent_post(self, client, editor_headers):
        res = client.put("/api/posts/99999", json={"title": "없음"}, headers=editor_headers)
        assert res.status_code == 404
