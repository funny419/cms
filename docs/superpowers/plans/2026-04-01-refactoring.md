# 리팩토링 계획서 (2026-04-01)

**작성:** backend-2, dba-2, frontend-2
**상태:** 작성 중 (team-lead 승인 대기)

---

## 1. BE 코드 현황 분석

### 1-1. SRP 위반 — 과도하게 긴 핸들러 함수

| 함수 | 위치 | 줄 수 | 책임 수 |
|------|------|-------|--------|
| `list_posts()` | posts.py:17 | ~150줄 | 인증, visibility 필터, FULLTEXT 검색, 카테고리/태그/작성자 필터, 페이지네이션, 좋아요 집계, 응답 조립 |
| `get_post()` | posts.py:216 | ~140줄 | 인증, 접근 제어, view_count 증가, VisitLog INSERT, 댓글/좋아요 집계, 작성자 조회, 시리즈 정보 조립, 응답 |
| `create_comment()` | comments.py:21 | ~90줄 | 입력 검증, parent_id 유효성, JWT 인증, 게스트/로그인 분기, 스팸 필터, DB 저장 |

### 1-2. DRY 위반 — 중복 코드

**① 페이지네이션 파라미터 추출 — 7개 함수에서 동일 3줄 반복**

```python
page = max(1, request.args.get("page", 1, type=int) or 1)
per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
offset = (page - 1) * per_page
```

위치: `list_posts`, `get_my_posts`, `admin_list_posts`, `admin_list_comments`, `list_followers`, `list_following`, `get_feed`

**② 게스트 인증 블록 — comments.py에서 동일 20줄 2회 복제**

```python
# update_comment() lines 148-163 ≡ delete_comment() lines 228-243
author_email = (data.get("author_email") or "").strip()
author_password = (data.get("author_password") or "").strip()
# ... check_password_hash 검증
```

**③ Admin 자기 자신 보호 패턴 — 3개 함수에서 동일 패턴**

```python
if current_user_id == user_id:
    return jsonify({...}), 403
```
위치: `admin_change_role()`, `admin_deactivate_user()`, `admin_delete_user()` (admin.py:112, 139, 162)

**④ 응답 포맷 — 모든 핸들러에서 반복**

```python
jsonify({"success": True, "data": ..., "error": ""})
jsonify({"success": False, "data": {}, "error": "..."})
```

### 1-3. OCP 위반 — 새 필터 추가 시 함수 내부 수정 필요

`list_posts()` 내부에 `if q:`, `if category_id:`, `if author_username:`, `if tags_param:` 블록이 순차로 누적.
새 필터 추가 시 함수 내부를 직접 수정해야 하는 구조.

### 1-4. DIP 위반 — 핸들러가 SQLAlchemy에 직접 의존

API 핸들러 함수가 `select()`, `db.session.execute()`, `scalar_one_or_none()` 등 ORM 레이어를 직접 호출.
비즈니스 로직과 DB 접근 코드가 혼재.

### 1-5. 잔존 N+1 (BUG-B — 커밋 abfa6b8에서 수정 완료)

~~`posts.py::get_post()` series 조회에서 SeriesPost → Series → series_posts → post 체인이 lazy 로딩으로 N+2 추가 쿼리 발생~~
→ selectinload 체인으로 수정 완료.

---

## 2. DB/모델 현황 분석

### 2-1. SRP 위반 — schema.py 단일 파일에 16개 모델 집중

**파일:** `backend/models/schema.py` (480줄)

| 모델 | 도메인 | 라인 |
|------|--------|------|
| `Option` | 설정 | 26 |
| `User` | 사용자 | 40 |
| `Post`, `PostMeta`, `PostLike`, `VisitLog` | 포스트 | 105~248 |
| `Comment` | 댓글 | 251 |
| `Menu`, `MenuItem` | 메뉴 | 304 |
| `Tag`, `PostTag` | 태그 | 329 |
| `Category` | 카테고리 | 368 |
| `Follow` | 팔로우 | 410 |
| `Series`, `SeriesPost` | 시리즈 | 437 |

