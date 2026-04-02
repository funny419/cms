"""comments.py 커버리지 테스트."""

from database import db as _db


def make_post_and_user(app, username="commenter", role="editor"):
    """테스트용 유저+포스트 생성. (post_id, user_id) 반환."""
    from models import Post, User

    user = User(username=username, email=f"{username}@test.com", role=role)
    user.set_password("pass123")
    _db.session.add(user)
    _db.session.flush()
    post = Post(
        title="Test Post", slug=f"test-post-{username}", author_id=user.id, status="published"
    )
    _db.session.add(post)
    _db.session.commit()
    return post.id, user.id


def make_guest_comment(app, post_id, content="게스트 댓글"):
    """게스트 댓글 생성. comment_id 반환."""
    from werkzeug.security import generate_password_hash

    from models import Comment

    comment = Comment(
        post_id=post_id,
        author_id=None,
        author_name="게스트",
        author_email="guest@test.com",
        author_password_hash=generate_password_hash("guestpass"),
        content=content,
        status="pending",
    )
    _db.session.add(comment)
    _db.session.commit()
    return comment.id


def make_logged_in_comment(app, post_id, user_id, content="로그인 댓글"):
    """로그인 사용자 댓글 생성. comment_id 반환."""
    from models import Comment

    comment = Comment(
        post_id=post_id,
        author_id=user_id,
        author_name="editor_user",
        author_email="editor@test.com",
        content=content,
        status="approved",
    )
    _db.session.add(comment)
    _db.session.commit()
    return comment.id


# ─── POST /api/comments ───────────────────────────────────────────────────────


class TestCreateComment:
    def test_guest_comment_success(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "host1")
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id,
                "content": "게스트 댓글 내용",
                "author_name": "홍길동",
                "author_email": "hong@test.com",
                "author_password": "secret123",
            },
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data["success"] is True
        assert data["data"]["status"] == "pending"

    def test_logged_in_comment_success(self, client, app, editor_headers):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "host2")
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id,
                "content": "로그인 댓글 내용",
            },
            headers=editor_headers,
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data["success"] is True
        assert data["data"]["status"] == "approved"

    def test_missing_post_id(self, client):
        res = client.post("/api/comments", json={"content": "내용"})
        assert res.status_code == 400
        assert res.get_json()["success"] is False

    def test_missing_content(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "host3")
        res = client.post("/api/comments", json={"post_id": post_id})
        assert res.status_code == 400

    def test_invalid_post_id_type(self, client):
        res = client.post("/api/comments", json={"post_id": "abc", "content": "내용"})
        assert res.status_code == 400

    def test_content_too_long(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "host4")
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id,
                "content": "a" * 2001,
                "author_name": "홍길동",
                "author_email": "hong@test.com",
                "author_password": "secret123",
            },
        )
        assert res.status_code == 400

    def test_guest_missing_author_fields(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "host5")
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id,
                "content": "내용",
                # author_name, author_email, author_password 없음
            },
        )
        assert res.status_code == 400

    def test_spam_content_auto_detected(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "host6")
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id,
                "content": "casino is great! free money here",
                "author_name": "스패머",
                "author_email": "spam@test.com",
                "author_password": "secret123",
            },
        )
        assert res.status_code == 201
        assert res.get_json()["data"]["status"] == "spam"

    def test_reply_to_comment_success(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "host7")
            parent_id = make_guest_comment(app, post_id, "부모 댓글")
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id,
                "content": "답글입니다",
                "parent_id": parent_id,
                "author_name": "답글러",
                "author_email": "reply@test.com",
                "author_password": "secret123",
            },
        )
        assert res.status_code == 201

    def test_reply_to_nonexistent_parent(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "host8")
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id,
                "content": "답글",
                "parent_id": 99999,
                "author_name": "답글러",
                "author_email": "reply@test.com",
                "author_password": "secret123",
            },
        )
        assert res.status_code == 404

    def test_reply_to_different_post_parent(self, client, app):
        """parent_id가 다른 포스트에 속한 경우."""
        with app.app_context():
            post_id1, _ = make_post_and_user(app, "host9a")
            post_id2, _ = make_post_and_user(app, "host9b")
            parent_id = make_guest_comment(app, post_id1, "다른 포스트 댓글")
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id2,
                "content": "답글",
                "parent_id": parent_id,
                "author_name": "답글러",
                "author_email": "reply@test.com",
                "author_password": "secret123",
            },
        )
        assert res.status_code == 400

    def test_reply_to_reply_not_allowed(self, client, app):
        """답글에 답글 불가."""
        with app.app_context():
            post_id, _ = make_post_and_user(app, "host10")
            parent_id = make_guest_comment(app, post_id, "부모 댓글")
            # 부모에 답글 달기
            from werkzeug.security import generate_password_hash

            from models import Comment

            child = Comment(
                post_id=post_id,
                author_id=None,
                author_name="자식",
                author_email="child@test.com",
                author_password_hash=generate_password_hash("pass"),
                content="자식 댓글",
                parent_id=parent_id,
                status="approved",
            )
            _db.session.add(child)
            _db.session.commit()
            child_id = child.id
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id,
                "content": "손자 댓글",
                "parent_id": child_id,
                "author_name": "손자",
                "author_email": "grand@test.com",
                "author_password": "secret123",
            },
        )
        assert res.status_code == 400

    def test_deactivated_user_cannot_comment(self, client, app):
        """비활성화 사용자는 댓글 작성 불가."""
        with app.app_context():
            from models import User

            deact = User(username="deact_user", email="deact@test.com", role="deactivated")
            deact.set_password("pass123")
            _db.session.add(deact)
            _db.session.commit()
        client.post("/api/auth/login", json={"username": "deact_user", "password": "pass123"})
        # 비활성화 사용자는 로그인 자체가 막히므로 토큰을 수동 생성
        with app.app_context():
            from flask_jwt_extended import create_access_token

            from models import User

            deact = _db.session.execute(
                _db.select(User).where(User.username == "deact_user")
            ).scalar_one()
            token = create_access_token(identity=str(deact.id))
            post_id, _ = make_post_and_user(app, "host_deact")
        headers = {"Authorization": f"Bearer {token}"}
        res = client.post(
            "/api/comments",
            json={
                "post_id": post_id,
                "content": "비활성화 댓글",
            },
            headers=headers,
        )
        assert res.status_code == 403


