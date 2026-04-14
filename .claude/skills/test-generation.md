---
name: test-generation
description: CMS 프로젝트에서 pytest/vitest 테스트 코드를 작성할 때 사용. BE(pytest+MariaDB), FE(vitest+React Testing Library) 패턴 가이드. 새 엔드포인트 구현 완료 후 또는 TDD 시작 전 반드시 참조.
---

# Test Generation

## Backend — pytest

> ⛔ **절대 규칙: SQLite(`sqlite:///:memory:`) 사용 금지.** 테스트는 반드시 로컬 Docker MariaDB(`cmsdb_test`)를 사용해야 함.

### 테스트 파일 위치

```
backend/
└── tests/
    ├── conftest.py              # 공통 fixture (수정 금지 — 패턴 참조용)
    ├── test_auth_extended.py    # 인증 API
    ├── test_posts_extended.py   # 포스트 CRUD + 필터
    ├── test_comments.py         # 댓글 (로그인/게스트)
    ├── test_admin_full.py       # Admin API 권한/CRUD
    ├── test_admin_comments.py   # Admin 댓글 관리
    ├── test_categories.py       # 카테고리 CRUD
    ├── test_tags.py             # 태그 CRUD
    ├── test_follows.py          # 팔로우/피드
    ├── test_series.py           # 시리즈
    ├── test_stats.py            # 통계
    ├── test_visibility.py       # 공개 범위
    ├── test_profile.py          # 프로필
    ├── test_customization.py    # 블로그 커스터마이제이션
    ├── test_settings.py         # 사이트 설정
    ├── test_helpers.py          # helpers.py 유닛 테스트
    ├── test_feeds.py            # RSS 피드
    ├── test_search.py           # 검색
    ├── test_thumbnail.py        # 미디어 썸네일
    ├── test_users.py            # 사용자 조회
    ├── test_visit_logs.py       # 방문 로그
    ├── test_wizard.py           # Setup Wizard Phase 1
    └── test_wizard_phase2.py    # Setup Wizard Phase 2
```

### conftest.py — 실제 구조 (참조용)

```python
import pytest
from app import create_app
from database import db as _db


class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "mysql+pymysql://funnycms:funnycms@db:3306/cmsdb_test"
    SQLALCHEMY_ENGINE_OPTIONS = {"execution_options": {"isolation_level": "READ COMMITTED"}}
    JWT_SECRET_KEY = "test-secret-key"
    JWT_ACCESS_TOKEN_EXPIRES = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = "test-secret"
    STORAGE_BACKEND = "local"
    UPLOAD_FOLDER = "/tmp/cms_test_uploads"
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024


@pytest.fixture(scope="session")
def app():
    app = create_app(TestConfig)
    with app.app_context():
        _db.create_all()
        # FULLTEXT 인덱스는 create_all()이 자동 생성 못 함 — 수동 추가
        _db.session.execute(
            _db.text("ALTER TABLE posts ADD FULLTEXT INDEX ft_posts_search (title, content, excerpt)")
        )
        _db.session.commit()
        yield app
        _db.drop_all()


@pytest.fixture(scope="function", autouse=True)
def clean_db(app):
    """각 테스트 후 DB 초기화 (FK 순서 역순 DELETE)."""
    with app.app_context():
        yield
        _db.session.rollback()
        _db.session.execute(
            _db.text("UPDATE comments SET parent_id = NULL WHERE parent_id IS NOT NULL")
        )
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()


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
    res = client.post("/api/auth/login", json={"username": "editor_user", "password": "testpass123"})
    token = res.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

### 테스트 헬퍼 패턴

```python
import uuid
from database import db as _db


def make_user(role: str = "editor") -> tuple[int, str]:
    """테스트용 유저 생성 — uuid로 고유 이름 보장."""
    from models import User
    uname = f"u_{uuid.uuid4().hex[:6]}"
    user = User(username=uname, email=f"{uname}@test.com", role=role)
    user.set_password("pass123")
    _db.session.add(user)
    _db.session.commit()
    return user.id, uname


def get_token(client, username: str) -> str:
    """로그인 후 access_token 반환."""
    res = client.post("/api/auth/login", json={"username": username, "password": "pass123"})
    return res.get_json()["data"]["access_token"]
```

### 테스트 작성 패턴 (함수 기반)

```python
import uuid
from database import db as _db


# ── 헬퍼 ────────────────────────────────────────────────────────────────────

def make_user(role="editor"):
    from models import User
    uname = f"u_{uuid.uuid4().hex[:6]}"
    user = User(username=uname, email=f"{uname}@test.com", role=role)
    user.set_password("pass123")
    _db.session.add(user)
    _db.session.commit()
    return user.id, uname


