# 포스트 통계 & 추천 기능 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전체 글 목록에 작성자·조회수·댓글수·추천수를 표시하고, 포스트 상세 페이지에서 로그인 사용자가 추천(토글)할 수 있게 한다.

**Architecture:** DB에 `Post.view_count` 컬럼과 `post_likes` 테이블을 추가하고, `GET /api/posts`를 JOIN 집계 쿼리로 교체하며, `GET /api/posts/<id>`에 view_count +1과 집계를 단일 트랜잭션으로 처리한다. 프론트엔드는 PostList에 메타 한 줄, PostDetail에 추천 버튼을 추가한다.

**Tech Stack:** Python 3.11 + Flask + SQLAlchemy 2.x, React 19 + axios, MariaDB 10.11, Docker Compose (dev)

**Spec:** `docs/superpowers/specs/2026-03-25-post-stats-like-design.md`

---

## 변경 파일 목록

| 파일 | 유형 | 역할 |
|------|------|------|
| `backend/models/schema.py` | 수정 | Post.view_count 추가, PostLike 모델 신규 |
| `backend/migrations/versions/` | 신규 | view_count + post_likes 마이그레이션 |
| `backend/api/posts.py` | 수정 | 집계 쿼리, view_count+1, like 토글 엔드포인트 |
| `frontend/src/api/posts.js` | 수정 | listPosts/getPost token optional, likePost 추가 |
| `frontend/src/pages/PostList.jsx` | 수정 | 메타 정보 한 줄 추가 |
| `frontend/src/pages/PostDetail.jsx` | 수정 | 추천 버튼 + author_username/view_count 표시 |

---

## Chunk 1: 백엔드

### Task 1: DB 스키마 변경 및 마이그레이션

**Files:**
- Modify: `backend/models/schema.py`
- Create: `backend/migrations/versions/<hash>_post_stats_and_likes.py` (자동 생성)

- [ ] **Step 1: Post 모델에 view_count 추가 + to_dict 수정**

  **1a.** `backend/models/schema.py`의 Post 클래스에서 `updated_at` 필드 아래에 추가:

  ```python
  view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
  ```

  상단에 `Integer`가 이미 import되어 있음 (`from sqlalchemy import Integer, String, ...`).

  **1b.** 같은 파일 `Post.to_dict()` 메서드에 `view_count` 필드 추가 (응답 JSON에 포함되도록):

  ```python
  def to_dict(self) -> dict:
      return {
          "id": self.id,
          "title": self.title,
          "slug": self.slug,
          "content": self.content,
          "excerpt": self.excerpt,
          "status": self.status,
          "post_type": self.post_type,
          "author_id": self.author_id,
          "view_count": self.view_count,   # ← 추가
          "created_at": self.created_at.isoformat() if self.created_at else None,
          "updated_at": self.updated_at.isoformat() if self.updated_at else None,
      }
  ```

- [ ] **Step 2: PostLike 모델 신규 추가**

  **2a.** `backend/models/schema.py` 상단의 sqlalchemy import 줄에 `UniqueConstraint` 추가:

  기존:
  ```python
  from sqlalchemy import Integer, String, Text, ForeignKey, DateTime, Boolean, JSON, Enum
  ```
  교체:
  ```python
  from sqlalchemy import Integer, String, Text, ForeignKey, DateTime, Boolean, JSON, Enum, UniqueConstraint
  ```

  **2b.** `backend/models/schema.py`의 Comment 클래스 바로 위에 아래 클래스 추가:

  ```python
  class PostLike(Base):
      """
      포스트 추천 (1인 1추천, 토글)
      """
      __tablename__ = 'post_likes'

      id: Mapped[int] = mapped_column(primary_key=True)
      post_id: Mapped[int] = mapped_column(
          ForeignKey('posts.id', ondelete='CASCADE'), nullable=False
      )
      user_id: Mapped[int] = mapped_column(
          ForeignKey('users.id', ondelete='CASCADE'), nullable=False
      )
      created_at: Mapped[datetime] = mapped_column(
          DateTime(timezone=True), server_default=func.now()
      )

      __table_args__ = (UniqueConstraint('post_id', 'user_id', name='uq_post_like'),)
  ```

