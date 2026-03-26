# 포스트 검색/필터 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PostList와 AdminPosts에 제목 키워드 검색 및 상태 필터를 추가한다.

**Architecture:** 백엔드 2개 엔드포인트에 `q`(LIKE 검색), `status`(필터) 쿼리 파라미터를 추가하고, 프론트엔드에서 300ms 디바운스 후 `useInfiniteScroll`의 `deps`를 업데이트해 자동 초기화/재요청한다.

**Tech Stack:** Python/Flask + SQLAlchemy ilike (백엔드), React useState/useEffect 디바운스 (프론트엔드)

---

## Chunk 1: 백엔드 검색/필터 파라미터

### Task 1: `GET /api/posts` 검색 파라미터 추가

**Files:**
- Modify: `backend/api/posts.py` — `list_posts` 함수

- [ ] **Step 1: `list_posts` 함수에 `q` 파라미터 추가**

현재 파일을 읽은 후, `page`/`per_page` 파싱 직후에 `q` 파싱을 추가하고, `base_query`와 `total` 카운트 쿼리 모두에 ilike 필터를 적용한다.

```python
@posts_bp.route("", methods=["GET"])
def list_posts() -> tuple:
    """공개된 포스트 목록 조회 (페이지네이션 + 검색 포함)."""
    try:
        verify_jwt_in_request(optional=True)
        raw_id = get_jwt_identity()
        current_user_id = int(raw_id) if raw_id else None
    except Exception:
        current_user_id = None

    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
    offset = (page - 1) * per_page
    q = request.args.get("q", "").strip()

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
    if q:
        base_query = base_query.where(Post.title.ilike(f"%{q}%"))

    total_query = select(func.count(Post.id)).where(Post.status == "published")
    if q:
        total_query = total_query.where(Post.title.ilike(f"%{q}%"))
    total: int = db.session.execute(total_query).scalar() or 0

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
# 검색어 없음 — 기존과 동일
curl "http://localhost:5000/api/posts?page=1&per_page=3" | python3 -m json.tool | head -5

# 검색어 있음 — 제목에 해당 단어가 포함된 포스트만 반환
curl "http://localhost:5000/api/posts?q=테스트&page=1" | python3 -m json.tool | head -10
# 기대: data.items의 모든 항목 title에 "테스트" 포함
```

- [ ] **Step 3: 커밋**

```bash
git add backend/api/posts.py
git commit -m "feat: GET /api/posts 제목 검색 파라미터(q) 추가"
```

---

### Task 2: `GET /api/admin/posts` 검색/필터 파라미터 추가

**Files:**
- Modify: `backend/api/admin.py` — `admin_list_posts` 함수

- [ ] **Step 1: `admin_list_posts` 함수에 `q`, `status` 파라미터 추가**

현재 파일을 읽은 후, `admin_list_posts` 함수 전체를 다음으로 교체한다.

```python
@admin_bp.route("/posts", methods=["GET"])
@roles_required("admin")
def admin_list_posts() -> tuple:
    """전체 포스트 목록 (모든 유저, 검색/필터/페이지네이션)."""
    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(max(1, request.args.get("per_page", 20, type=int) or 20), 100)
    offset = (page - 1) * per_page
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

    total: int = db.session.execute(count_query).scalar() or 0

    posts = db.session.execute(
        data_query.offset(offset).limit(per_page)
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

- [ ] **Step 2: Docker로 확인**

```bash
# 상태 필터
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5000/api/admin/posts?status=published&page=1" | python3 -m json.tool | head -10
# 기대: data.items의 모든 항목 status == "published"

