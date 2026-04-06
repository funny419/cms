# 페이지네이션 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 포스트 목록, 내 글 목록, Admin 포스트/댓글 관리 4개 페이지에 인피니트 스크롤 기반 Offset 페이지네이션을 구현한다.

**Architecture:** 백엔드 4개 엔드포인트에 `page`/`per_page` 쿼리 파라미터를 추가하고 응답을 `{ items, page, per_page, total, has_more }` 구조로 변경한다. 프론트엔드에는 `IntersectionObserver` 기반 `useInfiniteScroll` 공통 훅을 만들어 4개 페이지에 일관되게 적용한다.

**Tech Stack:** Python/Flask + SQLAlchemy (백엔드), React + IntersectionObserver API (프론트엔드), Docker Compose (로컬 개발)

---

## Chunk 1: 백엔드 페이지네이션

### Task 1: `GET /api/posts` 페이지네이션

**Files:**
- Modify: `backend/api/posts.py` — `list_posts` 함수

- [ ] **Step 1: `list_posts` 함수에 page/per_page 파라미터 파싱 추가**

`backend/api/posts.py`의 `list_posts` 함수를 다음과 같이 수정한다.

```python
@posts_bp.route("", methods=["GET"])
def list_posts() -> tuple:
    """공개된 포스트 목록 조회 (페이지네이션 포함)."""
    try:
        verify_jwt_in_request(optional=True)
        raw_id = get_jwt_identity()
        current_user_id = int(raw_id) if raw_id else None
    except Exception:
        current_user_id = None

    page = max(1, int(request.args.get("page", 1)))
    per_page = min(max(1, int(request.args.get("per_page", 20))), 100)
    offset = (page - 1) * per_page

    # 댓글수 서브쿼리 (approved 댓글만)
    comment_sq = (
        select(func.count(Comment.id))
        .where(Comment.post_id == Post.id)
        .where(Comment.status == "approved")
        .correlate(Post)
        .scalar_subquery()
    )

    # 추천수 서브쿼리
    like_sq = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id)
        .correlate(Post)
        .scalar_subquery()
    )

    base_query = (
        select(Post, User.username.label("author_username"), comment_sq.label("comment_count"), like_sq.label("like_count"))
        .outerjoin(User, Post.author_id == User.id)
        .where(Post.status == "published")
    )

    total: int = db.session.execute(
        select(func.count(Post.id)).where(Post.status == "published")
    ).scalar() or 0

    rows = db.session.execute(
        base_query.order_by(Post.created_at.desc()).offset(offset).limit(per_page)
    ).all()

    liked_post_ids: set = set()
    if current_user_id:
        liked_post_ids = set(
            db.session.execute(
                select(PostLike.post_id).where(PostLike.user_id == current_user_id)
            ).scalars().all()
        )

    items = []
    for post, author_username, comment_count, like_count in rows:
        d = post.to_dict()
        d["author_username"] = author_username or "알 수 없음"
        d["comment_count"] = comment_count or 0
        d["like_count"] = like_count or 0
        d["user_liked"] = post.id in liked_post_ids
        items.append(d)

    return jsonify({
        "success": True,
        "data": {
            "items": items,
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_more": page * per_page < total,
        },
        "error": "",
    }), 200
```

- [ ] **Step 2: Docker로 확인**

```bash
docker compose exec backend flask shell -c "from api.posts import *"
# 오류 없으면 OK
curl "http://localhost:5000/api/posts?page=1&per_page=2" | python3 -m json.tool
# 기대 결과: data.items 배열, data.has_more, data.total 포함
```

- [ ] **Step 3: 커밋**

```bash
git add backend/api/posts.py
git commit -m "feat: GET /api/posts 페이지네이션 추가 (page/per_page)"
```

---

### Task 2: `GET /api/posts/mine` 페이지네이션

**Files:**
- Modify: `backend/api/posts.py` — `get_my_posts` 함수

- [ ] **Step 1: `get_my_posts` 함수 수정**

