# 포스트 검색/필터 설계 문서

**날짜:** 2026-03-26
**기능:** 포스트 제목 키워드 검색 + 상태 필터
**적용 범위:** PostList (공개 전체글), AdminPosts (어드민 포스트 관리)

---

## 1. 개요

현재 PostList와 AdminPosts는 페이지네이션만 지원하며 검색/필터 기능이 없다. 제목 키워드 검색과(AdminPosts의 경우) 상태 필터를 서버사이드 LIKE 쿼리로 구현한다. 검색어/필터 변경 시 `useInfiniteScroll`의 `deps` 메커니즘이 자동으로 목록을 초기화하고 1페이지부터 재요청한다.

**방식:** 서버사이드 LIKE 검색 (`Post.title.ilike(f"%{q}%")`)
**검색 필드:** 제목(title)만
**UI:** PostList — 검색 입력창, AdminPosts — 검색 입력창 + 상태 드롭다운
**디바운스:** 검색 입력 300ms 디바운스 (인라인 useEffect+setTimeout)

---

## 2. 백엔드 설계

### 2.1 `GET /api/posts` 변경

**추가 쿼리 파라미터:**

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `q` | `""` | 제목 부분 검색 (빈 문자열이면 전체) |

**쿼리 로직:**
```python
q = request.args.get("q", "").strip()

# base_query와 total COUNT 쿼리 모두에 동일 필터 적용
if q:
    base_query = base_query.where(Post.title.ilike(f"%{q}%"))
    # total 카운트도 같은 조건으로
```

**변경 파일:** `backend/api/posts.py` — `list_posts` 함수

### 2.2 `GET /api/admin/posts` 변경

**추가 쿼리 파라미터:**

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `q` | `""` | 제목 부분 검색 |
| `status` | `""` | 상태 필터 (`published` / `draft` / `scheduled`, 빈 값이면 전체) |

**쿼리 로직:**
```python
q = request.args.get("q", "").strip()
status = request.args.get("status", "").strip()

count_query = select(func.count(Post.id))
data_query = select(Post).order_by(Post.created_at.desc())

if q:
    count_query = count_query.where(Post.title.ilike(f"%{q}%"))
    data_query = data_query.where(Post.title.ilike(f"%{q}%"))
if status in ("published", "draft", "scheduled"):
    count_query = count_query.where(Post.status == status)
    data_query = data_query.where(Post.status == status)
```

**변경 파일:** `backend/api/admin.py` — `admin_list_posts` 함수

---

## 3. 프론트엔드 설계

### 3.1 검색어 디바운스 패턴

두 페이지 모두 동일한 패턴 사용:

```js
const [inputQ, setInputQ] = useState('');   // 입력 즉시 반영 (controlled)
const [q, setQ] = useState('');              // 300ms 디바운스 후 실제 검색어

useEffect(() => {
  const timer = setTimeout(() => setQ(inputQ.trim()), 300);
  return () => clearTimeout(timer);
}, [inputQ]);
```

- `inputQ`: input value (즉시 업데이트)
- `q`: 실제 API 파라미터 (300ms 후 업데이트) → `useInfiniteScroll`의 `deps`에 포함
- `q` 변경 시 `useInfiniteScroll`이 자동으로 reset → 1페이지 재요청

### 3.2 `PostList.jsx` 변경

**UI 추가:**
```jsx
{/* 헤더 아래, 목록 위 */}
<div style={{ marginBottom: 20 }}>
  <input
    type="text"
    className="form-input"
    placeholder="제목으로 검색..."
    value={inputQ}
    onChange={(e) => setInputQ(e.target.value)}
    style={{ width: '100%', maxWidth: 400 }}
  />
</div>
```

**fetchFn 변경:**
```js
const fetchFn = useCallback(
  (page) => listPosts(token, page, 20, q),
  [token, q]
);
// deps: [token, q]
```

**빈 상태 메시지 분기:**
```jsx
{posts.length === 0 && !loading && !error ? (
  <div className="empty-state">
    <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
    <p>{q ? `"${q}"에 대한 검색 결과가 없습니다.` : '게시된 포스트가 없습니다.'}</p>
  </div>
) : ...}
```

### 3.3 `AdminPosts.jsx` 변경

**UI 추가:**
```jsx
{/* 헤더 아래 */}
<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
  <input
    type="text"
    className="form-input"
    placeholder="제목으로 검색..."
    value={inputQ}
    onChange={(e) => setInputQ(e.target.value)}
    style={{ flex: 1, maxWidth: 300 }}
  />
  <select
    className="form-input"
    value={status}
    onChange={(e) => setStatus(e.target.value)}
    style={{ width: 120 }}
  >
    <option value="">전체</option>
    <option value="published">발행됨</option>
    <option value="draft">임시저장</option>
  </select>
</div>
```

**fetchFn 변경:**
```js
const [status, setStatus] = useState('');
// ...
const fetchFn = useCallback(
  (page) => adminListPosts(token, page, 20, q, status),
  [token, q, status]
);
// deps: [token, q, status]
```

**빈 상태 메시지 분기:**
```jsx
{posts.length === 0 && !loading && !error ? (
  <div className="empty-state">
    <p>{q || status ? '검색 결과가 없습니다.' : '포스트가 없습니다.'}</p>
  </div>
) : ...}
```

### 3.4 API 클라이언트 변경

**`frontend/src/api/posts.js` — `listPosts` 파라미터 추가:**
```js
export const listPosts = async (token, page = 1, perPage = 20, q = '') => {
  const params = { page, per_page: perPage };
  if (q) params.q = q;
  // ...
};
```

**`frontend/src/api/admin.js` — `adminListPosts` 파라미터 추가:**
```js
export const adminListPosts = async (token, page = 1, perPage = 20, q = '', status = '') => {
  const params = { page, per_page: perPage };
  if (q) params.q = q;
  if (status) params.status = status;
  // ...
};
```

---

## 4. 에러 처리

- 빈 검색어(`q=""`)는 전체 목록과 동일 — 별도 처리 불필요
- 잘못된 `status` 값은 백엔드에서 허용 목록 체크로 무시 (`if status in (...)`)
- 검색 중 네트워크 오류는 기존 `useInfiniteScroll`의 `error` 상태로 처리

---

## 5. 변경 파일 목록

**Backend:**
- `backend/api/posts.py` — `list_posts`: `q` 파라미터 + ilike 필터
- `backend/api/admin.py` — `admin_list_posts`: `q`, `status` 파라미터 + ilike/status 필터

**Frontend:**
- `frontend/src/api/posts.js` — `listPosts`: `q` 파라미터 추가
- `frontend/src/api/admin.js` — `adminListPosts`: `q`, `status` 파라미터 추가
- `frontend/src/pages/PostList.jsx` — 검색 input + debounce 상태 + fetchFn 업데이트
- `frontend/src/pages/admin/AdminPosts.jsx` — 검색 input + 상태 드롭다운 + fetchFn 업데이트
