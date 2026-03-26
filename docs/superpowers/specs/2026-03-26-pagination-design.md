# 페이지네이션 설계 문서

**날짜:** 2026-03-26
**기능:** 인피니트 스크롤 기반 Offset 페이지네이션
**적용 범위:** PostList, MyPosts, AdminPosts, AdminComments

---

## 1. 개요

현재 4개 페이지(PostList, MyPosts, AdminPosts, AdminComments)의 모든 목록 API가 전체 데이터를 한 번에 반환한다. 포스트 수가 늘어날수록 초기 로딩이 느려지므로, Offset 기반 서버사이드 페이지네이션과 인피니트 스크롤 UI를 도입한다.

**방식:** Offset 기반 (page + per_page 쿼리 파라미터)
**UI:** IntersectionObserver를 활용한 인피니트 스크롤 (sentinel 요소 감지)
**기본 페이지 크기:** 20개

---

## 2. 백엔드 설계

### 2.1 쿼리 파라미터

모든 대상 엔드포인트에 동일하게 적용:

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `page` | `1` | 1-indexed 페이지 번호 |
| `per_page` | `20` | 페이지당 항목 수 |

### 2.2 응답 구조 변경

**기존:**
```json
{ "success": true, "data": [...], "error": "" }
```

**변경 후:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "page": 1,
    "per_page": 20,
    "total": 87,
    "has_more": true
  },
  "error": ""
}
```

- `total`: 조건에 맞는 전체 항목 수 (별도 COUNT 쿼리 1회)
- `has_more`: `page * per_page < total`

### 2.3 SQLAlchemy 쿼리 변경 패턴

```python
page = int(request.args.get("page", 1))
per_page = int(request.args.get("per_page", 20))
offset = (page - 1) * per_page

total = db.session.execute(select(func.count()).select_from(...)).scalar()
rows = db.session.execute(query.offset(offset).limit(per_page)).all()

return jsonify({
    "success": True,
    "data": {
        "items": [...],
        "page": page,
        "per_page": per_page,
        "total": total,
        "has_more": page * per_page < total,
    },
    "error": "",
}), 200
```

### 2.4 대상 엔드포인트

| 엔드포인트 | 파일 |
|-----------|------|
| `GET /api/posts` | `backend/api/posts.py` |
| `GET /api/posts/mine` | `backend/api/posts.py` |
| `GET /api/admin/posts` | `backend/api/admin.py` |
| `GET /api/admin/comments` | `backend/api/admin.py` |

---

## 3. 프론트엔드 설계

### 3.1 공통 훅: `useInfiniteScroll`

**파일:** `frontend/src/hooks/useInfiniteScroll.js`

```js
// 인터페이스
const { items, loading, hasMore, sentinelRef, reset } = useInfiniteScroll(fetchFn, deps);
```

**파라미터:**
- `fetchFn(page)`: 페이지 번호를 받아 `{ items, has_more }` 형태를 반환하는 비동기 함수
- `deps`: 의존성 배열 — 변경 시 items 초기화 후 1페이지부터 재시작

**동작:**
1. 초기 마운트 시 page=1 로드
2. `sentinelRef`를 연결한 `<div>`가 뷰포트에 진입하면 다음 페이지 로드
3. `hasMore=false`이면 더 이상 로드하지 않음
4. 중복 요청 방지: `loading=true`인 동안 Observer 콜백 무시

**내부 구현 핵심:**
```js
useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && hasMore && !loading) loadMore();
  });
  if (sentinelRef.current) observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [hasMore, loading]);
```

### 3.2 API 클라이언트 변경

**파일:** `frontend/src/api/posts.js`, `frontend/src/api/admin.js`

```js
// 기존
listPosts(token)

// 변경
listPosts(token, page = 1, perPage = 20)
// GET /api/posts?page=1&per_page=20
// 반환: { success, data: { items, page, per_page, total, has_more }, error }
```

### 3.3 각 페이지 변경

**`PostList.jsx`:**
- `useInfiniteScroll((page) => listPosts(token, page))` 사용
- 목록 하단에 `<div ref={sentinelRef} />` 추가
- 로딩/끝 상태 표시

**`MyPosts.jsx`:**
- `useInfiniteScroll((page) => getMyPosts(token, page))` 사용
- 동일 패턴

**`AdminPosts.jsx`:**
- `useInfiniteScroll((page) => adminListPosts(token, page))` 사용
- 동일 패턴

**`AdminComments.jsx`:**
- `useInfiniteScroll((page) => adminListComments(token, page, statusFilter))` 사용
- `statusFilter` 변경 시 `deps`에 포함 → 자동 reset

### 3.4 UI 상태 표시

```
[포스트 목록]

포스트 1
포스트 2
...
포스트 20

<div ref={sentinelRef} />     ← 뷰포트 진입 시 다음 로드 트리거

불러오는 중...                 ← loading=true
더 이상 글이 없습니다.          ← hasMore=false
```

---

## 4. 에러 처리

- 네트워크 에러 시 추가 로드 중단, 기존 항목 유지
- 잘못된 `page` 값(0, 음수, 문자열) → 백엔드에서 `max(1, int(page))` 처리

---

## 5. 변경 파일 목록

**Backend:**
- `backend/api/posts.py` — `list_posts`, `get_my_posts` 수정
- `backend/api/admin.py` — `admin_list_posts`, `admin_list_comments` 수정

**Frontend:**
- `frontend/src/hooks/useInfiniteScroll.js` — 신규 생성
- `frontend/src/api/posts.js` — `listPosts`, `getMyPosts` 파라미터 추가
- `frontend/src/api/admin.js` — `adminListPosts`, `adminListComments` 파라미터 추가
- `frontend/src/pages/PostList.jsx` — 훅 적용
- `frontend/src/pages/MyPosts.jsx` — 훅 적용
- `frontend/src/pages/admin/AdminPosts.jsx` — 훅 적용
- `frontend/src/pages/admin/AdminComments.jsx` — 훅 적용