```python
@posts_bp.route("/mine", methods=["GET"])
@jwt_required()
def get_my_posts() -> tuple:
    """로그인 유저의 모든 포스트 조회 (draft + published, 페이지네이션)."""
    current_user_id: int = int(get_jwt_identity())
    user: User | None = db.session.get(User, current_user_id)
    if user and user.role == 'deactivated':
        return jsonify({"success": False, "data": {}, "error": "비활성화된 계정입니다."}), 403

    page = max(1, int(request.args.get("page", 1)))
    per_page = min(max(1, int(request.args.get("per_page", 20))), 100)
    offset = (page - 1) * per_page

    total: int = db.session.execute(
        select(func.count(Post.id)).where(Post.author_id == current_user_id)
    ).scalar() or 0

    posts = db.session.execute(
        select(Post)
        .where(Post.author_id == current_user_id)
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(per_page)
    ).scalars().all()

    return jsonify({
        "success": True,
        "data": {
            "items": [p.to_dict() for p in posts],
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_more": page * per_page < total,
        },
        "error": "",
    }), 200
```

- [ ] **Step 2: Docker로 확인**

```bash
# 로그인 토큰을 TOKEN 변수에 저장한 후
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/posts/mine?page=1&per_page=5" | python3 -m json.tool
# 기대 결과: data.items 배열, data.has_more, data.total 포함
```

- [ ] **Step 3: 커밋**

```bash
git add backend/api/posts.py
git commit -m "feat: GET /api/posts/mine 페이지네이션 추가"
```

---

### Task 3: `GET /api/admin/posts` 페이지네이션

**Files:**
- Modify: `backend/api/admin.py` — `admin_list_posts` 함수

- [ ] **Step 1: `admin_list_posts` 함수 수정**

```python
@admin_bp.route("/posts", methods=["GET"])
@roles_required("admin")
def admin_list_posts() -> tuple:
    """전체 포스트 목록 (모든 유저, 모든 상태, 페이지네이션)."""
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(max(1, int(request.args.get("per_page", 20))), 100)
    offset = (page - 1) * per_page

    total: int = db.session.execute(select(func.count(Post.id))).scalar() or 0

    posts = db.session.execute(
        select(Post).order_by(Post.created_at.desc()).offset(offset).limit(per_page)
    ).scalars().all()

    items = [{
        "id": p.id,
        "title": p.title,
        "status": p.status,
        "post_type": p.post_type,
        "author_id": p.author_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in posts]

    return jsonify({
        "success": True,
        "data": {
            "items": items,
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_more": page * per_page < total,
        },
        "error": "",
    }), 200
```

`admin.py` 상단 import에 `func` 추가:
```python
from sqlalchemy import select, update, func
```

- [ ] **Step 2: Docker로 확인**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5000/api/admin/posts?page=1&per_page=5" | python3 -m json.tool
```

- [ ] **Step 3: 커밋**

```bash
git add backend/api/admin.py
git commit -m "feat: GET /api/admin/posts 페이지네이션 추가"
```

---

### Task 4: `GET /api/admin/comments` 페이지네이션

**Files:**
- Modify: `backend/api/admin.py` — `admin_list_comments` 함수

- [ ] **Step 1: `admin_list_comments` 함수 수정**

```python
@admin_bp.route("/comments", methods=["GET"])
@roles_required("admin")
def admin_list_comments() -> tuple:
    """관리자 전용 — 전체 댓글 목록 (post_title 포함, 페이지네이션)."""
    status_filter = request.args.get("status")
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(max(1, int(request.args.get("per_page", 20))), 100)
    offset = (page - 1) * per_page

    count_query = select(func.count(Comment.id)).join(Post, Comment.post_id == Post.id)
    if status_filter:
        count_query = count_query.where(Comment.status == status_filter)
    total: int = db.session.execute(count_query).scalar() or 0

    query = (
        select(Comment, Post.title.label("post_title"))
        .join(Post, Comment.post_id == Post.id)
        .order_by(Comment.created_at.desc())
    )
    if status_filter:
        query = query.where(Comment.status == status_filter)

    rows = db.session.execute(query.offset(offset).limit(per_page)).all()
    items = []
    for comment, post_title in rows:
        d = comment.to_dict()
        d["post_title"] = post_title
        items.append(d)

    return jsonify({
        "success": True,
        "data": {
            "items": items,
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_more": page * per_page < total,
        },
        "error": "",
    }), 200