# ─── GET /api/comments/post/<post_id> ────────────────────────────────────────


class TestListComments:
    def test_list_approved_comments(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "list1")
            make_guest_comment(app, post_id, "pending 댓글")  # pending — 미포함
            make_logged_in_comment(app, post_id, _, "approved 댓글")  # approved — 포함

        res = client.get(f"/api/comments/post/{post_id}")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        # approved만 반환
        assert len(data["data"]) == 1
        assert data["data"][0]["status"] == "approved"

    def test_list_comments_empty(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "list2")
        res = client.get(f"/api/comments/post/{post_id}")
        assert res.status_code == 200
        assert res.get_json()["data"] == []


# ─── PUT /api/comments/<id>/approve ──────────────────────────────────────────


class TestApproveComment:
    def test_admin_can_approve(self, client, app, admin_headers):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "appr1")
            comment_id = make_guest_comment(app, post_id)
        res = client.put(f"/api/comments/{comment_id}/approve", headers=admin_headers)
        assert res.status_code == 200
        assert res.get_json()["data"]["status"] == "approved"

    def test_editor_can_approve(self, client, app, editor_headers):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "appr2")
            comment_id = make_guest_comment(app, post_id)
        res = client.put(f"/api/comments/{comment_id}/approve", headers=editor_headers)
        assert res.status_code == 200

    def test_approve_not_found(self, client, admin_headers):
        res = client.put("/api/comments/99999/approve", headers=admin_headers)
        assert res.status_code == 404

    def test_approve_requires_auth(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "appr3")
            comment_id = make_guest_comment(app, post_id)
        res = client.put(f"/api/comments/{comment_id}/approve")
        assert res.status_code == 401


# ─── PUT /api/comments/<id> ───────────────────────────────────────────────────