**비즈니스 로직 혼재:**
- `User.set_password()`, `User.check_password()` (schema.py:81~85) — werkzeug 의존 인증 로직이 모델에 포함
- `MAX_CATEGORY_DEPTH = 3` (schema.py:365) — 비즈니스 규칙 상수가 모델 파일에 선언

### 2-2. 인덱스 3개 누락 (architecture.md 명시 vs 실제 미생성)

`schema.py`의 `__table_args__` 확인 결과, 아래 3개가 architecture.md에 설계 의도로 기재됐지만 실제 미적용:

| 테이블 | 누락 인덱스 | 영향 쿼리 | 현재 문제 |
|--------|-----------|---------|---------|
| `comments` | `(post_id, status, created_at)` 복합 | `GET /api/comments/post/:id` | post_id UNIQUE 없어 Full Scan 후 status 필터 |
| `post_tags` | `(tag_id)` 단일 | `GET /api/tags/:id/posts` | UNIQUE(post_id, tag_id) leftmost가 post_id — tag_id 단독 조회 시 Full Scan |
| `post_likes` | `(user_id)` 단일 | 좋아요 집계 쿼리 | UNIQUE(post_id, user_id) leftmost가 post_id — user_id 단독 조회 시 비효율 |

**이미 완료된 인덱스 (2026-04-01, commit a5a52cc):**
- `posts.ix_posts_author_id` — author_id 조회 최적화
- `follows.idx_follows_following_id` — 팔로워 목록 최적화

### 2-3. 모델 파일 도메인별 분리 가능성 및 리스크

**분리 방향:**
```
backend/models/
├── base.py        # Base(DeclarativeBase)만
├── user.py        # User, Follow
├── post.py        # Post, PostMeta, PostLike, VisitLog
├── comment.py     # Comment
├── media.py       # Media
├── category.py    # Category
├── tag.py         # Tag, PostTag
├── series.py      # Series, SeriesPost
├── option.py      # Option, Menu, MenuItem
└── __init__.py    # 전체 re-export (Alembic 자동 감지용)
```

**리스크:**
- `User ↔ Post ↔ Comment ↔ Follow ↔ Series` 상호 참조 다수 — circular import 발생 가능
- **해결책:** SQLAlchemy string-based relationship(`relationship("User", ...)`)은 이미 적용 중이므로 실제 circular import 없음
- **마이그레이션 영향 없음** — 테이블명/컬럼명 변경 없으므로 `flask db migrate` 실행 시 empty migration
- **모든 API 파일의 import 경로 일괄 수정 필요:** `from models.schema import Post, User` → `from models import Post, User`

**검증 절차:**
1. 분리 후 `flask db migrate` → empty migration 확인
2. pytest 87개 전체 통과 확인

### 2-4. Repository Pattern 도입 방향 (선택적)

**현재 상황:** 모든 API 핸들러가 `db.session.execute(select(...))` 직접 호출 (DIP 위반)

**권장 방향:** 전면 도입 대신 복잡한 핸들러 내 헬퍼 함수 수준부터 적용
```python
# posts.py 내부에서 분리 (별도 Repository 클래스 불필요)
def _get_series_info(post_id: int) -> dict | None:
    """series 정보 조회 — selectinload로 N+1 방지."""
    ...

def _get_post_aggregates(post_id: int) -> tuple[int, int]:
    """comment_count, like_count 집계."""
    ...
```

전면 Repository Pattern 도입은 P5(Service Layer)와 함께 테스트 커버리지 85% 달성 후 검토.

### 2-5. DB/모델 리팩토링 우선순위