- [ ] **Step 3: 마이그레이션 생성**

  ```bash
  docker compose exec backend flask db migrate -m "add post view_count and post_likes table"
  ```

  생성된 파일의 `upgrade()` 확인:
  - `posts` 테이블에 `view_count INTEGER NOT NULL DEFAULT 0` 컬럼 추가
  - `post_likes` 테이블 생성 (id, post_id FK CASCADE, user_id FK CASCADE, created_at, UNIQUE(post_id, user_id))

- [ ] **Step 4: 마이그레이션 적용 확인**

  ```bash
  docker compose restart backend && sleep 5
  docker compose logs backend --tail=10
  # "Running upgrade ... add post view_count and post_likes table" 확인
  ```

- [ ] **Step 5: 커밋**

  ```bash
  git add backend/models/schema.py backend/migrations/
  git commit -m "feat: Post.view_count 추가, PostLike 모델 및 post_likes 테이블 신규"
  ```

---

### Task 2: `list_posts` — 집계 쿼리로 교체

**Files:**
- Modify: `backend/api/posts.py`

- [ ] **Step 1: import 추가**

  `posts.py` 상단 import를 아래로 교체:
  ```python
  from flask import Blueprint, request, jsonify
  from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
  from sqlalchemy import select, func
  from sqlalchemy.exc import IntegrityError
  from api.decorators import roles_required
  from models.schema import Post, User, Comment, PostLike
  from database import db
  ```

- [ ] **Step 2: `list_posts` 함수 전체 교체**

  기존 `list_posts` (lines 11-17) 전체를 아래로 교체:

  ```python
  @posts_bp.route("", methods=["GET"])
  def list_posts() -> tuple:
      """공개된 포스트 목록 조회 (작성자·조회수·댓글수·추천수 포함)."""
      # JWT optional — 로그인 시 user_liked 계산
      try:
          verify_jwt_in_request(optional=True)
          raw_id = get_jwt_identity()
          current_user_id = int(raw_id) if raw_id else None
      except Exception:
          current_user_id = None

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

      rows = db.session.execute(
          select(Post, User.username.label("author_username"), comment_sq.label("comment_count"), like_sq.label("like_count"))
          .outerjoin(User, Post.author_id == User.id)
          .where(Post.status == "published")
          .order_by(Post.created_at.desc())
      ).all()

      # 로그인 사용자의 추천 포스트 ID 집합 (쿼리 1회로 처리)
      liked_post_ids: set = set()
      if current_user_id:
          liked_post_ids = set(
              db.session.execute(
                  select(PostLike.post_id).where(PostLike.user_id == current_user_id)
              ).scalars().all()
          )

      data = []
      for post, author_username, comment_count, like_count in rows:
          d = post.to_dict()
          d["author_username"] = author_username or "알 수 없음"
          d["comment_count"] = comment_count or 0
          d["like_count"] = like_count or 0
          d["user_liked"] = post.id in liked_post_ids
          data.append(d)

      return jsonify({"success": True, "data": data, "error": ""}), 200
  ```

- [ ] **Step 3: 동작 확인**

  ```bash
  curl -s http://localhost:5000/api/posts | python3 -m json.tool | head -40
  # 기대: author_username, comment_count, like_count, user_liked 필드 포함
  ```

- [ ] **Step 4: 커밋**

  ```bash
  git add backend/api/posts.py
  git commit -m "feat: list_posts 집계 쿼리 (작성자·댓글수·추천수·user_liked)"
  ```

---

### Task 3: `get_post` — view_count +1 + 집계

**Files:**
- Modify: `backend/api/posts.py`