# 제목 검색
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5000/api/admin/posts?q=테스트&page=1" | python3 -m json.tool | head -10
```

- [ ] **Step 3: 커밋**

```bash
git add backend/api/admin.py
git commit -m "feat: GET /api/admin/posts 검색(q)/상태 필터(status) 파라미터 추가"
```

---

## Chunk 2: 프론트엔드 검색/필터 UI

### Task 3: API 클라이언트 파라미터 추가

**Files:**
- Modify: `frontend/src/api/posts.js` — `listPosts` 함수
- Modify: `frontend/src/api/admin.js` — `adminListPosts` 함수

- [ ] **Step 1: `posts.js` — `listPosts`에 `q` 파라미터 추가**

현재 파일을 읽은 후 `listPosts` 함수만 수정 (나머지 함수 유지):

```js
export const listPosts = async (token, page = 1, perPage = 20, q = '') => {
  try {
    const headers = token ? authHeader(token) : {};
    const params = { page, per_page: perPage };
    if (q) params.q = q;
    const response = await axios.get(BASE_URL, { headers, params });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch posts.' };
  }
};
```

- [ ] **Step 2: `admin.js` — `adminListPosts`에 `q`, `status` 파라미터 추가**

현재 파일을 읽은 후 `adminListPosts` 함수만 수정 (나머지 함수 유지):

```js
export const adminListPosts = async (token, page = 1, perPage = 20, q = '', status = '') => {
  try {
    const params = { page, per_page: perPage };
    if (q) params.q = q;
    if (status) params.status = status;
    const response = await axios.get(`${BASE_URL}/posts`, {
      headers: authHeader(token),
      params,
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch posts.' };
  }
};
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/api/posts.js frontend/src/api/admin.js
git commit -m "feat: API 클라이언트 검색/필터 파라미터 추가 (listPosts, adminListPosts)"
```

---

### Task 4: `PostList.jsx` 검색 UI 적용

**Files:**
- Modify: `frontend/src/pages/PostList.jsx`

- [ ] **Step 1: `PostList.jsx` 전체 교체**

```jsx
import { useCallback, useEffect, useState } from 'react';
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

  const [inputQ, setInputQ] = useState('');
  const [q, setQ] = useState('');

  // 300ms 디바운스
  useEffect(() => {
    const timer = setTimeout(() => setQ(inputQ.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputQ]);

  const fetchFn = useCallback(
    (page) => listPosts(token, page, 20, q),
    [token, q]
  );
  const { items: posts, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token, q]);

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>포스트</h1>
        {isEditorOrAdmin(user) && (
          <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>
            + 새 글
          </button>
        )}
      </div>

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

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
          <p>{q ? `"${q}"에 대한 검색 결과가 없습니다.` : '게시된 포스트가 없습니다.'}</p>
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

`http://localhost:5173` 접속 →
1. 검색창 입력 → 300ms 후 목록 자동 갱신 확인
2. 검색어 지우면 전체 목록 복원 확인
3. 없는 제목 검색 → "검색 결과가 없습니다." 메시지 확인

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/PostList.jsx
git commit -m "feat: PostList 제목 검색 UI 추가 (디바운스 300ms)"
```

---

### Task 5: `AdminPosts.jsx` 검색/필터 UI 적용

**Files:**
- Modify: `frontend/src/pages/admin/AdminPosts.jsx`

- [ ] **Step 1: `AdminPosts.jsx` 전체 교체**

```jsx
import { useCallback, useEffect, useState } from 'react';
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
  const [inputQ, setInputQ] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  // 300ms 디바운스
  useEffect(() => {
    const timer = setTimeout(() => setQ(inputQ.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputQ]);

  const fetchFn = useCallback(
    (page) => {
      if (!token) { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user?.role !== 'admin') { navigate('/my-posts'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      } catch { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      return adminListPosts(token, page, 20, q, status);
    },
    [token, q, status]
  );
  const { items, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token, q, status]);
  const posts = items.filter((p) => !deletedIds.has(p.id));

  const handleDelete = async (id) => {
    if (!window.confirm('이 포스트를 삭제할까요?')) return;
    const res = await deletePost(token, id);
    if (res.success) setDeletedIds((prev) => new Set([...prev, id]));
    else alert(res.error);
  };

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <h1 className="page-heading" style={{ marginBottom: 16 }}>포스트 관리</h1>

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
          <option value="scheduled">예약됨</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <p>{q || status ? '검색 결과가 없습니다.' : '포스트가 없습니다.'}</p>
        </div>
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

admin 로그인 후 `/admin/posts` 접속 →
1. 제목 검색 → 300ms 후 목록 자동 갱신 확인
2. 상태 드롭다운 변경 → 즉시 목록 갱신 확인
3. 검색어 + 상태 동시 필터 동작 확인
4. 필터 해제 시 전체 목록 복원 확인

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/admin/AdminPosts.jsx
git commit -m "feat: AdminPosts 검색/상태 필터 UI 추가"
```