class TestUpdateComment:
    def test_logged_in_user_update_own_comment(self, client, app, editor_headers):
        """editor_user 자신의 댓글을 수정."""
        with app.app_context():
            from models import Comment, User

            editor = _db.session.execute(
                _db.select(User).where(User.username == "editor_user")
            ).scalar_one()
            post_id, _ = make_post_and_user(app, "upd1host")
            comment = Comment(
                post_id=post_id,
                author_id=editor.id,
                author_name=editor.username,
                author_email=editor.email,
                content="원본 댓글",
                status="approved",
            )
            _db.session.add(comment)
            _db.session.commit()
            comment_id = comment.id
        res = client.put(
            f"/api/comments/{comment_id}", json={"content": "수정된 댓글"}, headers=editor_headers
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["content"] == "수정된 댓글"

    def test_logged_in_user_cannot_update_others(self, client, app, editor_headers):
        """editor는 타인 댓글 수정 불가."""
        with app.app_context():
            post_id, _ = make_post_and_user(app, "upd2host")
            # 다른 유저의 댓글 생성
            from models import Comment, User

            other = User(username="other_upd2", email="other_upd2@test.com", role="editor")
            other.set_password("pass")
            _db.session.add(other)
            _db.session.flush()
            comment = Comment(
                post_id=post_id,
                author_id=other.id,
                author_name=other.username,
                author_email=other.email,
                content="타인 댓글",
                status="approved",
            )
            _db.session.add(comment)
            _db.session.commit()
            comment_id = comment.id
        res = client.put(
            f"/api/comments/{comment_id}", json={"content": "해킹"}, headers=editor_headers
        )
        assert res.status_code == 403

    def test_admin_can_update_any_comment(self, client, app, admin_headers):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "upd3")
            comment_id = make_guest_comment(app, post_id, "원본")
        res = client.put(
            f"/api/comments/{comment_id}", json={"content": "admin 수정"}, headers=admin_headers
        )
        assert res.status_code == 200

    def test_guest_update_with_correct_credentials(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "upd4")
            comment_id = make_guest_comment(app, post_id, "게스트 원본")
        res = client.put(
            f"/api/comments/{comment_id}",
            json={
                "content": "게스트 수정",
                "author_email": "guest@test.com",
                "author_password": "guestpass",
            },
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["content"] == "게스트 수정"

    def test_guest_update_wrong_password(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "upd5")
            comment_id = make_guest_comment(app, post_id)
        res = client.put(
            f"/api/comments/{comment_id}",
            json={
                "content": "수정",
                "author_email": "guest@test.com",
                "author_password": "wrongpassword",
            },
        )
        assert res.status_code == 401

    def test_guest_update_missing_credentials(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "upd6")
            comment_id = make_guest_comment(app, post_id)
        res = client.put(f"/api/comments/{comment_id}", json={"content": "수정"})
        assert res.status_code == 400

    def test_update_not_found(self, client, admin_headers):
        res = client.put("/api/comments/99999", json={"content": "수정"}, headers=admin_headers)
        assert res.status_code == 404

    def test_update_empty_content(self, client, app, admin_headers):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "upd7")
            comment_id = make_guest_comment(app, post_id)
        res = client.put(f"/api/comments/{comment_id}", json={"content": ""}, headers=admin_headers)
        assert res.status_code == 400

    def test_update_content_too_long(self, client, app, admin_headers):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "upd8")
            comment_id = make_guest_comment(app, post_id)
        res = client.put(
            f"/api/comments/{comment_id}", json={"content": "a" * 2001}, headers=admin_headers
        )
        assert res.status_code == 400

    def test_guest_cannot_update_logged_in_comment(self, client, app):
        """게스트가 로그인 사용자 댓글 수정 시도."""
        with app.app_context():
            post_id, user_id = make_post_and_user(app, "upd9")
            comment_id = make_logged_in_comment(app, post_id, user_id)
        res = client.put(
            f"/api/comments/{comment_id}",
            json={
                "content": "수정",
                "author_email": "guest@test.com",
                "author_password": "guestpass",
            },
        )
        assert res.status_code == 401

    def test_deactivated_user_cannot_update(self, client, app):
        with app.app_context():
            from models import Comment, User

            deact = User(username="deact_upd", email="deact_upd@test.com", role="deactivated")
            deact.set_password("pass")
            _db.session.add(deact)
            _db.session.flush()
            post_id, _ = make_post_and_user(app, "upd_deact_host")
            comment = Comment(
                post_id=post_id,
                author_id=deact.id,
                author_name=deact.username,
                author_email=deact.email,
                content="댓글",
                status="approved",
            )
            _db.session.add(comment)
            _db.session.commit()
            comment_id = comment.id
            from flask_jwt_extended import create_access_token

            token = create_access_token(identity=str(deact.id))
        headers = {"Authorization": f"Bearer {token}"}
        res = client.put(f"/api/comments/{comment_id}", json={"content": "수정"}, headers=headers)
        assert res.status_code == 403


# ─── DELETE /api/comments/<id> ───────────────────────────────────────────────


