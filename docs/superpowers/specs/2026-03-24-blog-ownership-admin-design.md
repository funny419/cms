# 개인 블로그 소유권 + Admin 대시보드 설계

## 개요

현재 모든 editor가 타인의 글을 수정/삭제할 수 있고, Admin 대시보드가 없는 상태.
개인 블로그 방식(내 글만 관리)과 Admin 전용 관리 대시보드를 추가한다.

## 결정 사항

| 항목 | 결정 |
|------|------|
| 로그인 후 이동 | editor → `/my-posts`, admin → `/admin/posts` |
| 내 글 목록 | draft + published 모두 표시 |
| Admin 구조 | 분리 라우트 (`/admin/posts`, `/admin/users`) |
| 회원 관리 | 목록 + 권한 변경 + 비활성화 + 삭제 + 해당 회원 글 보기 |

---

## 1. 로그인 흐름

`Login.jsx`에서 로그인 성공 시 `user.role` 기반으로 분기:

```
로그인 성공
├── role: 'admin'  → navigate('/admin/posts')
└── role: 'editor' → navigate('/my-posts')
```

---

## 2. DB 스키마 변경

### 2-1. Post.author_id nullable 마이그레이션 필요

현재 `Post.author_id`는 `NOT NULL` + `FK(users.id)`.
회원 삭제 시 해당 회원의 포스트를 `author_id = NULL`로 처리해야 하므로:

- `backend/models/schema.py`에서 `author_id`를 `Mapped[Optional[int]]`으로 변경
- `nullable=True`로 변경
- `flask db migrate` 로 마이그레이션 파일 생성 후 적용

```python
# 변경 전
author_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)

# 변경 후
author_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'), nullable=True)
```

---

## 3. 백엔드 API

### 3-1. 신규 엔드포인트

#### `GET /api/posts/mine`
- 권한: `@jwt_required()`
- 동작: `author_id == 현재 유저 id` 인 포스트 전체 반환 (status 무관)
- 정렬: `created_at` 내림차순
- 응답: `{ success, data: [{ id, title, status, created_at, updated_at }], error }`

#### `GET /api/admin/posts`
- 권한: `@roles_required('admin')`
- 동작: 전체 포스트 반환 (모든 유저, 모든 status)
- 정렬: `created_at` 내림차순
- 응답: `{ success, data: [{ id, title, status, post_type, author_id, created_at }], error }`

#### `GET /api/admin/users`
- 권한: `@roles_required('admin')`
- 동작: 전체 회원 목록 (deactivated 포함, role로 구분)
- 응답: `{ success, data: [{ id, username, email, role, created_at }], error }`

#### `PUT /api/admin/users/:id/role`
- 권한: `@roles_required('admin')`
- Body: `{ "role": "editor" | "admin" }`
- 동작: 해당 유저의 role 변경 (deactivated → editor 로 재활성화 가능)
- 자기 자신의 role 변경 시도: 403
- 응답: `{ success, data: { id, role }, error }`

#### `PUT /api/admin/users/:id/deactivate`
- 권한: `@roles_required('admin')`
- 동작: 해당 유저의 role을 `'deactivated'`로 변경
- 자기 자신 비활성화 시도: 403
- 재활성화: `PUT /api/admin/users/:id/role` 로 role을 `editor`로 변경하면 됨 (단방향 엔드포인트가 아님)
- 응답: `{ success, data: { id, role: 'deactivated' }, error }`

#### `DELETE /api/admin/users/:id`
- 권한: `@roles_required('admin')`
- 동작:
  1. 해당 유저의 포스트 `author_id = NULL` 처리 (고아 포스트, 삭제하지 않음)
  2. 유저 레코드 삭제
- 자기 자신 삭제 시도: 403
- 응답: `{ success, data: {}, error }`

#### `GET /api/admin/users/:id/posts`
- 권한: `@roles_required('admin')`
- 동작: 특정 유저의 포스트 전체 반환 (모든 status)
- 응답: `{ success, data: [{ id, title, status, created_at, updated_at }], error }`

### 3-2. 기존 엔드포인트 수정

#### `POST /api/posts` — 변경 없음
- 이미 `author_id = int(get_jwt_identity())` 로 서버에서 주입 중. 클라이언트 전달값 사용 안 함.

#### `PUT /api/posts/:id`
- 기존: admin/editor 누구나 수정 가능
- 변경: admin이면 모두 수정, editor이면 `post.author_id == 현재 유저 id` 인 경우만 수정
- 타인 글 수정 시도: 403 `{ "error": "본인 글만 수정할 수 있습니다." }`

#### `DELETE /api/posts/:id`
- 기존: admin만 삭제 가능
- 변경: admin이면 모두 삭제, editor이면 `post.author_id == 현재 유저 id` 인 경우만 삭제
- 타인 글 삭제 시도: 403 `{ "error": "본인 글만 삭제할 수 있습니다." }`

### 3-3. deactivated 계정 처리

**로그인 시:** `login()` 에서 `user.role == 'deactivated'` 이면 401:
```json
{ "success": false, "error": "비활성화된 계정입니다." }
```

