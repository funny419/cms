"""feeds.py 커버리지 테스트."""

from database import db as _db


def make_user_with_posts(
    app, username, role="editor", post_count=2, visibility="public", status="published"
):
    from models import Post, User

    user = User(username=username, email=f"{username}@test.com", role=role)
    user.set_password("pass")
    user.blog_title = f"{username}의 블로그"
    user.bio = f"{username} 소개"
    _db.session.add(user)
    _db.session.flush()
    for i in range(post_count):
        post = Post(
            title=f"포스트{i}",
            slug=f"{username}-post-{i}",
            author_id=user.id,
            status=status,
            visibility=visibility,
            excerpt=f"요약{i}",
        )
        _db.session.add(post)
    _db.session.commit()
    return user.id


class TestRssFeed:
    def test_valid_user_feed(self, client, app):
        with app.app_context():
            make_user_with_posts(app, "feeduser1", post_count=3)
        res = client.get("/blog/feeduser1/feed.xml")
        assert res.status_code == 200
        assert b"<?xml" in res.data
        assert b"feeduser1" in res.data
        assert b"<item>" in res.data

    def test_feed_content_type_is_rss(self, client, app):
        with app.app_context():
            make_user_with_posts(app, "feeduser2")
        res = client.get("/blog/feeduser2/feed.xml")
        assert res.status_code == 200
        assert "rss+xml" in res.content_type

    def test_unknown_user_returns_404(self, client):
        res = client.get("/blog/nonexistent_xyz/feed.xml")
        assert res.status_code == 404

    def test_deactivated_user_returns_404(self, client, app):
        with app.app_context():
            make_user_with_posts(app, "feeddeact", role="deactivated", post_count=1)
        res = client.get("/blog/feeddeact/feed.xml")
        assert res.status_code == 404

    def test_only_published_public_posts_included(self, client, app):
        """draft 포스트와 private 포스트는 피드에 포함되지 않음."""
        with app.app_context():
            from models import Post, User

            user = User(username="feedfilter", email="feedfilter@test.com", role="editor")
            user.set_password("pass")
            _db.session.add(user)
            _db.session.flush()
            # published + public → 포함
            post_pub = Post(
                title="공개 포스트",
                slug="feedfilter-public",
                author_id=user.id,
                status="published",
                visibility="public",
            )
            # draft → 미포함
            post_draft = Post(
                title="드래프트",
                slug="feedfilter-draft",
                author_id=user.id,
                status="draft",
                visibility="public",
            )
            # published + private → 미포함
            post_private = Post(
                title="비공개 포스트",
                slug="feedfilter-private",
                author_id=user.id,
                status="published",
                visibility="private",
            )
            _db.session.add_all([post_pub, post_draft, post_private])
            _db.session.commit()

        res = client.get("/blog/feedfilter/feed.xml")
        assert res.status_code == 200
        xml = res.data.decode("utf-8")
        assert "공개 포스트" in xml
        assert "드래프트" not in xml
        assert "비공개 포스트" not in xml

    def test_feed_uses_blog_title(self, client, app):
        with app.app_context():
            from models import User

            user = User(username="feedtitle", email="feedtitle@test.com", role="editor")
            user.set_password("pass")
            user.blog_title = "커스텀 블로그 제목"
            _db.session.add(user)
            _db.session.commit()
        res = client.get("/blog/feedtitle/feed.xml")
        assert res.status_code == 200
        assert "커스텀 블로그 제목" in res.data.decode("utf-8")

    def test_feed_defaults_title_without_blog_title(self, client, app):
        """blog_title이 없으면 username + '의 블로그' 사용."""
        with app.app_context():
            from models import User

            user = User(username="feednotitle", email="feednotitle@test.com", role="editor")
            user.set_password("pass")
            user.blog_title = None
            _db.session.add(user)
            _db.session.commit()
        res = client.get("/blog/feednotitle/feed.xml")
        assert res.status_code == 200
        assert b"feednotitle" in res.data

    def test_empty_feed_still_valid_xml(self, client, app):
        """포스트가 없어도 유효한 RSS XML 반환."""
        with app.app_context():
            from models import User

            user = User(username="feedempty", email="feedempty@test.com", role="editor")
            user.set_password("pass")
            _db.session.add(user)
            _db.session.commit()
        res = client.get("/blog/feedempty/feed.xml")
        assert res.status_code == 200
        assert b"<?xml" in res.data
        assert b"<channel>" in res.data

    def test_feed_max_20_posts(self, client, app):
        """최대 20개 포스트만 반환."""
        with app.app_context():
            make_user_with_posts(app, "feedmax", post_count=25)
        res = client.get("/blog/feedmax/feed.xml")
        assert res.status_code == 200
        xml = res.data.decode("utf-8")
        item_count = xml.count("<item>")
        assert item_count <= 20
