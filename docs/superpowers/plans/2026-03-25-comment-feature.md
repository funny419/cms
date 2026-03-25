# 댓글 기능 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포스트 상세 페이지에 로그인 사용자 댓글/답글 기능을 추가하고, Admin 대시보드에서 댓글을 관리할 수 있게 한다.

**Architecture:** 백엔드 `comments.py`를 수정하여 `@roles_required("editor","admin")` 인증 및 cascade 삭제를 적용하고, `admin.py`에 전체 댓글 조회 엔드포인트와 회원 삭제 시 댓글 orphan 처리를 추가한다. 프론트엔드는 독립 `CommentSection.jsx` 컴포넌트를 신규 생성하여 `PostDetail.jsx`에 삽입하고, Admin용 `AdminComments.jsx` 페이지를 추가한다.

**Tech Stack:** Python 3.11 + Flask + SQLAlchemy 2.x, React 19 + axios, Docker Compose (dev 환경)

**Spec:** `docs/superpowers/specs/2026-03-25-comment-feature-design.md`

---

## 변경 파일 목록

| 파일 | 유형 | 역할 |
|------|------|------|
| `backend/api/comments.py` | 수정 | create_comment 인증 강화 + cascade 삭제 |
| `backend/api/admin.py` | 수정 | admin_list_comments 엔드포인트 추가 + admin_delete_user Comment orphan 처리 |
| `frontend/src/api/comments.js` | 신규 | 댓글 관련 axios 클라이언트 (4개 함수) |
| `frontend/src/components/CommentSection.jsx` | 신규 | 댓글 목록 + 작성 폼 + 답글 UI |
| `frontend/src/pages/PostDetail.jsx` | 수정 | CommentSection 삽입 |
| `frontend/src/pages/admin/AdminComments.jsx` | 신규 | Admin 댓글 관리 페이지 |
| `frontend/src/components/Nav.jsx` | 수정 | admin 링크에 "댓글 관리" 추가 |
| `frontend/src/App.jsx` | 수정 | `/admin/comments` 라우트 등록 |

---

## Chunk 1: 백엔드 댓글 API 수정

### Task 1: `create_comment` 인증 강화

**Files:**
- Modify: `backend/api/comments.py`

- [ ] **Step 1: `create_comment` 함수 상단 교체**

  기존 코드 (lines 18-52):
  ```python
  @comments_bp.route("", methods=["POST"])
  def create_comment() -> tuple:
      """댓글 작성 — 로그인 불필요 (게스트 작성 가능)."""
      data: dict = request.get_json() or {}
      if not data.get("post_id") or not data.get("content"):
          return jsonify({"success": False, "data": {}, "error": "post_id and content are required"}), 400
      if not data.get("author_name"):
          return jsonify({"success": False, "data": {}, "error": "author_name is required"}), 400

      content: str = data["content"]
      status = "spam" if _is_spam(content) else "pending"

      try:
          verify_jwt_in_request(optional=True)
          raw_id = get_jwt_identity()
          author_id = int(raw_id) if raw_id else None
      except Exception:
          author_id = None

      comment = Comment(
          post_id=data["post_id"],
          author_id=author_id,
          parent_id=data.get("parent_id"),
          author_name=data["author_name"],
          author_email=data.get("author_email", ""),
          content=content,
          status=status,
      )
  ```

  교체 후 코드:
  ```python
  @comments_bp.route("", methods=["POST"])
  @roles_required("editor", "admin")
  def create_comment() -> tuple:
      """댓글 작성 — editor/admin 로그인 필수."""
      data: dict = request.get_json() or {}
      post_id = data.get("post_id")
      content: str = data.get("content", "").strip()

      if not post_id or not content:
          return jsonify({"success": False, "data": {}, "error": "post_id and content are required"}), 400
      if len(content) > 2000:
          return jsonify({"success": False, "data": {}, "error": "댓글은 2000자 이하여야 합니다."}), 400

      # JWT에서 작성자 정보 조회 (roles_required가 이미 검증함)
      author_id: int = int(get_jwt_identity())
      user: User | None = db.session.get(User, author_id)

      # parent_id 유효성 검사
      parent_id = data.get("parent_id")
      if parent_id:
          parent: Comment | None = db.session.get(Comment, parent_id)
          if not parent:
              return jsonify({"success": False, "data": {}, "error": "부모 댓글을 찾을 수 없습니다."}), 404
          if parent.post_id != post_id:
              return jsonify({"success": False, "data": {}, "error": "잘못된 parent_id입니다."}), 400
          if parent.parent_id is not None:
              return jsonify({"success": False, "data": {}, "error": "답글에는 답글을 달 수 없습니다."}), 400

      # roles_required가 이미 user 존재를 검증했으므로 user는 None이 아님
      comment = Comment(
          post_id=post_id,
          author_id=author_id,
          parent_id=parent_id,
          author_name=user.username,
          author_email="",
          content=content,
          status="approved",
      )
  ```