- [ ] **Step 1: `get_post` 함수 전체 교체**

  기존 `get_post` (lines 36-41) 전체를 아래로 교체:

  ```python
  @posts_bp.route("/<int:post_id>", methods=["GET"])
  def get_post(post_id: int) -> tuple:
      """포스트 단건 조회 — 상세 페이지 진입 시 view_count +1 (집계 포함).

      ?skip_count=1 파라미터 시 view_count 증가 생략 (편집 페이지 전용).
      """
      skip_count: bool = bool(request.args.get("skip_count"))

      # JWT optional
      try:
          verify_jwt_in_request(optional=True)
          raw_id = get_jwt_identity()
          current_user_id = int(raw_id) if raw_id else None
      except Exception:
          current_user_id = None

      post: Post | None = db.session.get(Post, post_id)
      if not post:
          return jsonify({"success": False, "data": {}, "error": "Not found"}), 404

      # view_count +1 (편집 페이지는 제외)
      if not skip_count:
          post.view_count += 1
          db.session.flush()

      # 집계 (같은 트랜잭션)
      comment_count: int = db.session.execute(
          select(func.count(Comment.id))
          .where(Comment.post_id == post_id)
          .where(Comment.status == "approved")
      ).scalar() or 0

      like_count: int = db.session.execute(
          select(func.count(PostLike.id)).where(PostLike.post_id == post_id)
      ).scalar() or 0

      user_liked: bool = False
      if current_user_id:
          user_liked = bool(
              db.session.execute(
                  select(func.count(PostLike.id))
                  .where(PostLike.post_id == post_id)
                  .where(PostLike.user_id == current_user_id)
              ).scalar()
          )

      # author_username
      author_username: str = "알 수 없음"
      if post.author_id:
          author: User | None = db.session.get(User, post.author_id)
          if author:
              author_username = author.username

      # skip_count=False일 때만 commit (view_count +1 반영)
      if not skip_count:
          db.session.commit()

      d = post.to_dict()
      d["author_username"] = author_username
      d["comment_count"] = comment_count
      d["like_count"] = like_count
      d["user_liked"] = user_liked
      return jsonify({"success": True, "data": d, "error": ""}), 200
  ```

- [ ] **Step 2: 동작 확인**

  ```bash
  # 포스트 ID 1 조회 (2번 반복해서 view_count 증가 확인)
  curl -s http://localhost:5000/api/posts/1 | python3 -m json.tool
  curl -s http://localhost:5000/api/posts/1 | python3 -c "import sys,json; d=json.load(sys.stdin); print('view_count:', d['data']['view_count'])"
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git add backend/api/posts.py
  git commit -m "feat: get_post view_count +1 및 집계 (단일 트랜잭션)"
  ```

---

### Task 4: `POST /api/posts/<id>/like` — 추천 토글

**Files:**
- Modify: `backend/api/posts.py`

- [ ] **Step 1: `like_post` 엔드포인트 추가**

  `delete_post` 함수 아래에 추가:

  ```python
  @posts_bp.route("/<int:post_id>/like", methods=["POST"])
  @roles_required("editor", "admin")
  def like_post(post_id: int) -> tuple:
      """추천 토글 — 로그인 사용자만, 본인 글 불가."""
      current_user_id: int = int(get_jwt_identity())

      post: Post | None = db.session.get(Post, post_id)
      if not post:
          return jsonify({"success": False, "data": {}, "error": "Not found"}), 404

      # 본인 글 추천 불가
      if post.author_id == current_user_id:
          return jsonify({"success": False, "data": {}, "error": "본인 글은 추천할 수 없습니다."}), 400

      existing: PostLike | None = db.session.execute(
          select(PostLike)
          .where(PostLike.post_id == post_id)
          .where(PostLike.user_id == current_user_id)
      ).scalar_one_or_none()

      if existing:
          db.session.delete(existing)
          liked = False
      else:
          db.session.add(PostLike(post_id=post_id, user_id=current_user_id))
          liked = True

      try:
          db.session.commit()
      except IntegrityError:
          # race condition: UniqueConstraint 위반 → 이미 추천됨
          db.session.rollback()
          liked = True

      like_count: int = db.session.execute(
          select(func.count(PostLike.id)).where(PostLike.post_id == post_id)
      ).scalar() or 0

      return jsonify({"success": True, "data": {"liked": liked, "like_count": like_count}, "error": ""}), 200
  ```

- [ ] **Step 2: 동작 확인**

  ```bash
  # editor/admin 토큰 취득
  TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"YOUR_EDITOR","password":"YOUR_PW"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

  # 추천 → liked:true
  curl -s -X POST http://localhost:5000/api/posts/1/like \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

  # 다시 누르면 취소 → liked:false
  curl -s -X POST http://localhost:5000/api/posts/1/like \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

  # 본인 글 추천 → 400 확인
  # (작성자 계정으로 본인 글 id 사용)
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git add backend/api/posts.py
  git commit -m "feat: POST /api/posts/<id>/like 추천 토글 엔드포인트"
  ```