**JWT 발급 이후:** `roles_required` 데코레이터에서 DB를 fresh하게 조회하므로,
`user.role == 'deactivated'` 인 경우 403으로 자동 차단됨. 추가 처리 불필요.
(`GET /api/posts/mine` 에서 사용하는 `@jwt_required()`는 역할 검사를 안 하므로,
해당 엔드포인트에 `deactivated` 체크를 명시적으로 추가할 것:)
```python
if user.role == 'deactivated':
    return jsonify({"success": False, "data": {}, "error": "비활성화된 계정입니다."}), 403
```

### 3-4. 신규 Blueprint

`backend/api/admin.py` 신규 생성, `url_prefix="/api/admin"`.
`app.py`에 `admin_bp` 등록.

---

## 4. 프론트엔드

### 4-1. 신규 파일

| 파일 | 설명 |
|------|------|
| `frontend/src/pages/MyPosts.jsx` | 내 글 목록 (draft/published 구분 뱃지) |
| `frontend/src/pages/admin/AdminPosts.jsx` | 전체 포스트 관리 테이블 |
| `frontend/src/pages/admin/AdminUsers.jsx` | 회원 관리 테이블 |
| `frontend/src/api/admin.js` | admin API 클라이언트 |

### 4-2. 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/App.jsx` | `/my-posts`, `/admin/posts`, `/admin/users` 라우트 추가 |
| `frontend/src/pages/Login.jsx` | 로그인 성공 후 role 기반 분기 |
| `frontend/src/components/Nav.jsx` | editor/admin 권한별 메뉴 분기 |
| `frontend/src/pages/PostDetail.jsx` | 편집 버튼 조건 변경 |
| `frontend/src/api/posts.js` | `getMyPosts()` 함수 추가 |

### 4-3. Admin 라우트 보호

`/admin/posts`, `/admin/users` 모두 동일하게 보호:
- `localStorage.getItem('token')` 없으면 `/login` 리다이렉트
- `user.role !== 'admin'` 이면 `/my-posts` 리다이렉트
- 각 페이지의 `useEffect` 내에서 체크 (별도 ProtectedRoute 컴포넌트 없이, 기존 패턴과 동일)

---

## 5. 페이지별 상세

### 5-1. `/my-posts` — 내 글 목록

- 접근: 로그인 필수 (`token` 없으면 `/login`)
- 상단: "내 블로그" 제목 + `+ 새 글` 버튼
- 목록 행: 제목 | 상태 뱃지(draft=회색/published=보라) | 작성일 | `편집` 링크 | `삭제` 버튼
- 삭제: 확인 없이 바로 `DELETE /api/posts/:id` 호출 (본인 글이므로 confirm 생략)
- 빈 목록: "아직 작성한 글이 없습니다. + 새 글 작성" 안내

### 5-2. `/admin/posts` — 전체 포스트 관리

- 접근: admin only
- 테이블 컬럼: 제목 | 작성자 ID | 상태 | 작성일 | 수정 | 삭제
- 수정 클릭: `/posts/:id/edit` 이동
- 삭제 클릭: `window.confirm` 후 `DELETE /api/posts/:id`

### 5-3. `/admin/users` — 회원 관리

- 접근: admin only
- 테이블 컬럼: 아이디 | 이메일 | 권한 | 가입일 | 액션
- **권한 뱃지**: `admin`=보라, `editor`=파랑, `deactivated`=회색 (비활성화 표시)
- **권한 변경 버튼**: editor ↔ admin 토글, `PUT /api/admin/users/:id/role` 호출
- **비활성화 버튼**: `window.confirm` 후 `PUT /api/admin/users/:id/deactivate`
  - 이미 deactivated 이면 "활성화" 버튼으로 대체 → `PUT /api/admin/users/:id/role` (role: 'editor')
- **삭제 버튼**: `window.confirm` 후 `DELETE /api/admin/users/:id`
- **글 보기 버튼**: 클릭 시 같은 행 아래에 해당 유저 글 목록 인라인 펼침 (토글)
- 현재 로그인한 admin 본인 행: 권한변경/비활성화/삭제 버튼 비활성화(disabled)

### 5-4. Nav 변경

**editor 로그인 시:**
- `내 글` → `/my-posts`
- `전체 글` → `/posts`
- `프로필` → `/profile`
- `로그아웃`

**admin 로그인 시:**
- `포스트 관리` → `/admin/posts`
- `회원 관리` → `/admin/users`
- `로그아웃`

**비로그인 시:** 현재와 동일 (로그인 | 회원가입)

### 5-5. PostDetail 편집 버튼 조건 변경

```js
// 기존
isEditorOrAdmin(user)

// 변경
user && (user.role === 'admin' || post.author_id === user.id)
```

---

## 6. 범위 외 (Out of Scope)

- 페이지네이션 (목록 API는 전체 반환)
- 포스트 검색/필터
- 회원 가입 승인 워크플로우
- 이메일 알림
- 비활성화 계정의 기존 포스트 공개 여부 변경 (그대로 유지)