- [ ] **Step 2: import에 `User` 추가**

  `comments.py` 상단 import를 아래와 같이 수정:
  ```python
  from models.schema import Comment, User
  ```

  또한 `verify_jwt_in_request` import 제거, `get_jwt_identity` import 유지:
  ```python
  from flask_jwt_extended import get_jwt_identity
  ```

- [ ] **Step 3: 동작 확인 (curl)**

  ```bash
  # 비로그인 요청 → 401 확인
  curl -s -X POST http://localhost:5000/api/comments \
    -H "Content-Type: application/json" \
    -d '{"post_id":1,"content":"테스트"}' | python3 -m json.tool

  # editor 로그인 후 토큰 취득
  TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"YOUR_EDITOR","password":"YOUR_PW"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

  # 정상 댓글 작성 → 201, status="approved" 확인
  curl -s -X POST http://localhost:5000/api/comments \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"post_id":1,"content":"안녕하세요"}' | python3 -m json.tool
  ```

  기대값: `"status": "approved"`, `"author_name"` 이 로그인 유저의 username

- [ ] **Step 4: 커밋**

  ```bash
  git add backend/api/comments.py
  git commit -m "feat: create_comment에 roles_required 적용 및 auto-approve"
  ```

---

### Task 2: `delete_comment` cascade 삭제

**Files:**
- Modify: `backend/api/comments.py`

- [ ] **Step 1: `delete_comment` cascade 로직 추가**

  기존 `delete_comment` (lines 83-96):
  ```python
  @comments_bp.route("/<int:comment_id>", methods=["DELETE"])
  @roles_required("admin")
  def delete_comment(comment_id: int) -> tuple:
      """관리자 전용 — 댓글 삭제."""
      comment: Comment | None = db.session.get(Comment, comment_id)
      if not comment:
          return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
      db.session.delete(comment)
  ```

  `db.session.delete(comment)` 한 줄 앞에 답글 삭제 로직 삽입
  (`from sqlalchemy import select`는 파일 상단에 이미 존재):
  ```python
  @comments_bp.route("/<int:comment_id>", methods=["DELETE"])
  @roles_required("admin")
  def delete_comment(comment_id: int) -> tuple:
      """관리자 전용 — 댓글 삭제 (답글 cascade 포함)."""
      comment: Comment | None = db.session.get(Comment, comment_id)
      if not comment:
          return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
      # 답글(children) 먼저 삭제
      replies = db.session.execute(
          select(Comment).where(Comment.parent_id == comment_id)
      ).scalars().all()
      for reply in replies:
          db.session.delete(reply)
      db.session.delete(comment)
  ```

- [ ] **Step 2: 커밋**

  ```bash
  git add backend/api/comments.py
  git commit -m "feat: delete_comment cascade 삭제 (답글 포함)"
  ```

---

### Task 3: `admin.py`에 댓글 목록 엔드포인트 + Comment orphan 처리 추가

**Files:**
- Modify: `backend/api/admin.py`