---

## Chunk 2: 프론트엔드

### Task 5: `frontend/src/api/posts.js` 수정

**Files:**
- Modify: `frontend/src/api/posts.js`

- [ ] **Step 1: `listPosts`, `getPost` token optional 처리 + `likePost` 추가**

  기존 `listPosts`와 `getPost`를 교체하고 `likePost` 추가:

  ```js
  // listPosts: token이 있으면 Authorization 헤더 포함 (user_liked 반영)
  export const listPosts = async (token) => {
    try {
      const headers = token ? authHeader(token) : {};
      const response = await axios.get(BASE_URL, { headers });
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to fetch posts.' };
    }
  };

  // getPost: token optional (user_liked 반영), skipCount=true 시 view_count 미증가 (편집 페이지용)
  export const getPost = async (id, token, skipCount = false) => {
    try {
      const headers = token ? authHeader(token) : {};
      const params = skipCount ? { skip_count: 1 } : {};
      const response = await axios.get(`${BASE_URL}/${id}`, { headers, params });
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to fetch post.' };
    }
  };

  // likePost: POST /api/posts/:id/like
  export const likePost = async (token, id) => {
    try {
      const response = await axios.post(`${BASE_URL}/${id}/like`, {}, { headers: authHeader(token) });
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to like post.' };
    }
  };
  ```

  > `createPost`, `updatePost`, `deletePost`, `getMyPosts`는 변경 없음.

- [ ] **Step 1-2: `PostEditor.jsx`의 `getPost` 호출에 skipCount 추가**

  파일: `frontend/src/pages/PostEditor.jsx` (line 54)

  기존:
  ```js
  getPost(id).then((res) => {
  ```
  교체:
  ```js
  getPost(id, token, true).then((res) => {   // skipCount=true → view_count 미증가
  ```

- [ ] **Step 2: 커밋**

  ```bash
  git add frontend/src/api/posts.js
  git commit -m "feat: posts.js listPosts/getPost token optional, likePost 추가"
  ```

---

### Task 6: `PostList.jsx` — 메타 정보 추가

**Files:**
- Modify: `frontend/src/pages/PostList.jsx`

- [ ] **Step 1: `listPosts` 호출에 token 전달**

  현재 (line 20):
  ```js
  listPosts().then((res) => {
  ```
  아래로 교체:
  ```js
  const token = localStorage.getItem('token');
  listPosts(token).then((res) => {
  ```
  > `token` 변수를 `useEffect` 내부에 선언하거나 컴포넌트 상단에서 읽어도 됨.

- [ ] **Step 2: 포스트 아이템에 메타 한 줄 추가**

  기존 포스트 아이템 (lines 56-74):
  ```jsx
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
    <div className="post-meta">
      {post.created_at
        ? new Date(post.created_at).toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric',
          })
        : ''}
    </div>
  </li>
  ```

  아래로 교체:
  ```jsx
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
      {post.author_username && <span>{post.author_username}</span>}
      {post.author_username && <span>·</span>}
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
  ```

- [ ] **Step 3: 브라우저 확인**

  `http://localhost:5173/posts` 접속 → 각 포스트 아이템에 `작성자 · 날짜 · 👁 N · 💬 N · ♥ N` 표시 확인.

- [ ] **Step 4: 커밋**

  ```bash
  git add frontend/src/pages/PostList.jsx
  git commit -m "feat: PostList 메타 정보 추가 (작성자·조회수·댓글수·추천수)"
  ```

---

### Task 7: `PostDetail.jsx` — 추천 버튼 + 통계 표시

**Files:**
- Modify: `frontend/src/pages/PostDetail.jsx`

- [ ] **Step 1: import 추가**

  기존:
  ```js
  import { getPost, listPosts } from '../api/posts';
  ```
  교체:
  ```js
  import { getPost, listPosts, likePost } from '../api/posts';
  ```

