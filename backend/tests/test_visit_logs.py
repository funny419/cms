"""visit_logs 수집 검증 — GET /api/posts/:id 동작."""

import uuid

from database import db as _db


def make_user_and_post(app, status="published", visibility="public"):
    from models import Post, User

    uname = f"u_{uuid.uuid4().hex[:6]}"
    user = User(username=uname, email=f"{uname}@t.com", role="editor")
    user.set_password("pass")
    _db.session.add(user)
    _db.session.flush()
    post = Post(
        title="Visit Log Test Post",
        slug=uuid.uuid4().hex[:8],
        author_id=user.id,
        status=status,
        visibility=visibility,
    )
    _db.session.add(post)
    _db.session.commit()
    return post.id, user.id, uname


def count_visit_logs(app, post_id):
    from models import VisitLog

    return (
        _db.session.execute(
            _db.select(_db.func.count(VisitLog.id)).where(VisitLog.post_id == post_id)
        ).scalar()
        or 0
    )


def test_visit_log_created_on_post_view(client, app):
    """GET /api/posts/:id 호출 시 visit_log가 INSERT되어야 한다."""
    with app.app_context():
        post_id, _, _ = make_user_and_post(app)

    res = client.get(f"/api/posts/{post_id}")
    assert res.status_code == 200

    with app.app_context():
        count = count_visit_logs(app, post_id)
    assert count == 1, f"visit_log가 1건 기대되지만 {count}건"


def test_visit_log_not_created_when_skip_count(client, app):
    """?skip_count=1 파라미터 시 visit_log INSERT 없어야 한다."""
    with app.app_context():
        post_id, _, _ = make_user_and_post(app)

    res = client.get(f"/api/posts/{post_id}?skip_count=1")
    assert res.status_code == 200

    with app.app_context():
        count = count_visit_logs(app, post_id)
    assert count == 0, f"skip_count=1일 때 visit_log 0건 기대되지만 {count}건"


def test_view_count_not_incremented_when_skip_count(client, app):
    """?skip_count=1 파라미터 시 view_count가 증가하지 않아야 한다."""
    with app.app_context():
        post_id, _, _ = make_user_and_post(app)
        from models import Post

        post = _db.session.get(Post, post_id)
        initial_count = post.view_count

    client.get(f"/api/posts/{post_id}?skip_count=1")

    with app.app_context():
        from models import Post

        post = _db.session.get(Post, post_id)
        assert post.view_count == initial_count, "skip_count=1이면 view_count 증가하면 안 됨"


def test_view_count_incremented_on_normal_view(client, app):
    """정상 조회 시 view_count +1 되어야 한다."""
    with app.app_context():
        post_id, _, _ = make_user_and_post(app)
        from models import Post

        post = _db.session.get(Post, post_id)
        initial = post.view_count

    client.get(f"/api/posts/{post_id}")

    with app.app_context():
        from models import Post

        post = _db.session.get(Post, post_id)
        assert post.view_count == initial + 1


def test_duplicate_visit_same_ip_same_day_not_duplicated(client, app):
    """동일 IP + 동일 포스트 + 당일 재방문 시 visit_log가 중복 삽입되지 않아야 한다."""
    with app.app_context():
        post_id, _, _ = make_user_and_post(app)

    # 같은 IP(테스트 클라이언트는 127.0.0.1 사용)로 2번 조회
    client.get(f"/api/posts/{post_id}")
    client.get(f"/api/posts/{post_id}")

    with app.app_context():
        count = count_visit_logs(app, post_id)
    assert count == 1, f"동일 IP 당일 중복 방문 시 1건만 기대되지만 {count}건"


def test_post_response_ok_regardless_of_visit_log(client, app):
    """visit_log 처리 실패여도 포스트 응답은 정상 반환되어야 한다 (try/except 커버)."""
    with app.app_context():
        post_id, _, _ = make_user_and_post(app)

    # 정상 조회이므로 200 반환돼야 함 (예외 처리 경로가 있어도 응답은 OK)
    res = client.get(f"/api/posts/{post_id}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "title" in data["data"]


def test_visit_log_includes_post_id(client, app):
    """visit_log 레코드에 올바른 post_id가 저장되어야 한다."""
    with app.app_context():
        post_id, _, _ = make_user_and_post(app)

    client.get(f"/api/posts/{post_id}")

    with app.app_context():
        from models import VisitLog

        log = _db.session.execute(
            _db.select(VisitLog).where(VisitLog.post_id == post_id)
        ).scalar_one_or_none()
        assert log is not None
        assert log.post_id == post_id
        assert log.ip_address  # ip_address가 기록되어야 함
