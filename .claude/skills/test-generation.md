---
name: test-generation
description: CMS 프로젝트 테스트 코드 작성 시 사용. BE(pytest+Flask test client), FE(vitest+React Testing Library) 패턴 가이드.
---

# Test Generation

## Backend — pytest

### 테스트 파일 위치
```
backend/
└── tests/
    ├── conftest.py         # 공통 fixture
    ├── test_auth.py
    ├── test_posts.py
    ├── test_comments.py
    └── test_admin.py
```

### conftest.py 기본 구조
```python
import pytest
from app import create_app
from database import db as _db

@pytest.fixture(scope='session')
def app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    return app

@pytest.fixture(scope='session')
def client(app):
    with app.test_client() as client:
        with app.app_context():
            _db.create_all()
            yield client
            _db.drop_all()

@pytest.fixture
def auth_headers(client):
    """editor 권한 JWT 헤더 반환"""
    # 테스트용 유저 생성 + 로그인 → 토큰 반환
    res = client.post('/api/auth/register', json={
        'username': 'testuser', 'email': 'test@test.com', 'password': 'password'
    })
    token = res.json['data']['token']
    return {'Authorization': f'Bearer {token}'}

@pytest.fixture
def admin_headers(client):
    """admin 권한 JWT 헤더 반환"""
    # admin 유저 생성 로직
    ...
```

### 테스트 작성 패턴

```python
class TestPostsAPI:
    def test_get_posts_public(self, client):
        """공개 포스트 목록 — 인증 불필요"""
        res = client.get('/api/posts')
        assert res.status_code == 200
        assert res.json['success'] is True
        assert isinstance(res.json['data'], list)

    def test_create_post_requires_auth(self, client):
        """인증 없이 포스트 생성 시 401"""
        res = client.post('/api/posts', json={'title': 'test'})
        assert res.status_code == 401

    def test_create_post(self, client, auth_headers):
        """editor가 포스트 생성"""
        res = client.post('/api/posts',
            json={'title': '제목', 'content': '내용', 'status': 'published'},
            headers=auth_headers
        )
        assert res.status_code == 201
        assert res.json['success'] is True
        assert res.json['data']['title'] == '제목'

    def test_delete_other_user_post_forbidden(self, client, auth_headers):
        """타인 글 삭제 시 403"""
        # 다른 유저 글 생성 후 삭제 시도
        ...
        assert res.status_code == 403
```

### 테스트 실행
```bash
docker compose exec backend pytest tests/ -v
docker compose exec backend pytest tests/test_posts.py::TestPostsAPI::test_create_post -v
```

### 테스트 항목 기준

새 엔드포인트마다:
- [ ] 인증 없이 접근 → 401
- [ ] 권한 부족 → 403
- [ ] 정상 요청 → 200/201 + 응답 포맷 확인
- [ ] 존재하지 않는 리소스 → 404
- [ ] 소유권 검사 있으면 → 타인 리소스 접근 403

---

## Frontend — vitest

### 설정 (vitest 미설치 시)
```bash
# package.json에 추가
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

`vite.config.js`에 추가:
```js
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test/setup.js',
}
```

### 테스트 파일 위치
```
frontend/src/
└── __tests__/
    ├── pages/PostList.test.jsx
    └── components/Nav.test.jsx
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
      data: { success: true, data: [{ id: 1, title: '테스트 글' }] }
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

현재 테스트가 없는 경우, 이 순서로 추가:
1. 인증 API (로그인/회원가입)
2. 포스트 CRUD + 소유권 검사
3. 권한 분기 (editor vs admin)
4. 댓글 (게스트 인증 포함)