```

- [ ] **Step 2: Docker로 확인**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5000/api/admin/comments?page=1&per_page=5" | python3 -m json.tool
```

- [ ] **Step 3: 커밋**

```bash
git add backend/api/admin.py
git commit -m "feat: GET /api/admin/comments 페이지네이션 추가"
```

---

## Chunk 2: 프론트엔드 인피니트 스크롤

### Task 5: `useInfiniteScroll` 훅 생성

**Files:**
- Create: `frontend/src/hooks/useInfiniteScroll.js`

- [ ] **Step 1: hooks 디렉토리 생성 및 훅 파일 작성**

`frontend/src/hooks/useInfiniteScroll.js` 신규 생성:

```js
import { useEffect, useRef, useState } from 'react';

/**
 * 인피니트 스크롤 훅
 * @param {(page: number) => Promise<{success: boolean, data: {items: any[], has_more: boolean}}>} fetchFn
 * @param {any[]} deps - 변경 시 목록 초기화 후 1페이지부터 재시작
 *
 * 구현 방식: resetKey 카운터로 deps 변경을 추적.
 * page와 resetKey를 함께 effect 의존성으로 두어 React Strict Mode 이중 실행에도 안전함.
 * IntersectionObserver가 !loading && hasMore를 보장하므로 fetch effect 내 별도 guard 불필요.
 */
export default function useInfiniteScroll(fetchFn, deps = []) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const sentinelRef = useRef(null);

  // deps 변경 시 초기화 — resetKey를 올려 fetch effect를 재트리거
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError('');
    setResetKey((k) => k + 1);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // fetch effect — (resetKey, page) 조합이 바뀔 때마다 실행
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchFn(page)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setItems((prev) => page === 1 ? res.data.items : [...prev, ...res.data.items]);
          setHasMore(res.data.has_more);
        } else {
          setError(res.error || '불러오기에 실패했습니다.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('네트워크 오류가 발생했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [resetKey, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver — sentinel 감지 시 다음 페이지 (error 있으면 중단)
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loading && !error) {
        setPage((p) => p + 1);
      }
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error]);

  return { items, loading, hasMore, error, sentinelRef };
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/hooks/useInfiniteScroll.js
git commit -m "feat: useInfiniteScroll 훅 추가 (IntersectionObserver 기반)"
```

---

### Task 6: API 클라이언트 수정

**Files:**
- Modify: `frontend/src/api/posts.js` — `listPosts`, `getMyPosts`
- Modify: `frontend/src/api/admin.js` — `adminListPosts`
- Modify: `frontend/src/api/comments.js` — `listAllComments`

- [ ] **Step 1: `posts.js` — `listPosts`, `getMyPosts` 수정**

```js
export const listPosts = async (token, page = 1, perPage = 20) => {
  try {
    const headers = token ? authHeader(token) : {};
    const response = await axios.get(BASE_URL, { headers, params: { page, per_page: perPage } });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch posts.' };
  }
};
```

```js
export const getMyPosts = async (token, page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`${BASE_URL}/mine`, {
      headers: authHeader(token),
      params: { page, per_page: perPage },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch my posts.' };
  }
};
```

- [ ] **Step 2: `admin.js` — `adminListPosts` 수정**

```js
export const adminListPosts = async (token, page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`${BASE_URL}/posts`, {
      headers: authHeader(token),
      params: { page, per_page: perPage },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch posts.' };
  }
};
```

- [ ] **Step 3: `comments.js` — `listAllComments` 수정**

```js
export const listAllComments = async (token, status = '', page = 1, perPage = 20) => {
  try {
    const params = { page, per_page: perPage };
    if (status) params.status = status;
    const response = await axios.get('/api/admin/comments', { headers: authHeader(token), params });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '댓글 목록을 불러오지 못했습니다.' };
  }
};
```