def get_token(client, username):
    res = client.post("/api/auth/login", json={"username": username, "password": "pass123"})
    return res.get_json()["data"]["access_token"]


# ── 테스트 ──────────────────────────────────────────────────────────────────

def test_get_posts_public(client):
    """공개 포스트 목록 — 인증 불필요."""
    res = client.get("/api/posts")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "items" in data["data"]


def test_create_post_requires_auth(client):
    """인증 없이 포스트 생성 시 401."""
    res = client.post("/api/posts", json={"title": "test"})
    assert res.status_code == 401


def test_create_post(client, app):
    """editor가 포스트 생성."""
    with app.app_context():
        _, uname = make_user()
    token = get_token(client, uname)
    res = client.post(
        "/api/posts",
        json={"title": "제목", "content": "내용", "status": "published"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    assert res.get_json()["success"] is True
    assert res.get_json()["data"]["title"] == "제목"


def test_delete_other_user_post_forbidden(client, app):
    """타인 글 삭제 시 403."""
    from models import Post
    with app.app_context():
        uid1, u1 = make_user()
        uid2, u2 = make_user()
        post = Post(title="남의 글", slug=f"s-{uuid.uuid4().hex[:6]}", author_id=uid1, status="published")
        _db.session.add(post)
        _db.session.commit()
        post_id = post.id
    token2 = get_token(client, u2)
    res = client.delete(f"/api/posts/{post_id}", headers={"Authorization": f"Bearer {token2}"})
    assert res.status_code == 403
```

### app.app_context() 사용 규칙

```python
def test_something(client, app):
    # DB 조작(모델 생성/조회)은 반드시 app.app_context() 블록 안에서
    with app.app_context():
        _, uname = make_user()
        # ID, username 등 필요한 값을 미리 꺼내 둠

    # HTTP 요청은 app_context 밖에서 — client가 자체 context 사용
    res = client.get(f"/api/something")
    assert res.status_code == 200
```

### request.json vs res.get_json()

```python
# ✅ 올바른 응답 파싱
data = res.get_json()
token = data["data"]["access_token"]   # 'token' 아님!

# ❌ 잘못된 방식
token = res.json['data']['token']
```

### 테스트 실행

```bash
# 전체 실행
docker compose exec backend pytest tests/ -v

# 특정 파일
docker compose exec backend pytest tests/test_follows.py -v

# 특정 함수
docker compose exec backend pytest tests/test_follows.py::test_follow_user -v

# 커버리지 확인
docker compose exec backend pytest tests/ --cov=api --cov-report=term-missing
```

### 테스트 항목 기준

새 엔드포인트마다:
- [ ] 인증 없이 접근 → 401
- [ ] 권한 부족 (editor가 admin 전용 접근) → 403
- [ ] 정상 요청 → 200/201 + 응답 포맷 `{ "success": true, "data": {...}, "error": "" }` 확인
- [ ] 존재하지 않는 리소스 → 404
- [ ] 소유권 검사가 있으면 → 타인 리소스 접근 403

helpers.py 유닛 테스트 (Flask 요청 컨텍스트 필요 시):
```python
def test_pagination_defaults(app):
    with app.test_request_context("/?page=1&per_page=20"):
        page, per_page, offset = get_pagination_params()
        assert page == 1 and per_page == 20 and offset == 0
```

---

## Frontend — vitest

### 설정 파일

```
frontend/src/
└── test/
    ├── setup.js
    ├── OnboardingModal.test.jsx
    ├── SeriesNav.test.jsx
    └── ShareButtons.test.jsx
```

### 컴포넌트 테스트 패턴

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import PostList from '../pages/PostList';

// axios 모킹
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { success: true, data: { items: [{ id: 1, title: '테스트 글' }] } }
    })
  }
}));

describe('PostList', () => {
  it('포스트 목록 렌더링', async () => {
    render(<PostList />);
    await waitFor(() => {
      expect(screen.getByText('테스트 글')).toBeInTheDocument();
    });
  });
});
```

### 테스트 실행

```bash
docker compose exec frontend npm run test
```

---

## 우선순위

현재 커버리지가 낮은 파일부터 추가:
1. 새 엔드포인트 — 구현과 동시에 테스트 작성 (TDD 권장)
2. `comments.py` — 게스트 인증, 소유권, 스팸 필터 (리팩토링 P2 전 필수)
3. `admin.py` — 권한 변경, 비활성화, 삭제 (리팩토링 P3~P4 전 필수)
4. `helpers.py` — 신규 헬퍼 함수 추가 시 100% 커버리지 목표