class TestDeleteComment:
    def test_admin_can_delete_any(self, client, app, admin_headers):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "del1")
            comment_id = make_guest_comment(app, post_id)
        res = client.delete(f"/api/comments/{comment_id}", json={}, headers=admin_headers)
        assert res.status_code == 200

    def test_user_can_delete_own_comment(self, client, app, editor_headers):
        """editor_user 자신의 댓글 삭제."""
        with app.app_context():
            from models import Comment, User

            editor = _db.session.execute(
                _db.select(User).where(User.username == "editor_user")
            ).scalar_one()
            post_id, _ = make_post_and_user(app, "del2host")
            comment = Comment(
                post_id=post_id,
                author_id=editor.id,
                author_name=editor.username,
                author_email=editor.email,
                content="내 댓글",
                status="approved",
            )
            _db.session.add(comment)
            _db.session.commit()
            comment_id = comment.id
        res = client.delete(f"/api/comments/{comment_id}", json={}, headers=editor_headers)
        assert res.status_code == 200

    def test_user_cannot_delete_others_comment(self, client, app, editor_headers):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "del3host")
            from models import Comment, User

            other = User(username="other_del3", email="other_del3@test.com", role="editor")
            other.set_password("pass")
            _db.session.add(other)
            _db.session.flush()
            comment = Comment(
                post_id=post_id,
                author_id=other.id,
                author_name=other.username,
                author_email=other.email,
                content="타인 댓글",
                status="approved",
            )
            _db.session.add(comment)
            _db.session.commit()
            comment_id = comment.id
        res = client.delete(f"/api/comments/{comment_id}", json={}, headers=editor_headers)
        assert res.status_code == 403

    def test_guest_delete_with_correct_credentials(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "del4")
            comment_id = make_guest_comment(app, post_id)
        res = client.delete(
            f"/api/comments/{comment_id}",
            json={
                "author_email": "guest@test.com",
                "author_password": "guestpass",
            },
        )
        assert res.status_code == 200

    def test_guest_delete_wrong_credentials(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "del5")
            comment_id = make_guest_comment(app, post_id)
        res = client.delete(
            f"/api/comments/{comment_id}",
            json={
                "author_email": "guest@test.com",
                "author_password": "wrongpass",
            },
        )
        assert res.status_code == 401

    def test_guest_delete_missing_credentials(self, client, app):
        with app.app_context():
            post_id, _ = make_post_and_user(app, "del6")
            comment_id = make_guest_comment(app, post_id)
        res = client.delete(f"/api/comments/{comment_id}", json={})
        assert res.status_code == 400

    def test_delete_not_found(self, client, admin_headers):
        res = client.delete("/api/comments/99999", json={}, headers=admin_headers)
        assert res.status_code == 404

    def test_delete_cascades_replies(self, client, app, admin_headers):
        """부모 댓글 삭제 시 답글도 삭제."""
        with app.app_context():
            post_id, _ = make_post_and_user(app, "del7")
            parent_id = make_guest_comment(app, post_id, "부모")
            # 답글 생성
            from werkzeug.security import generate_password_hash

            from models import Comment

            reply = Comment(
                post_id=post_id,
                author_id=None,
                author_name="답글러",
                author_email="reply@test.com",
                author_password_hash=generate_password_hash("pass"),
                content="답글",
                parent_id=parent_id,
                status="approved",
            )
            _db.session.add(reply)
            _db.session.commit()

        res = client.delete(f"/api/comments/{parent_id}", json={}, headers=admin_headers)
        assert res.status_code == 200

    def test_deactivated_user_cannot_delete(self, client, app):
        with app.app_context():
            from models import Comment, User

            deact = User(username="deact_del", email="deact_del@test.com", role="deactivated")
            deact.set_password("pass")
            _db.session.add(deact)
            _db.session.flush()
            post_id, _ = make_post_and_user(app, "del_deact_host")
            comment = Comment(
                post_id=post_id,
                author_id=deact.id,
                author_name=deact.username,
                author_email=deact.email,
                content="댓글",
                status="approved",
            )
            _db.session.add(comment)
            _db.session.commit()
            comment_id = comment.id
            from flask_jwt_extended import create_access_token

            token = create_access_token(identity=str(deact.id))
        headers = {"Authorization": f"Bearer {token}"}
        res = client.delete(f"/api/comments/{comment_id}", json={}, headers=headers)
        assert res.status_code == 403

    def test_guest_cannot_delete_logged_in_comment(self, client, app):
        with app.app_context():
            post_id, user_id = make_post_and_user(app, "del8")
            comment_id = make_logged_in_comment(app, post_id, user_id)
        res = client.delete(
            f"/api/comments/{comment_id}",
            json={
                "author_email": "guest@test.com",
                "author_password": "guestpass",
            },
        )
        assert res.status_code == 401