- [ ] **Step 4: 추가 호출부 수정 — `RecentPosts.jsx`**

`frontend/src/components/widgets/RecentPosts.jsx` 의 8번째 줄 근처:

```js
// 기존
setPosts(res.data.slice(0, limit));

// 변경
setPosts(res.data.items.slice(0, limit));
```

- [ ] **Step 5: 추가 호출부 수정 — `PostDetail.jsx`**

`frontend/src/pages/PostDetail.jsx` 의 `listRes.data` 참조 부분:

```js
// 기존 (63번째 줄 근처)
const sorted = [...listRes.data].sort(...)

// 변경
const sorted = [...listRes.data.items].sort(...)
```

> **주의:** `listPosts`는 page=1 (최신 20개)만 반환한다. PostDetail의 이전/다음 글 네비게이션은 최신 20개 이내에서만 동작한다. 개인 블로그 특성상 허용 범위.

- [ ] **Step 6: 호출부 전수 확인**

```bash
grep -r "listPosts\|getMyPosts\|adminListPosts\|listAllComments" frontend/src --include="*.jsx" --include="*.js" -l
# 기대 파일 목록:
#   listPosts      → posts.js, PostList.jsx, PostDetail.jsx, RecentPosts.jsx  (4개)
#   getMyPosts     → posts.js, MyPosts.jsx                                     (2개)
#   adminListPosts → admin.js, AdminPosts.jsx                                  (2개)
#   listAllComments→ comments.js, AdminComments.jsx                            (2개)
# 이 외 파일이 나오면 해당 파일도 res.data.items 로 변경 필요
```

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/api/posts.js frontend/src/api/admin.js frontend/src/api/comments.js \
        frontend/src/components/widgets/RecentPosts.jsx frontend/src/pages/PostDetail.jsx
git commit -m "feat: API 클라이언트 page/per_page 파라미터 추가, 기존 호출부 대응"
```

---

### Task 7: `PostList.jsx` 인피니트 스크롤 적용

**Files:**
- Modify: `frontend/src/pages/PostList.jsx`

- [ ] **Step 1: `PostList.jsx` 전체 교체**

```jsx
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPosts } from '../api/posts';
import useInfiniteScroll from '../hooks/useInfiniteScroll';

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};
const isEditorOrAdmin = (user) =>
  user && (user.role === 'admin' || user.role === 'editor');