| 단계 | 작업 | 난이도 | 마이그레이션 |
|------|------|--------|------------|
| **P2** | 인덱스 3개 추가 (comments, post_tags, post_likes) | 낮음 | 필요 (1개) |
| **P2** | `MAX_CATEGORY_DEPTH` → `config.py` 또는 `models/constants.py` 이동 | 낮음 | 불필요 |
| **P3** | `User.set_password/check_password` → `api/auth.py` 내부 함수로 이동 | 낮음 | 불필요 |
| **P4** | schema.py 도메인별 파일 분리 | 높음 | 불필요 |
| **P5** | Repository Pattern 선택적 도입 | 높음 | 불필요 |

**이미 완료 (이번 세션):**
- `posts.py get_post()` series N+1 → selectinload 체인 수정 (commit abfa6b8)
- `posts.ix_posts_author_id`, `follows.idx_follows_following_id` 인덱스 추가 (commit a5a52cc)
- BUG-4 view_count/VisitLog 트랜잭션 분리 (commit 6baed90)

---

## 3. FE 현황 분석

> 작성: frontend-2

### 3-1. DRY 위반 — 인증 코드 중복

**① getUser() — 6개 위치에서 동일 4줄 반복**

```js
const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};
```

| 파일 | 위치 |
|------|------|
| `components/Nav.jsx` | 4-7줄 |
| `pages/PostDetail.jsx` | 12-15줄 |
| `pages/PostEditor.jsx` | 17-20줄 |
| `pages/PostList.jsx` | 19-22줄 |
| `pages/Statistics.jsx` | 38-41줄 |
| `pages/BlogHome.jsx` | 57-59줄 (컴포넌트 내부 정의) |

**② localStorage.getItem('token') — 15개 파일에서 직접 접근**

위치: Nav.jsx:12, PostDetail.jsx:41, PostEditor.jsx:35, PostList.jsx:29,
MyPosts.jsx:14, Statistics.jsx:45, Profile.jsx:12, Feed.jsx:9,
BlogHome.jsx:24, BlogSettings.jsx:17, CommentSection.jsx:360,
AdminPosts.jsx:16, AdminComments.jsx:21, AdminUsers.jsx:23, AdminSettings.jsx:8

토큰 저장 키(`'token'`)가 변경되면 전체 15개 파일을 수동 수정해야 함.

