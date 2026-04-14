from pathlib import Path

import pytest

from app import create_app  # noqa: E402
from database import db as _db  # noqa: E402


class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "mysql+pymysql://funnycms:dev_app_password@db:3306/cmsdb_test"
    SQLALCHEMY_ENGINE_OPTIONS = {"execution_options": {"isolation_level": "READ COMMITTED"}}
    JWT_SECRET_KEY = "test-secret-key"
    JWT_ACCESS_TOKEN_EXPIRES = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = "test-secret"
    STORAGE_BACKEND = "local"
    UPLOAD_FOLDER = "/tmp/cms_test_uploads"
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
    RATELIMIT_ENABLED = False


@pytest.fixture(scope="session")
def app():
    app = create_app(TestConfig)
    with app.app_context():
        _db.create_all()
        # create_all()은 마이그레이션을 실행하지 않으므로 FULLTEXT 인덱스를 수동 생성
        _db.session.execute(
            _db.text(
                "ALTER TABLE posts ADD FULLTEXT INDEX IF NOT EXISTS ft_posts_search (title, content, excerpt)"
            )
        )
        _db.session.commit()
        yield app
        _db.drop_all()


@pytest.fixture(scope="function", autouse=True)
def clean_db(app):
    with app.app_context():
        yield
        _db.session.rollback()
        # FK 체크 비활성화 후 TRUNCATE (auto_increment 리셋)
        _db.session.execute(_db.text("SET FOREIGN_KEY_CHECKS = 0"))
        for table in _db.metadata.sorted_tables:
            _db.session.execute(_db.text(f"TRUNCATE TABLE `{table.name}`"))
        _db.session.execute(_db.text("SET FOREIGN_KEY_CHECKS = 1"))
        _db.session.commit()


@pytest.fixture(autouse=True)
def cleanup_uploads():
    yield
    uploads_dir = Path("/app/uploads")
    for f in uploads_dir.iterdir():
        if f.is_file() and f.name != ".gitkeep":
            f.unlink()


@pytest.fixture(scope="function")
def client(app):
    return app.test_client()


@pytest.fixture(scope="function")
def admin_headers(client, app):
    with app.app_context():
        from models import User

        user = User(username="admin_user", email="admin@test.com", role="admin")
        user.set_password("testpass123")
        _db.session.add(user)
        _db.session.commit()
    res = client.post("/api/auth/login", json={"username": "admin_user", "password": "testpass123"})
    token = res.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def editor_headers(client, app):
    with app.app_context():
        from models import User

        user = User(username="editor_user", email="editor@test.com", role="editor")
        user.set_password("testpass123")
        _db.session.add(user)
        _db.session.commit()
    res = client.post(
        "/api/auth/login", json={"username": "editor_user", "password": "testpass123"}
    )
    token = res.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def make_comment(app, status="pending"):
    """테스트용 댓글 생성 헬퍼. app context 내부에서 호출할 것."""
    from models import Comment, Post, User

    author = User(username=f"author_{status}", email=f"auth_{status}@test.com", role="editor")
    author.set_password("pass")
    _db.session.add(author)
    _db.session.flush()
    post = Post(title="Test Post", slug="test-post", author_id=author.id, status="published")
    _db.session.add(post)
    _db.session.flush()
    comment = Comment(
        post_id=post.id,
        author_name="Guest",
        author_email="guest@test.com",
        content="테스트 댓글",
        status=status,
    )
    _db.session.add(comment)
    _db.session.commit()
    return comment.id