export default function PostList() {
  const navigate = useNavigate();
  const user = getUser();
  const token = localStorage.getItem('token');

  const fetchFn = useCallback(
    (page) => listPosts(token, page),
    [token]
  );
  const { items: posts, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token]);

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>포스트</h1>
        {isEditorOrAdmin(user) && (
          <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>
            + 새 글
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
          <p>게시된 포스트가 없습니다.</p>
        </div>
      ) : (
        <ul className="post-list">
          {posts.map((post) => (
            <li
              key={post.id}
              className="post-item"
              onClick={() => navigate(`/posts/${post.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="post-title">{post.title}</div>
              {post.excerpt && (
                <div className="post-excerpt">{post.excerpt}</div>
              )}
              <div className="post-meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{post.author_username || '알 수 없음'}</span>
                <span>·</span>
                {post.created_at && (
                  <span>
                    {new Date(post.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </span>
                )}
                <span>·</span>
                <span>👁 {post.view_count ?? 0}</span>
                <span>·</span>
                <span>💬 {post.comment_count ?? 0}</span>
                <span>·</span>
                <span>♥ {post.like_count ?? 0}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && (
        <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 글이 없습니다.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 브라우저에서 확인**

`http://localhost:5173` 접속 → 포스트 목록 스크롤 시 자동 로드 동작 확인.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/PostList.jsx
git commit -m "feat: PostList 인피니트 스크롤 적용"
```

---

### Task 8: `MyPosts.jsx` 인피니트 스크롤 적용

**Files:**
- Modify: `frontend/src/pages/MyPosts.jsx`

- [ ] **Step 1: `MyPosts.jsx` 수정**

import 변경 및 훅 적용:

```jsx
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPosts, deletePost } from '../api/posts';
import useInfiniteScroll from '../hooks/useInfiniteScroll';

const STATUS_BADGE = {
  published: { label: '발행됨', style: { background: 'var(--accent-bg)', color: 'var(--accent-text)' } },
  draft: { label: '임시저장', style: { background: 'var(--bg-subtle)', color: 'var(--text-light)' } },
  scheduled: { label: '예약됨', style: { background: '#fef3c7', color: '#92400e' } },
};

export default function MyPosts() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [deletedIds, setDeletedIds] = useState(new Set());

  const fetchFn = useCallback(
    (page) => {
      if (!token) { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      return getMyPosts(token, page);
    },
    [token]
  );
  const { items, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token]);
  const posts = items.filter((p) => !deletedIds.has(p.id));

  const handleDelete = async (id) => {
    const res = await deletePost(token, id);
    if (res.success) setDeletedIds((prev) => new Set([...prev, id]));
    else alert(res.error);
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>내 블로그</h1>
        <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>+ 새 글</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, marginBottom: 12 }}>✍️</p>
          <p>아직 작성한 글이 없습니다.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/posts/new')}>
            첫 글 작성하기
          </button>
        </div>
      ) : (
        <ul className="post-list">
          {posts.map((post) => {
            const badge = STATUS_BADGE[post.status] || STATUS_BADGE.draft;
            const dateStr = post.created_at
              ? new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
              : '';
            return (
              <li key={post.id} className="post-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    <div className="post-title">{post.title}</div>
                    <div className="post-meta" style={{ marginTop: 4 }}>{dateStr}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...badge.style }}>
                      {badge.label}
                    </span>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => navigate(`/posts/${post.id}/edit`)}
                    >
                      편집
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => handleDelete(post.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && (
        <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 글이 없습니다.
        </div>
      )}
    </div>
  );
}
```

> **삭제 처리 방식:** API 재로드 대신 `deletedIds` Set으로 로컬 필터링. 인피니트 스크롤 상태를 유지하면서 삭제 결과를 즉시 반영.

- [ ] **Step 2: 브라우저에서 확인**

editor 로그인 후 `/my-posts` 접속 → 스크롤 동작 및 삭제 후 목록 갱신 확인.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/MyPosts.jsx
git commit -m "feat: MyPosts 인피니트 스크롤 적용"
```

---

### Task 9: `AdminPosts.jsx` 인피니트 스크롤 적용

**Files:**
- Modify: `frontend/src/pages/admin/AdminPosts.jsx`

- [ ] **Step 1: `AdminPosts.jsx` 수정**

```jsx
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminListPosts } from '../../api/admin';
import { deletePost } from '../../api/posts';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';

const STATUS_LABEL = { published: '발행됨', draft: '임시저장', scheduled: '예약됨' };
const STATUS_COLOR = {
  published: { background: 'var(--accent-bg)', color: 'var(--accent-text)' },
  draft:     { background: 'var(--bg-subtle)', color: 'var(--text-light)' },
  scheduled: { background: '#fef3c7', color: '#92400e' },
};

export default function AdminPosts() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [deletedIds, setDeletedIds] = useState(new Set());

  const fetchFn = useCallback(
    (page) => {
      if (!token) { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user?.role !== 'admin') { navigate('/my-posts'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      } catch { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      return adminListPosts(token, page);
    },
    [token]
  );
  const { items, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token]);
  const posts = items.filter((p) => !deletedIds.has(p.id));

  const handleDelete = async (id) => {
    if (!window.confirm('이 포스트를 삭제할까요?')) return;
    const res = await deletePost(token, id);
    if (res.success) setDeletedIds((prev) => new Set([...prev, id]));
    else alert(res.error);
  };

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <h1 className="page-heading" style={{ marginBottom: 24 }}>포스트 관리</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state"><p>포스트가 없습니다.</p></div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              {['제목', '작성자 ID', '상태', '작성일', ''].map((h) => (
                <th key={h} style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td
                  style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 500, cursor: 'pointer' }}
                  onClick={() => navigate(`/posts/${post.id}`)}
                >
                  {post.title}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-light)' }}>
                  {post.author_id ?? '(삭제된 회원)'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...(STATUS_COLOR[post.status] || STATUS_COLOR.draft) }}>
                    {STATUS_LABEL[post.status] || post.status}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-light)', fontSize: 13 }}>
                  {post.created_at ? new Date(post.created_at).toLocaleDateString('ko-KR') : ''}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={() => navigate(`/posts/${post.id}/edit`)}>
                      수정
                    </button>
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={() => handleDelete(post.id)}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && (
        <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 포스트가 없습니다.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 브라우저에서 확인**

admin 로그인 후 `/admin/posts` → 스크롤 및 삭제 동작 확인.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/admin/AdminPosts.jsx
git commit -m "feat: AdminPosts 인피니트 스크롤 적용"
```

---

### Task 10: `AdminComments.jsx` 인피니트 스크롤 적용

**Files:**
- Modify: `frontend/src/pages/admin/AdminComments.jsx`

> **범위 참고:** 스펙의 `statusFilter` UI(드롭다운으로 상태 필터 전환)는 이번 구현에서 제외한다. 기존 `AdminComments.jsx`도 필터 UI가 없었으므로 동일 수준 유지. 필터 UI는 추후 별도 태스크에서 구현.

- [ ] **Step 1: `AdminComments.jsx` 수정**

```jsx
// frontend/src/pages/admin/AdminComments.jsx
import { useCallback, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listAllComments, deleteComment } from '../../api/comments';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';

const STATUS_LABEL = { approved: '공개', pending: '승인 대기', spam: '스팸' };
const STATUS_COLOR = {
  approved: { background: 'var(--accent-bg)', color: 'var(--accent-text)' },
  pending:  { background: '#fef3c7', color: '#92400e' },
  spam:     { background: '#fee2e2', color: '#991b1b' },
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function AdminComments() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [deletedIds, setDeletedIds] = useState(new Set());

  const fetchFn = useCallback(
    (page) => {
      if (!token) { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user?.role !== 'admin') { navigate('/my-posts'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      } catch { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      return listAllComments(token, '', page);
    },
    [token]
  );
  const { items, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token]);
  const comments = items.filter((c) => !deletedIds.has(c.id));

  const handleDelete = async (commentId) => {
    if (!window.confirm('이 댓글을 삭제할까요? 답글도 함께 삭제됩니다.')) return;
    const res = await deleteComment(token, commentId);
    if (res.success) setDeletedIds((prev) => new Set([...prev, commentId]));
    else alert(res.error);
  };

  return (
    <div className="page-content" style={{ maxWidth: 960 }}>
      <h1 className="page-heading" style={{ marginBottom: 24 }}>댓글 관리</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {comments.length === 0 && !loading && !error ? (
        <div className="empty-state"><p>등록된 댓글이 없습니다.</p></div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              {['포스트', '작성자', '내용', '상태', '작성일', ''].map((h) => (
                <th key={h} style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comments.map((comment) => (
              <tr key={comment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Link to={`/posts/${comment.post_id}`} style={{ color: 'var(--accent)' }}>
                    {comment.post_title || `#${comment.post_id}`}
                  </Link>
                  {comment.parent_id && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-light)' }}>(답글)</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {comment.author_name}
                  {comment.author_id === null && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-light)' }}>(게스트)</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {comment.content.slice(0, 60)}{comment.content.length > 60 ? '...' : ''}
                </td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                    ...(STATUS_COLOR[comment.status] || {}) }}>
                    {STATUS_LABEL[comment.status] || comment.status}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                  {formatDate(comment.created_at)}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '3px 10px' }}
                    onClick={() => handleDelete(comment.id)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && (
        <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>
      )}
      {!hasMore && comments.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 댓글이 없습니다.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 브라우저에서 확인**

admin 로그인 후 `/admin/comments` → 스크롤 및 삭제 동작 확인.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/admin/AdminComments.jsx
git commit -m "feat: AdminComments 인피니트 스크롤 적용"
```