- [ ] **Step 1: import 수정**

  `admin.py` 상단 import를 아래와 같이 수정
  (`from sqlalchemy import select, update`와 `from models.schema import User, Post`는 이미 존재):
  ```python
  from models.schema import User, Post, Comment
  ```

- [ ] **Step 2: `admin_list_comments` 엔드포인트 추가**

  `admin.py` 최하단에 추가 (URL: `GET /api/admin/comments`):
  ```python
  @admin_bp.route("/comments", methods=["GET"])
  @roles_required("admin")
  def admin_list_comments() -> tuple:
      """관리자 전용 — 전체 댓글 목록 (post_title 포함)."""
      status_filter = request.args.get("status")
      query = (
          select(Comment, Post.title.label("post_title"))
          .join(Post, Comment.post_id == Post.id)
          .order_by(Comment.created_at.desc())
      )
      if status_filter:
          query = query.where(Comment.status == status_filter)
      rows = db.session.execute(query).all()
      data = []
      for comment, post_title in rows:
          d = comment.to_dict()
          d["post_title"] = post_title
          data.append(d)
      return jsonify({"success": True, "data": data, "error": ""}), 200
  ```

- [ ] **Step 3: `admin_delete_user`에 Comment NULL 처리 추가**

  기존 코드 (lines 89-92):
  ```python
  db.session.execute(
      update(Post).where(Post.author_id == user_id).values(author_id=None)
  )
  db.session.delete(user)
  ```

  아래와 같이 수정 (`update`는 기존 import에 이미 존재):
  ```python
  db.session.execute(
      update(Post).where(Post.author_id == user_id).values(author_id=None)
  )
  db.session.execute(
      update(Comment).where(Comment.author_id == user_id).values(author_id=None)
  )
  db.session.delete(user)
  ```

- [ ] **Step 4: 동작 확인 (curl)**

  ```bash
  # admin 토큰 취득
  ADMIN_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"YOUR_ADMIN","password":"YOUR_PW"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

  # 전체 댓글 목록 조회 → post_title 포함 확인 (URL: /api/admin/comments)
  curl -s http://localhost:5000/api/admin/comments \
    -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
  ```

- [ ] **Step 5: 커밋**

  ```bash
  git add backend/api/admin.py
  git commit -m "feat: admin_list_comments 엔드포인트 추가 + admin_delete_user Comment orphan 처리"
  ```

---

## Chunk 2: 프론트엔드 댓글 API 클라이언트 & CommentSection 컴포넌트

### Task 4: `frontend/src/api/comments.js` 생성

**Files:**
- Create: `frontend/src/api/comments.js`

- [ ] **Step 1: 파일 생성**

  ```js
  // frontend/src/api/comments.js
  import axios from 'axios';

  const BASE_URL = '/api/comments';
  const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

  export const listComments = async (postId) => {
    try {
      const response = await axios.get(`${BASE_URL}/post/${postId}`);
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || '댓글을 불러오지 못했습니다.' };
    }
  };

  export const createComment = async (token, postId, content, parentId = null) => {
    try {
      const body = { post_id: postId, content };
      if (parentId) body.parent_id = parentId;
      const response = await axios.post(BASE_URL, body, { headers: authHeader(token) });
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || '댓글 작성에 실패했습니다.' };
    }
  };

  export const deleteComment = async (token, commentId) => {
    try {
      const response = await axios.delete(`${BASE_URL}/${commentId}`, { headers: authHeader(token) });
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || '삭제에 실패했습니다.' };
    }
  };

  export const listAllComments = async (token, status = '') => {
    try {
      const params = status ? { status } : {};
      const response = await axios.get('/api/admin/comments', {
        headers: authHeader(token),
        params,
      });
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || '댓글 목록을 불러오지 못했습니다.' };
    }
  };
  ```

- [ ] **Step 2: 커밋**

  ```bash
  git add frontend/src/api/comments.js
  git commit -m "feat: 댓글 API 클라이언트 (comments.js) 추가"
  ```

---