**③ authHeader — 9개 api/*.js 파일에서 동일 1줄 반복**

```js
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
```

위치: api/posts.js:4, api/series.js:3, api/users.js:3, api/tags.js:3,
api/media.js:3, api/admin.js:4, api/settings.js:3, api/stats.js:3, api/comments.js:5

---

### 3-2. SRP 위반 — PostEditor.jsx (419줄, 책임 7개)

`frontend/src/pages/PostEditor.jsx` 단일 컴포넌트가 아래 7가지를 동시에 담당:

| 책임 | 코드 위치 |
|------|---------|
| 인증 확인 및 권한 리다이렉트 | 56-61줄 |
| 폼 상태 관리 (8개 필드) | 41-52줄 |
| localStorage 자동 저장 (10초 인터벌) | 63-76줄 |
| 편집 모드 기존 포스트 로딩 | 78-108줄 |
| 이미지 업로드 (Quill + Markdown 각각) | 110-155줄 |
| 에디터 탭 전환 (WYSIWYG ↔ Markdown) | 렌더 전반 |
| API 호출 (create/update) | 157-215줄 |

**책임 분해 명세 (FE-P3):**

```
PostEditor.jsx             — UI 렌더링 + 에디터 탭 전환만 잔존 (~200줄 목표)
├── hooks/useAuth.js       — 인증 확인 + 권한 리다이렉트 (FE-P1에서 처리)
├── hooks/usePostEditor.js — 폼 상태 + draft 자동저장 + 편집 모드 로딩 + API 호출
└── hooks/useImageUpload.js — Quill/Markdown 이미지 업로드 처리 (신규)
```

**추가 SRP 위반: `BlogLayoutDefault.jsx:5-52`**

`BlogLayoutDefault.jsx` 파일 내부에 `PostList` 컴포넌트가 정의되어 있음.
파일 1개가 레이아웃 컴포넌트 + 포스트 목록 컴포넌트 2개를 동시에 정의.
별도 파일로 분리 또는 공통 컴포넌트로 추출 필요.

---

### 3-3. Props Drilling — BlogHome → Layout 컴포넌트

`pages/BlogHome.jsx`에서 레이아웃 컴포넌트로 전달되는 props 최대 7개:

```jsx
// BlogLayoutDefault — 7개 props
<BlogLayoutDefault
  posts={filteredPosts}
  categories={categories}        // ← BlogHome에서 관리
  categoryId={categoryId}        // ← BlogHome에서 관리
  setCategoryId={setCategoryId}  // ← BlogHome에서 관리
  loading={loading}
  hasMore={hasMore}
  sentinelRef={sentinelRef}
/>
```

카테고리 필터 상태(`categoryId`, `setCategoryId`, `categories`)가 BlogHome에서 관리되어
레이아웃 컴포넌트 내부의 사이드바까지 2단계로 전달됨.

---

### 3-4. OCP 위반 — BlogHome.jsx 레이아웃 if-chain

`pages/BlogHome.jsx:116-151`에 아래 if-chain이 하드코딩:

```jsx
{layout === 'compact' && <BlogLayoutCompact posts={...} loading={...} ... />}
{layout === 'magazine' && <BlogLayoutMagazine posts={...} accentColor={...} ... />}
{layout === 'photo' && <BlogLayoutPhoto posts={...} accentColor={...} ... />}
{(layout === 'default' || !['compact','magazine','photo'].includes(layout)) && (
  <BlogLayoutDefault posts={...} categories={...} categoryId={...} ... />
)}
```

`LAYOUT_MAX_WIDTH` 객체(`BlogHome.jsx:14-19`)도 레이아웃 목록을 별도로 관리. 새 레이아웃 추가 시 **3곳 수정 필요** (if-chain + LAYOUT_MAX_WIDTH + import) — OCP 위반.

**개선 방향 (FE-P2): LAYOUTS 맵 패턴**

```js
const LAYOUTS = {
  compact:  { component: BlogLayoutCompact,  maxWidth: 720, extraProps: {} },
  magazine: { component: BlogLayoutMagazine, maxWidth: 800, extraProps: { accentColor } },
  photo:    { component: BlogLayoutPhoto,    maxWidth: 960, extraProps: { accentColor } },
  default:  { component: BlogLayoutDefault,  maxWidth: 900,
              extraProps: { categories, categoryId, setCategoryId } },
};
const { component: LayoutComponent, maxWidth, extraProps } =
  LAYOUTS[layout] || LAYOUTS.default;
<LayoutComponent posts={filteredPosts} loading={loading}
  hasMore={hasMore} sentinelRef={sentinelRef} {...extraProps} />
```

새 레이아웃 추가 시 LAYOUTS 맵에 1항목만 추가, 렌더링 로직 수정 불필요.

---

### 3-5. LSP 위반 — Layout 4종 props 인터페이스 불일치

4개 레이아웃 컴포넌트가 동일 "레이아웃" 추상이지만 props 인터페이스가 제각각이라 서로 대체 불가:

| 컴포넌트 | props 개수 | accentColor | categories/categoryId/setCategoryId |
|---------|-----------|-------------|-------------------------------------|
| BlogLayoutCompact | 4 | ❌ | ❌ |
| BlogLayoutDefault | 7 | ❌ | ✅ |
| BlogLayoutMagazine | 5 | ✅ | ❌ |
| BlogLayoutPhoto | 5 | ✅ | ❌ |

**해소:** 위 OCP 개선안(LAYOUTS 맵)의 `extraProps` 분리가 LSP도 함께 해소. 각 레이아웃은 `{ posts, loading, hasMore, sentinelRef }` 공통 interface만 수신.

---

### 3-6. ISP 위반 — 레이아웃별 불필요한 props 수신

- `BlogLayoutDefault`: `accentColor` 불필요
- `BlogLayoutCompact`: `accentColor` / 카테고리 3종 모두 불필요
- `BlogLayoutMagazine` / `Photo`: 카테고리 3종 불필요

**해소:** OCP 개선안의 `extraProps` 분리로 ISP 자동 해소. 각 레이아웃은 실제 사용하는 props만 수신.

---

### 3-7. 개선 방향

**① `hooks/useAuth.js` 신규 생성 (FE-P1)**

```js
// hooks/useAuth.js
export function useAuth() {
  const token = localStorage.getItem('token');
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  })();
  return { token, user, isLoggedIn: Boolean(token) };
}
```

적용 시 15개 파일에서 localStorage 직접 접근 제거. 스토리지 키 변경 시 1개 파일만 수정.

**② `api/client.js` 신규 생성 (FE-P1)**

```js
// api/client.js
import axios from 'axios';
export const api = axios.create();
export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
```

9개 api/*.js 파일에서 로컬 `authHeader` 제거 → `import { authHeader } from './client'`로 교체.
향후 토큰 갱신 인터셉터 추가 시 이 파일만 수정.

**③ `hooks/useFetch.js` 신규 생성 (FE-P2)**

BlogHome.jsx:34-55, SeriesDetail.jsx:12-30, Statistics.jsx:60-80 등 5개 이상 컴포넌트에서
`let cancelled = false` 패턴 반복 중. 단순 단일 fetch 케이스에 적용.
`Promise.all` 복합 케이스(BlogHome 초기화 등)는 적용 제외.

**④ `hooks/usePostEditor.js` 추출 (FE-P3)**

PostEditor.jsx에서 폼 상태 + localStorage 자동저장 + 편집 모드 로딩 + API 호출 로직만 훅으로 추출.
PostEditor.jsx는 UI 렌더링 + 에디터 탭 전환만 담당. 419줄 → 약 200줄 목표.

**⑤ `hooks/useImageUpload.js` 추출 (FE-P3, 신규)**

PostEditor.jsx에서 Quill 이미지 업로드 핸들러(110-140줄) + Markdown 이미지 삽입 핸들러(141-155줄)를 훅으로 추출.
`useImageUpload(token, quillRef, contentFormat)` → `{ handleImageUpload }` 반환.

**⑥ BlogHome LAYOUTS 맵 패턴 도입 (FE-P2)**

if-chain + LAYOUT_MAX_WIDTH 분리 → LAYOUTS 맵 1개로 통합. OCP/LSP/ISP 동시 해소.

---

### 3-8. FE 리팩토링 우선순위

| 단계 | 작업 | 파일 | SOLID | 리스크 |
|------|------|------|-------|--------|
| **FE-P1** | `useAuth.js` 신규 | hooks/useAuth.js | SRP/DRY | 낮음 |
| **FE-P1** | `api/client.js` 신규 | api/client.js | DIP/DRY | 낮음 |
| **FE-P2** | `useFetch.js` 신규 | hooks/useFetch.js | SRP/DRY | 낮음 |
| **FE-P2** | `BlogHome LAYOUTS 맵` | BlogHome.jsx | OCP/LSP/ISP | 낮음 |
| **FE-P3** | `usePostEditor.js` 추출 | hooks/usePostEditor.js | SRP | 중간 |
| **FE-P3** | `useImageUpload.js` 추출 | hooks/useImageUpload.js | SRP | 중간 |
| **FE-P3** | BlogLayout props 축소 | BlogHome.jsx + layouts/* | ISP/DIP | 중간 |

### 3-9. FE 예상 리스크

**FE-P1 (낮음):**
- useAuth는 순수 localStorage 접근 추출 — 동작 변경 없음
- api/client.js authHeader는 동일 함수 추출 — API 응답 포맷(`{ success, data, error }`) 변경 없음

**FE-P2 (낮음):**
- useFetch는 단순 패턴 추출. Promise.all 복합 케이스 제외 처리 필요
- 기존 cancelled 패턴과 동일 동작 Vitest로 검증 후 적용
- LAYOUTS 맵 패턴: `extraProps` 내부에서 `accentColor` 등 동적 값 참조 시 클로저 타이밍 주의

**FE-P3 (중간):**
- usePostEditor: localStorage draft 자동저장 타이밍이 폼 상태와 동기화되어야 함
- useImageUpload: quillRef를 훅 외부에서 생성 후 전달해야 함 (quillRef는 컴포넌트 소유)
- BlogLayout Context 분리: BlogHome → Layout 데이터 흐름 변경으로 회귀 가능성
- PostEditor는 현재 Vitest 테스트 없음 → 분해 전 테스트 작성 필요

---

## 4. SOLID 원칙 적용 방향

### 4-1. DRY — 공통 헬퍼 함수 추출 (SRP는 P3/P4에서 달성) (신규 파일: `backend/api/helpers.py`)

```python
# backend/api/helpers.py

def get_pagination_params() -> tuple[int, int, int]:
    """페이지네이션 파라미터 추출 — page, per_page, offset."""
    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
    return page, per_page, (page - 1) * per_page

def success_response(data: dict | list, status: int = 200) -> tuple:
    return jsonify({"success": True, "data": data, "error": ""}), status

def error_response(msg: str, status: int = 400) -> tuple:
    return jsonify({"success": False, "data": {}, "error": msg}), status

def verify_guest_auth(comment: Comment, data: dict) -> tuple[bool, tuple | None]:
    """게스트 댓글 이메일+패스워드 인증. 실패 시 (False, error_response) 반환."""
    from werkzeug.security import check_password_hash
    author_email = (data.get("author_email") or "").strip()
    author_password = (data.get("author_password") or "").strip()
    if not author_email or not author_password:
        return False, error_response("이메일과 패스워드를 입력하세요.", 400)
    if (
        comment.author_id is not None
        or comment.author_email != author_email
        or not comment.author_password_hash
        or not check_password_hash(comment.author_password_hash, author_password)
    ):
        return False, error_response("이메일 또는 패스워드가 올바르지 않습니다.", 401)
    return True, None
```

### 4-2. OCP — list_posts() 필터 함수 분리

```python
def _apply_search_filter(query, total_query, q): ...
def _apply_visibility_filter(query, total_query, user): ...
def _apply_tag_filter(query, total_query, tag_ids, vis_cond, category_id): ...
```

새 필터 추가 시 기존 함수 코드 수정 없이 새 함수만 추가 가능. 단, 새 필터 추가 시 `list_posts()` 내 호출 코드도 추가해야 한다. 완전한 OCP(수정에 닫힘)는 Strategy 패턴/필터 체인 리스트가 필요하며, 이는 P5 수준의 설계에 해당한다.

### 4-3. DIP — Service Layer 도입 (선택적, 장기)

**helpers.py는 DIP와 무관** — HTTP 요청/응답 레이어 헬퍼이며 DB 접근 패턴을 전혀 변경하지 않는다.

P3(`_record_visit`, `_get_post_aggregates`, `_build_series_info`)와 P4(`_apply_*_filter`) 헬퍼 분리는 DIP 방향의 시작이나, 핸들러가 여전히 `db.session.execute(select(...))`, `scalar_one_or_none()` 등 SQLAlchemy를 직접 호출하므로 핸들러-ORM 직접 의존 관계는 유지된다.

완전한 DIP는 Repository Pattern + Service Layer 도입(P5)에서만 달성 가능. 현재 단계에서 전면 도입은 오버엔지니어링 — Repository Pattern은 테스트 커버리지 85% 달성 후 검토.

**LSP:** `StorageBackend` → `LocalStorage` 체인이 LSP 준수 — 위반 없음 확인. 핸들러 함수 간 상속 관계 없으므로 API 레이어에서 LSP 적용 대상 없음.

**ISP:** Blueprint 단위(`posts_bp`, `comments_bp`, `admin_bp`, `follows_bp` 등)가 각 도메인 단일 담당으로 ISP 충족. `StorageBackend.get_local_path()`는 썸네일 생성 시에만 필요한 로컬 전용 메서드 — R2Storage 구현 시 fat interface 방지를 위해 인터페이스 분리 재검토 필요.

---

## 5. 리팩토링 우선순위

| 단계 | 작업 | 대상 파일 | 난이도 | 효과 |
|------|------|---------|--------|------|
| **P1** | 공통 헬퍼 추출 (`api/helpers.py` 신규) | 전체 | 낮음 | DRY 즉시 해소 |
| **P2** | `comments.py` 게스트 인증 중복 제거 | comments.py | 낮음 | 버그 전파 방지 |
| **P3** | `get_post()` 내부 함수 분해 | posts.py | 중간 | SRP, 가독성 향상 |
| **P4** | `list_posts()` 필터 함수 분리 | posts.py | 중간 | OCP, 테스트 용이성 |
| **P5** | Service Layer 도입 (선택) | 전체 | 높음 | 구조적 분리 |

---

## 6. 예상 리스크

### P1~P2 (낮은 리스크)
- 헬퍼 함수 추출 — 기존 동작 변경 없음, 기존 테스트로 검증 가능

### P3~P4 (중간 리스크)
- `get_post()` 분해 시 트랜잭션 경계 주의
  - view_count flush → VisitLog INSERT → commit 순서 보장 필요
  - (BUG-4: commit 6baed90에서 이미 트랜잭션 분리됨 — 참고)
- `list_posts()` 분해 시 `_vis_cond` 공유 상태 관리 복잡도

### P5 (높은 리스크)
- **테스트 커버리지 공백**: comments.py 15%, admin.py 34% — 회귀 탐지 불가
- Flask 요청 컨텍스트(`request`, `g`)를 서비스 계층에서 분리하는 설계 필요
- 전면 구조 변경으로 기존 311개 테스트 전체 재검토 필요

---

## 7. 테스트 전략

**원칙: 리팩토링 대상 파일 커버리지 달성 → 리팩토링 실행 → 테스트 재실행**

| 단계 | 테스트 작업 | 목표 커버리지 |
|------|-----------|------------|
| P1 전 | `helpers.py` 유닛 테스트 신규 작성 | 100% |
| P2 전 | `test_comments.py` — 게스트 인증, 소유권, 스팸 필터 | comments.py 70%↑ |
| P3~P4 전 | `test_admin_full.py` — 권한 변경, 비활성화, 삭제 | admin.py 70%↑ |
| P5 전 | 전체 커버리지 목표 달성 확인 | 전체 85%↑ |

**회귀 방지 인프라 (이미 구축):**
- pre-commit hook: ruff(lint+autofix) → mypy → pytest → eslint 자동 실행
- 현재 테스트 현황: 311 passed, 전체 커버리지 75%

---

## 8. 단계별 구현 계획 (team-lead 승인 후 확정)

> 각 단계 실행 전 team-lead 승인 필요

### P1: `api/helpers.py` 신규 생성

**파일:** `backend/api/helpers.py`
**작업:** `get_pagination_params()`, `success_response()`, `error_response()`, `verify_guest_auth()` 구현
**적용:** 기존 7개 함수에서 `get_pagination_params()` 교체

### P2: comments.py 게스트 인증 중복 제거

**파일:** `backend/api/comments.py`
**작업:** `update_comment()`, `delete_comment()` 내 게스트 인증 블록을 `verify_guest_auth()` 호출로 교체

### P3: get_post() 분해

**파일:** `backend/api/posts.py`
**작업:** `_record_visit()`, `_get_post_aggregates()`, `_build_series_info()` 헬퍼 함수 추출

### P4: list_posts() 필터 함수 분리

**파일:** `backend/api/posts.py`
**작업:** `_apply_*_filter()` 함수군 분리

### P5: Service Layer (별도 논의 후 결정)