- [ ] **Step 2: state 추가 및 데이터 로드 수정**

  컴포넌트 상단 state에 추가:
  ```js
  const token = localStorage.getItem('token');
  const [likeCount, setLikeCount] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  ```

  `useEffect` 내 `getPost(id)` 호출을 `getPost(id, token)`으로 변경:
  ```js
  const [postRes, listRes] = await Promise.all([
    getPost(id, token),   // ← token 추가
    listPosts(token),     // ← token 추가
  ]);
  ```

  `setPost(postRes.data)` 아래에 추가:
  ```js
  setLikeCount(postRes.data.like_count ?? 0);
  setUserLiked(postRes.data.user_liked ?? false);
  ```

- [ ] **Step 3: 추천 핸들러 추가**

  `handleCancel` 또는 `handleDelete`류 함수 위치에 추가:
  ```js
  const handleLike = async () => {
    if (!token || !user) return;
    setLiking(true);
    const res = await likePost(token, post.id);
    setLiking(false);
    if (res.success) {
      setLikeCount(res.data.like_count);
      setUserLiked(res.data.liked);
    }
  };
  ```

- [ ] **Step 4: 메타 영역 교체**

  기존 메타 영역 (lines 111-118):
  ```jsx
  {/* 메타 — API가 author_id(숫자)만 반환하고 이름 없음, 작성자 표시 생략 */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-light)' }}>
    {dateStr && <span>{dateStr}</span>}
    {dateStr && <span>·</span>}
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...badge.style }}>
      {badge.label}
    </span>
  </div>
  ```

  아래로 교체:
  ```jsx
  {/* 메타 */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-light)', flexWrap: 'wrap' }}>
    {post.author_username && <span>{post.author_username}</span>}
    {post.author_username && dateStr && <span>·</span>}
    {dateStr && <span>{dateStr}</span>}
    {dateStr && <span>·</span>}
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...badge.style }}>
      {badge.label}
    </span>
    <span>·</span>
    <span>👁 {post.view_count ?? 0}</span>

    {/* 추천 버튼 */}
    <button
      onClick={handleLike}
      disabled={
        liking ||
        !token ||
        !user ||
        post.author_id === user?.id
      }
      title={
        !token || !user
          ? '로그인 후 추천할 수 있습니다'
          : post.author_id === user?.id
          ? '본인 글은 추천할 수 없습니다'
          : userLiked
          ? '추천 취소'
          : '추천'
      }
      style={{
        marginLeft: 4,
        padding: '2px 10px',
        borderRadius: 99,
        border: '1px solid var(--border)',
        background: userLiked ? 'var(--accent-bg)' : 'transparent',
        color: userLiked ? 'var(--accent-text)' : 'var(--text-light)',
        cursor: (!token || !user || post.author_id === user?.id) ? 'default' : 'pointer',
        fontSize: 12,
        fontWeight: 500,
        transition: 'all 0.15s',
      }}
    >
      ♥ {likeCount}
    </button>
  </div>
  ```

- [ ] **Step 5: 브라우저 확인**

  1. `/posts/<id>` 접속 → 작성자명, 조회수 표시 확인
  2. 재방문 시 조회수 +1 확인
  3. 로그인 후 ♥ 버튼 클릭 → 색상 변경 + 숫자 증가
  4. 다시 클릭 → 취소, 숫자 감소
  5. 본인 글: ♥ 버튼 비활성화 확인
  6. 비로그인: ♥ 버튼 비활성화 + tooltip 확인

- [ ] **Step 6: 커밋**

  ```bash
  git add frontend/src/pages/PostDetail.jsx
  git commit -m "feat: PostDetail 추천 버튼 + 작성자·조회수 표시"
  ```

---

## 최종 검증

- [ ] **PostList 전체 시나리오**

  1. `/posts` 접속 (비로그인) → 작성자·날짜·👁·💬·♥ 표시, `user_liked` 필드는 있지만 UI 미사용
  2. 로그인 후 `/posts` → 내가 추천한 글이 있으면 서버에서 `user_liked: true` 반환 확인 (curl)

- [ ] **PostDetail 전체 시나리오**

  1. 여러 번 방문해서 view_count 증가 확인
  2. 비로그인 → ♥ 버튼 비활성화
  3. 로그인(editor) → 타인 글 추천/취소 토글
  4. 로그인 → 본인 글 ♥ 버튼 disabled

- [ ] **최종 커밋**

  ```bash
  git add -A
  git commit -m "feat: 포스트 통계·추천 기능 구현 완료"
  ```