### Task 5: `CommentSection.jsx` 컴포넌트 생성

**Files:**
- Create: `frontend/src/components/CommentSection.jsx`

- [ ] **Step 1: 파일 생성**

  ```jsx
  // frontend/src/components/CommentSection.jsx
  import { useEffect, useState } from 'react';
  import { Link } from 'react-router-dom';
  import { listComments, createComment } from '../api/comments';

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  function CommentForm({ token, postId, parentId = null, onSuccess, onCancel }) {
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!content.trim()) return;
      setSubmitting(true);
      setError('');
      const res = await createComment(token, postId, content.trim(), parentId);
      setSubmitting(false);
      if (res.success) {
        setContent('');
        onSuccess();
      } else {
        setError(res.error);
      }
    };

    return (
      <form onSubmit={handleSubmit} style={{ marginTop: 8 }}>
        <textarea
          className="form-input"
          rows={3}
          placeholder={parentId ? '답글을 입력하세요...' : '댓글을 입력하세요...'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 4 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting || !content.trim()}>
            {submitting ? '등록 중...' : '등록'}
          </button>
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              취소
            </button>
          )}
        </div>
      </form>
    );
  }

  function CommentItem({ comment, replies, token, postId, onRefresh, isLoggedIn }) {
    const [showReplyForm, setShowReplyForm] = useState(false);

    return (
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
        {/* 루트 댓글 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-h)' }}>
              {comment.author_name}
            </span>
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-light)' }}>
              {formatDate(comment.created_at)}
            </span>
            <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.7, color: 'var(--text-h)', whiteSpace: 'pre-wrap' }}>
              {comment.content}
            </p>
          </div>
        </div>

        {/* 답글 달기 버튼 (루트 댓글에만, 로그인 시) */}
        {isLoggedIn && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, marginTop: 4, padding: '2px 8px' }}
            onClick={() => setShowReplyForm((v) => !v)}
          >
            {showReplyForm ? '취소' : '답글 달기'}
          </button>
        )}

        {/* 답글 작성 폼 */}
        {showReplyForm && (
          <div style={{ marginLeft: 24, marginTop: 8 }}>
            <CommentForm
              token={token}
              postId={postId}
              parentId={comment.id}
              onSuccess={() => { setShowReplyForm(false); onRefresh(); }}
              onCancel={() => setShowReplyForm(false)}
            />
          </div>
        )}

        {/* 답글 목록 */}
        {replies.length > 0 && (
          <div style={{ marginLeft: 24, marginTop: 12 }}>
            {replies.map((reply) => (
              <div key={reply.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 12, marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-h)' }}>
                  {reply.author_name}
                </span>
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-light)' }}>
                  {formatDate(reply.created_at)}
                </span>
                <p style={{ marginTop: 4, fontSize: 13, lineHeight: 1.7, color: 'var(--text-h)', whiteSpace: 'pre-wrap' }}>
                  {reply.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  export default function CommentSection({ postId, user }) {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('token');
    const isLoggedIn = !!token && !!user;

    // useEffect 내부에 load 선언 — ESLint exhaustive-deps 경고 방지, PostDetail.jsx 패턴과 일치
    useEffect(() => {
      const load = async () => {
        setLoading(true);
        const res = await listComments(postId);
        if (res.success) setComments(res.data);
        setLoading(false);
      };
      load();
    }, [postId]);

    // onSuccess/onRefresh 콜백용 (loading spinner 없이 조용히 재조회)
    const loadComments = async () => {
      const res = await listComments(postId);
      if (res.success) setComments(res.data);
    };

    // flat list → 계층 구조: 루트 댓글 + 각 댓글의 답글
    const rootComments = comments.filter((c) => c.parent_id === null);
    const repliesOf = (commentId) => comments.filter((c) => c.parent_id === commentId);

    return (
      <div style={{ marginTop: 48 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-h)', marginBottom: 20 }}>
          댓글 {comments.length > 0 ? `${comments.length}개` : ''}
        </h3>

        {/* 댓글 작성 폼 */}
        {isLoggedIn ? (
          <div style={{ marginBottom: 32 }}>
            <CommentForm token={token} postId={postId} onSuccess={loadComments} />
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 24 }}>
            댓글을 작성하려면 <Link to="/login" style={{ color: 'var(--accent)' }}>로그인</Link>하세요.
          </p>
        )}

        {/* 댓글 목록 */}
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-light)' }}>댓글 불러오는 중...</p>
        ) : rootComments.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-light)' }}>첫 댓글을 남겨보세요.</p>
        ) : (
          rootComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={repliesOf(comment.id)}
              token={token}
              postId={postId}
              onRefresh={loadComments}
              isLoggedIn={isLoggedIn}
            />
          ))
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: 커밋**

  ```bash
  git add frontend/src/components/CommentSection.jsx
  git commit -m "feat: CommentSection 컴포넌트 추가 (댓글 + 답글 UI)"
  ```

---

### Task 6: `PostDetail.jsx`에 CommentSection 삽입

**Files:**
- Modify: `frontend/src/pages/PostDetail.jsx`

- [ ] **Step 1: import 추가**

  `PostDetail.jsx` 상단에 추가:
  ```js
  import CommentSection from '../components/CommentSection';
  ```

- [ ] **Step 2: 본문 아래 CommentSection 삽입**

  `PostDetail.jsx`의 이전/다음 내비게이션 블록(`{(prev || next) && ...}`) 바로 위에 삽입:

  ```jsx
  {/* 댓글 */}
  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0 0' }} />
  <CommentSection postId={post.id} user={user} />
  ```

  기존 이전/다음 블록 앞에 위치해야 하므로, 파일 구조는:
  ```
  ...본문 렌더링...
  <hr /> (댓글 구분선)
  <CommentSection .../>
  {(prev || next) && (
    <>
      <hr />  ← 기존 이전/다음 구분선
      ...이전/다음 버튼...
    </>
  )}
  ```

- [ ] **Step 3: 브라우저에서 확인**

  1. `http://localhost:5173/posts/<id>` 접속
  2. 비로그인 상태: "댓글을 작성하려면 로그인하세요" 표시 확인
  3. editor/admin 로그인 후: 댓글 작성 폼 표시, 댓글 작성 후 목록 즉시 갱신 확인
  4. 댓글 하단 [답글 달기] 버튼 → 인라인 폼 표시, 답글 작성 후 들여쓰기 표시 확인

