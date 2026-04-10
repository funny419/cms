"""admin.py 커버리지 테스트 (test_admin_comments.py 보완)."""

from database import db as _db


def make_user(app, username, role="editor"):
    from models import User

    user = User(username=username, email=f"{username}@test.com", role=role)
    user.set_password("pass123")
    _db.session.add(user)
    _db.session.commit()
    return user.id


def make_post(app, author_id, title="테스트 포스트", status="published"):
    from models import Post

    slug = title.replace(" ", "-").lower()
    post = Post(title=title, slug=slug, author_id=author_id, status=status)
    _db.session.add(post)
    _db.session.commit()
    return post.id


def make_comment_for_post(app, post_id, content="댓글", status="pending"):
    from models import Comment

    comment = Comment(
        post_id=post_id,
        author_id=None,
        author_name="게스트",
        author_email="g@test.com",
        content=content,
        status=status,
    )
    _db.session.add(comment)
    _db.session.commit()
    return comment.id


# ─── GET /api/admin/posts ─────────────────────────────────────────────────────


class TestAdminListPosts:
    def test_list_all_posts(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "ap_author1")
            make_post(app, uid, "포스트A", "published")
            make_post(app, uid, "포스트B", "draft")
        res = client.get("/api/admin/posts", headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert data["data"]["total"] == 2

    def test_filter_by_status(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "ap_author2")
            make_post(app, uid, "published-post", "published")
            make_post(app, uid, "draft-post", "draft")
        res = client.get("/api/admin/posts?status=published", headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["total"] == 1
        assert data["items"][0]["status"] == "published"

    def test_search_by_title(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "ap_author3")
            make_post(app, uid, "검색대상포스트", "published")
            make_post(app, uid, "다른포스트", "published")
        res = client.get("/api/admin/posts?q=검색대상", headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["total"] == 1

    def test_pagination(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "ap_author4")
            for i in range(5):
                make_post(app, uid, f"포스트{i}", "published")
        res = client.get("/api/admin/posts?page=1&per_page=2", headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data["items"]) == 2
        assert data["total"] == 5
        assert data["has_more"] is True

    def test_requires_admin(self, client, editor_headers):
        res = client.get("/api/admin/posts", headers=editor_headers)
        assert res.status_code == 403

    def test_requires_auth(self, client):
        res = client.get("/api/admin/posts")
        assert res.status_code == 401


# ─── GET /api/admin/users ─────────────────────────────────────────────────────


class TestAdminListUsers:
    def test_list_users(self, client, app, admin_headers):
        with app.app_context():
            make_user(app, "listuser1")
            make_user(app, "listuser2", "deactivated")
        res = client.get("/api/admin/users", headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        payload = data["data"]
        assert "items" in payload
        assert "total" in payload
        assert "page" in payload
        assert "per_page" in payload
        assert "has_more" in payload
        # admin_user fixture 포함하여 최소 3명
        assert payload["total"] >= 3
        assert len(payload["items"]) >= 3

    def test_requires_admin(self, client, editor_headers):
        res = client.get("/api/admin/users", headers=editor_headers)
        assert res.status_code == 403


# ─── PUT /api/admin/users/<id>/role ──────────────────────────────────────────


class TestAdminChangeRole:
    def test_change_editor_to_admin(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "role_target1")
        res = client.put(
            f"/api/admin/users/{uid}/role", json={"role": "admin"}, headers=admin_headers
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["role"] == "admin"

    def test_change_admin_to_editor(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "role_target2", "admin")
        res = client.put(
            f"/api/admin/users/{uid}/role", json={"role": "editor"}, headers=admin_headers
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["role"] == "editor"

    def test_invalid_role_rejected(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "role_target3")
        res = client.put(
            f"/api/admin/users/{uid}/role", json={"role": "superadmin"}, headers=admin_headers
        )
        assert res.status_code == 400

    def test_cannot_change_own_role(self, client, app, admin_headers):
        """자기 자신의 권한 변경 불가."""
        # admin_user의 ID 조회
        with app.app_context():
            from models import User

            admin = _db.session.execute(
                _db.select(User).where(User.username == "admin_user")
            ).scalar_one()
            admin_id = admin.id
        res = client.put(
            f"/api/admin/users/{admin_id}/role", json={"role": "editor"}, headers=admin_headers
        )
        assert res.status_code == 403

    def test_user_not_found(self, client, admin_headers):
        res = client.put(
            "/api/admin/users/99999/role", json={"role": "editor"}, headers=admin_headers
        )
        assert res.status_code == 404

    def test_requires_admin(self, client, editor_headers):
        res = client.put("/api/admin/users/1/role", json={"role": "editor"}, headers=editor_headers)
        assert res.status_code == 403


# ─── PUT /api/admin/users/<id>/deactivate ────────────────────────────────────


class TestAdminDeactivateUser:
    def test_deactivate_user(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "deact_target1")
        res = client.put(f"/api/admin/users/{uid}/deactivate", headers=admin_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["role"] == "deactivated"

    def test_cannot_deactivate_self(self, client, app, admin_headers):
        with app.app_context():
            from models import User

            admin = _db.session.execute(
                _db.select(User).where(User.username == "admin_user")
            ).scalar_one()
            admin_id = admin.id
        res = client.put(f"/api/admin/users/{admin_id}/deactivate", headers=admin_headers)
        assert res.status_code == 403

    def test_user_not_found(self, client, admin_headers):
        res = client.put("/api/admin/users/99999/deactivate", headers=admin_headers)
        assert res.status_code == 404

    def test_requires_admin(self, client, editor_headers):
        res = client.put("/api/admin/users/1/deactivate", headers=editor_headers)
        assert res.status_code == 403


# ─── DELETE /api/admin/users/<id> ────────────────────────────────────────────


class TestAdminDeleteUser:
    def test_delete_user_nullifies_posts(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "del_target1")
            post_id = make_post(app, uid, "삭제될 유저 포스트")
        res = client.delete(f"/api/admin/users/{uid}", headers=admin_headers)
        assert res.status_code == 200
        # 포스트는 남아 있고 author_id만 NULL
        with app.app_context():
            from models import Post

            post = _db.session.get(Post, post_id)
            assert post is not None
            assert post.author_id is None

    def test_cannot_delete_self(self, client, app, admin_headers):
        with app.app_context():
            from models import User

            admin = _db.session.execute(
                _db.select(User).where(User.username == "admin_user")
            ).scalar_one()
            admin_id = admin.id
        res = client.delete(f"/api/admin/users/{admin_id}", headers=admin_headers)
        assert res.status_code == 403

    def test_user_not_found(self, client, admin_headers):
        res = client.delete("/api/admin/users/99999", headers=admin_headers)
        assert res.status_code == 404

    def test_requires_admin(self, client, editor_headers):
        res = client.delete("/api/admin/users/1", headers=editor_headers)
        assert res.status_code == 403


# ─── GET /api/admin/users/<id>/posts ─────────────────────────────────────────


class TestAdminUserPosts:
    def test_get_user_posts(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "userposts1")
            make_post(app, uid, "유저포스트1")
            make_post(app, uid, "유저포스트2", "draft")
        res = client.get(f"/api/admin/users/{uid}/posts", headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert len(data["data"]) == 2

    def test_user_not_found(self, client, admin_headers):
        res = client.get("/api/admin/users/99999/posts", headers=admin_headers)
        assert res.status_code == 404

    def test_requires_admin(self, client, editor_headers):
        res = client.get("/api/admin/users/1/posts", headers=editor_headers)
        assert res.status_code == 403


# ─── GET /api/admin/comments ─────────────────────────────────────────────────


class TestAdminListComments:
    def test_list_all_comments(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "cmt_author1")
            pid = make_post(app, uid, "댓글테스트포스트1")
            make_comment_for_post(app, pid, "pending 댓글", "pending")
            make_comment_for_post(app, pid, "approved 댓글", "approved")
        res = client.get("/api/admin/comments", headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["total"] == 2

    def test_filter_by_status(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "cmt_author2")
            pid = make_post(app, uid, "댓글테스트포스트2")
            make_comment_for_post(app, pid, "pending 댓글", "pending")
            make_comment_for_post(app, pid, "approved 댓글", "approved")
        res = client.get("/api/admin/comments?status=pending", headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["total"] == 1

    def test_pagination(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "cmt_author3")
            pid = make_post(app, uid, "댓글테스트포스트3")
            for i in range(5):
                make_comment_for_post(app, pid, f"댓글{i}", "approved")
        res = client.get("/api/admin/comments?page=1&per_page=2", headers=admin_headers)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data["items"]) == 2
        assert data["has_more"] is True

    def test_comment_includes_post_title(self, client, app, admin_headers):
        with app.app_context():
            uid = make_user(app, "cmt_author4")
            pid = make_post(app, uid, "포스트제목테스트")
            make_comment_for_post(app, pid, "댓글 내용")
        res = client.get("/api/admin/comments", headers=admin_headers)
        assert res.status_code == 200
        items = res.get_json()["data"]["items"]
        assert len(items) == 1
        assert items[0]["post_title"] == "포스트제목테스트"

    def test_requires_admin(self, client, editor_headers):
        res = client.get("/api/admin/comments", headers=editor_headers)
        assert res.status_code == 403