- [ ] **Step 4: 커밋**

  ```bash
  git add frontend/src/pages/PostDetail.jsx
  git commit -m "feat: PostDetail에 CommentSection 삽입"
  ```

---

## Chunk 3: Admin 댓글 관리 페이지 및 라우팅

### Task 7: `AdminComments.jsx` 생성

**Files:**
- Create: `frontend/src/pages/admin/AdminComments.jsx`

- [ ] **Step 1: 파일 생성**

  ```jsx
  // frontend/src/pages/admin/AdminComments.jsx
  import { useEffect, useState } from 'react';
  import { useNavigate, Link } from 'react-router-dom';
  import { listAllComments, deleteComment } from '../../api/comments';
  // listAllComments: GET /api/admin/comments (재조회에도 사용)

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  export default function AdminComments() {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
      if (!token) { navigate('/login'); return; }
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user?.role !== 'admin') { navigate('/my-posts'); return; }
      } catch { navigate('/login'); return; }

      listAllComments(token).then((res) => {
        if (res.success) setComments(res.data);
        else setError(res.error);
        setLoading(false);
      });
    }, []);

    const handleDelete = async (commentId) => {
      if (!window.confirm('이 댓글을 삭제할까요? 답글도 함께 삭제됩니다.')) return;
      const res = await deleteComment(token, commentId);
      if (res.success) {
        // 백엔드 cascade 삭제 완료 후 목록 재조회 (답글 포함 정확히 반영)
        const fresh = await listAllComments(token);
        if (fresh.success) setComments(fresh.data);
      } else {
        alert(res.error);
      }
    };

    if (loading) return <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>;

    return (
      <div className="page-content" style={{ maxWidth: 960 }}>
        <h1 className="page-heading" style={{ marginBottom: 24 }}>댓글 관리</h1>

        {error && <div className="alert alert-error">{error}</div>}

        {comments.length === 0 ? (
          <div className="empty-state"><p>등록된 댓글이 없습니다.</p></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                {['포스트', '작성자', '내용', '작성일', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comments.map((comment) => (
                <tr
                  key={comment.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <td style={{ padding: '10px 12px', color: 'var(--text-light)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Link to={`/posts/${comment.post_id}`} style={{ color: 'var(--accent)' }}>
                      {comment.post_title || `#${comment.post_id}`}
                    </Link>
                    {comment.parent_id && (
                      <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-light)' }}>(답글)</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{comment.author_name}</td>
                  <td style={{ padding: '10px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {comment.content.slice(0, 60)}{comment.content.length > 60 ? '...' : ''}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                    {formatDate(comment.created_at)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={() => handleDelete(comment.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: 커밋**

  ```bash
  git add frontend/src/pages/admin/AdminComments.jsx
  git commit -m "feat: AdminComments 페이지 추가 (전체 댓글 관리)"
  ```

---

### Task 8: `Nav.jsx`와 `App.jsx` 라우팅 연결

**Files:**
- Modify: `frontend/src/components/Nav.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: `Nav.jsx` admin 링크에 "댓글 관리" 추가**

  `Nav.jsx`의 admin 로그인 블록 (lines 32-39) 전체를 아래로 교체:
  ```jsx
  <>
    <Link to="/admin/posts" className="nav-link">포스트 관리</Link>
    <Link to="/admin/users" className="nav-link">회원 관리</Link>
    <Link to="/admin/comments" className="nav-link">댓글 관리</Link>
    <button onClick={handleLogout} className="nav-link" style={{ border: 'none', cursor: 'pointer', background: 'none', color: 'var(--danger)' }}>
      로그아웃
    </button>
  </>
  ```

- [ ] **Step 2: `App.jsx` 라우트 등록**

  `App.jsx` 상단 import에 추가:
  ```js
  import AdminComments from './pages/admin/AdminComments';
  ```

  Routes 내부 `AdminUsers` 라우트 아래에 추가:
  ```jsx
  <Route path="/admin/comments" element={<AdminComments />} />
  ```

- [ ] **Step 3: 브라우저에서 확인**

  1. admin 로그인 후 Nav에 "댓글 관리" 링크 표시 확인
  2. `/admin/comments` 접속 → 댓글 목록 표시 확인
  3. 삭제 버튼 클릭 → confirm 후 목록에서 즉시 제거 확인
  4. 부모 댓글 삭제 시 프론트엔드에서 답글도 제거되는지 확인 (`parent_id` 필터링)

- [ ] **Step 4: 커밋**

  ```bash
  git add frontend/src/components/Nav.jsx frontend/src/App.jsx
  git commit -m "feat: /admin/comments 라우트 및 Nav 링크 추가"
  ```

---

## 최종 검증

- [ ] **전체 시나리오 테스트**

  1. **editor 댓글 작성:** editor 로그인 → `/posts/<id>` → 댓글 작성 → 즉시 표시 확인
  2. **답글 작성:** 댓글 [답글 달기] 클릭 → 답글 작성 → 들여쓰기 표시 확인
  3. **2단 답글 차단:** curl로 답글의 id를 parent_id로 요청 → 400 응답 확인
  4. **deactivated 차단:** deactivated 계정 토큰으로 댓글 작성 → 403 확인
  5. **Admin 댓글 관리:** admin 로그인 → `/admin/comments` → 목록 조회 → 삭제 확인

- [ ] **최종 커밋 (완료 표시)**

  ```bash
  git add -A
  git commit -m "feat: 댓글 기능 전체 구현 완료 (PostDetail + Admin 관리)"
  ```
