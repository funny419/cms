# 댓글 기능 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포스트 상세 페이지에 로그인/게스트 댓글 작성 + 본인 댓글 수정/삭제 기능을 추가하고, Admin 대시보드에서 전체 댓글을 관리할 수 있게 한다.

**Architecture:** DB에 `author_password_hash` 컬럼을 추가하고(마이그레이션), 백엔드 `comments.py`에 게스트 인증 로직과 PUT(수정) 엔드포인트를 추가한다. `admin.py`에 전체 댓글 조회 엔드포인트를 추가한다. 프론트엔드는 `CommentSection.jsx` 컴포넌트가 로그인/게스트 폼을 분기하고, 본인 댓글에 수정/삭제 버튼을 제공한다.

**Tech Stack:** Python 3.11 + Flask + SQLAlchemy 2.x + Werkzeug, React 19 + axios, Docker Compose (dev 환경)

**Spec:** `docs/superpowers/specs/2026-03-25-comment-feature-design.md`

---

## 변경 파일 목록

| 파일 | 유형 | 역할 |
|------|------|------|
| `backend/models/schema.py` | 수정 | Comment에 `author_password_hash` 컬럼 추가 |
| `backend/migrations/versions/` | 신규 | 마이그레이션 파일 |
| `backend/api/comments.py` | 수정 | 게스트 작성 + PUT 수정 + DELETE 소유권 인증 |
| `backend/api/admin.py` | 수정 | `GET /api/admin/comments` + Comment orphan 처리 |
| `frontend/src/api/comments.js` | 신규 | axios 클라이언트 5개 함수 |
| `frontend/src/components/CommentSection.jsx` | 신규 | 댓글 목록 + 로그인/게스트 폼 + 수정/삭제 |
| `frontend/src/pages/PostDetail.jsx` | 수정 | CommentSection 삽입 |
| `frontend/src/pages/admin/AdminComments.jsx` | 신규 | Admin 댓글 관리 페이지 |
| `frontend/src/components/Nav.jsx` | 수정 | "댓글 관리" 링크 추가 |
| `frontend/src/App.jsx` | 수정 | `/admin/comments` 라우트 등록 |

---

## Chunk 1: DB 스키마 + 백엔드 API

### Task 1: DB 스키마 변경 및 마이그레이션

**Files:**
- Modify: `backend/models/schema.py`
- Create: `backend/migrations/versions/<hash>_add_comment_password_hash.py` (자동 생성)

- [ ] **Step 1: Comment 모델에 `author_password_hash` 컬럼 추가**

  `backend/models/schema.py`의 Comment 클래스에서 `author_email` 필드 아래에 추가:

  기존:
  ```python
  author_name: Mapped[str] = mapped_column(String(100)) # For guests
  author_email: Mapped[str] = mapped_column(String(120))
  content: Mapped[str] = mapped_column(Text, nullable=False)
  ```

  수정:
  ```python
  author_name: Mapped[str] = mapped_column(String(100)) # For guests
  author_email: Mapped[str] = mapped_column(String(120))
  author_password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # 게스트 전용
  content: Mapped[str] = mapped_column(Text, nullable=False)
  ```

- [ ] **Step 2: 마이그레이션 생성 및 적용**

  ```bash
  docker compose exec backend flask db migrate -m "add comment author_password_hash"
  ```

  생성된 마이그레이션 파일(`backend/migrations/versions/<hash>_add_comment_author_password_hash.py`)을 확인하고 `upgrade()`에 아래 내용이 있는지 검증:
  ```python
  batch_op.add_column(sa.Column('author_password_hash', sa.String(255), nullable=True))
  ```

  앱 재시작 시 자동으로 `flask db upgrade` 실행됨. 확인:
  ```bash
  docker compose restart backend
  docker compose logs backend --tail=10
  # "Running upgrade ... -> <hash>" 로그 확인
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git add backend/models/schema.py backend/migrations/
  git commit -m "feat: Comment 모델에 author_password_hash 추가 (게스트 댓글용)"
  ```

---

### Task 2: `create_comment` — 로그인/게스트 분기

**Files:**
- Modify: `backend/api/comments.py`

- [ ] **Step 1: import 정리**

  `comments.py` 상단 import를 아래로 교체:
  ```python
  from flask import Blueprint, request, jsonify
  from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
  from sqlalchemy import select
  from api.decorators import roles_required
  from models.schema import Comment, User
  from database import db
  from werkzeug.security import generate_password_hash, check_password_hash
  ```

- [ ] **Step 2: `create_comment` 함수 전체 교체**

  기존 함수(lines 18-52) 전체를 아래로 교체:

  ```python
  @comments_bp.route("", methods=["POST"])
  def create_comment() -> tuple:
      """댓글 작성 — 로그인 사용자(즉시 공개) 또는 게스트(이름+이메일+패스워드 필수, 승인 대기)."""
      data: dict = request.get_json() or {}
      post_id = data.get("post_id")
      content: str = (data.get("content") or "").strip()

      if not post_id or not content:
          return jsonify({"success": False, "data": {}, "error": "post_id and content are required"}), 400
      if len(content) > 2000:
          return jsonify({"success": False, "data": {}, "error": "댓글은 2000자 이하여야 합니다."}), 400

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

      # JWT 확인 (optional)
      try:
          verify_jwt_in_request(optional=True)
          raw_id = get_jwt_identity()
      except Exception:
          raw_id = None

      if raw_id:
          # 로그인 사용자
          user: User | None = db.session.get(User, int(raw_id))
          if not user or user.role == "deactivated":
              return jsonify({"success": False, "data": {}, "error": "Permission denied"}), 403
          comment = Comment(
              post_id=post_id,
              author_id=user.id,
              parent_id=parent_id,
              author_name=user.username,
              author_email="",
              author_password_hash=None,
              content=content,
              status="approved",
          )
      else:
          # 게스트
          author_name: str = (data.get("author_name") or "").strip()
          author_email: str = (data.get("author_email") or "").strip()
          author_password: str = (data.get("author_password") or "").strip()
          if not author_name or not author_email or not author_password:
              return jsonify({"success": False, "data": {}, "error": "게스트 댓글은 이름, 이메일, 패스워드가 필요합니다."}), 400

          status = "spam" if _is_spam(content) else "pending"
          comment = Comment(
              post_id=post_id,
              author_id=None,
              parent_id=parent_id,
              author_name=author_name,
              author_email=author_email,
              author_password_hash=generate_password_hash(author_password),
              content=content,
              status=status,
          )

      db.session.add(comment)
      try:
          db.session.commit()
      except Exception:
          db.session.rollback()
          return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
      return jsonify({"success": True, "data": comment.to_dict(), "error": ""}), 201
  ```

- [ ] **Step 3: 동작 확인 (curl)**

  ```bash
  # 로그인 후 댓글 작성 → status=approved 확인
  TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"YOUR_EDITOR","password":"YOUR_PW"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

  curl -s -X POST http://localhost:5000/api/comments \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"post_id":1,"content":"로그인 댓글 테스트"}' | python3 -m json.tool
  # 기대: "status": "approved"

  # 게스트 댓글 작성 → status=pending 확인
  curl -s -X POST http://localhost:5000/api/comments \
    -H "Content-Type: application/json" \
    -d '{"post_id":1,"content":"게스트 댓글","author_name":"게스트","author_email":"guest@test.com","author_password":"pass123"}' \
    | python3 -m json.tool
  # 기대: "status": "pending"

  # 게스트 필드 누락 → 400 확인
  curl -s -X POST http://localhost:5000/api/comments \
    -H "Content-Type: application/json" \
    -d '{"post_id":1,"content":"게스트 댓글"}' | python3 -m json.tool
  # 기대: 400, "게스트 댓글은 이름, 이메일, 패스워드가 필요합니다."
  ```

- [ ] **Step 4: 커밋**

  ```bash
  git add backend/api/comments.py
  git commit -m "feat: create_comment 로그인/게스트 분기 처리"
  ```

---

### Task 3: 댓글 수정(PUT) + 삭제(DELETE) 소유권 인증

**Files:**
- Modify: `backend/api/comments.py`

- [ ] **Step 1: `PUT /api/comments/<id>` 엔드포인트 추가**

  `create_comment` 함수 바로 아래에 추가:

  ```python
  @comments_bp.route("/<int:comment_id>", methods=["PUT"])
  def update_comment(comment_id: int) -> tuple:
      """댓글 수정 — 로그인 사용자는 본인 글만, 게스트는 이메일+패스워드 인증."""
      comment: Comment | None = db.session.get(Comment, comment_id)
      if not comment:
          return jsonify({"success": False, "data": {}, "error": "Not found"}), 404

      data: dict = request.get_json() or {}
      content: str = (data.get("content") or "").strip()
      if not content:
          return jsonify({"success": False, "data": {}, "error": "content is required"}), 400
      if len(content) > 2000:
          return jsonify({"success": False, "data": {}, "error": "댓글은 2000자 이하여야 합니다."}), 400

      # 소유권 검증
      try:
          verify_jwt_in_request(optional=True)
          raw_id = get_jwt_identity()
      except Exception:
          raw_id = None

      if raw_id:
          user: User | None = db.session.get(User, int(raw_id))
          if not user or user.role == "deactivated":
              return jsonify({"success": False, "data": {}, "error": "Permission denied"}), 403
          # admin은 모두 수정 가능, editor는 본인 글만
          if user.role != "admin" and comment.author_id != user.id:
              return jsonify({"success": False, "data": {}, "error": "본인 댓글만 수정할 수 있습니다."}), 403
      else:
          # 게스트 인증
          author_email: str = (data.get("author_email") or "").strip()
          author_password: str = (data.get("author_password") or "").strip()
          if not author_email or not author_password:
              return jsonify({"success": False, "data": {}, "error": "이메일과 패스워드를 입력하세요."}), 400
          if (comment.author_id is not None
                  or comment.author_email != author_email
                  or not comment.author_password_hash
                  or not check_password_hash(comment.author_password_hash, author_password)):
              return jsonify({"success": False, "data": {}, "error": "이메일 또는 패스워드가 올바르지 않습니다."}), 401

      comment.content = content
      try:
          db.session.commit()
      except Exception:
          db.session.rollback()
          return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
      return jsonify({"success": True, "data": comment.to_dict(), "error": ""}), 200
  ```

- [ ] **Step 2: `DELETE /api/comments/<id>` 소유권 인증 + cascade 추가**

  기존 `delete_comment` 함수(admin 전용) 전체를 아래로 교체:

  ```python
  @comments_bp.route("/<int:comment_id>", methods=["DELETE"])
  def delete_comment(comment_id: int) -> tuple:
      """댓글 삭제 — admin 항상 허용, 로그인 사용자는 본인 글만, 게스트는 이메일+패스워드 인증."""
      comment: Comment | None = db.session.get(Comment, comment_id)
      if not comment:
          return jsonify({"success": False, "data": {}, "error": "Not found"}), 404

      data: dict = request.get_json() or {}

      # 소유권 검증
      try:
          verify_jwt_in_request(optional=True)
          raw_id = get_jwt_identity()
      except Exception:
          raw_id = None

      if raw_id:
          user: User | None = db.session.get(User, int(raw_id))
          if not user or user.role == "deactivated":
              return jsonify({"success": False, "data": {}, "error": "Permission denied"}), 403
          if user.role != "admin" and comment.author_id != user.id:
              return jsonify({"success": False, "data": {}, "error": "본인 댓글만 삭제할 수 있습니다."}), 403
      else:
          # 게스트 인증
          author_email: str = (data.get("author_email") or "").strip()
          author_password: str = (data.get("author_password") or "").strip()
          if not author_email or not author_password:
              return jsonify({"success": False, "data": {}, "error": "이메일과 패스워드를 입력하세요."}), 400
          if (comment.author_id is not None
                  or comment.author_email != author_email
                  or not comment.author_password_hash
                  or not check_password_hash(comment.author_password_hash, author_password)):
              return jsonify({"success": False, "data": {}, "error": "이메일 또는 패스워드가 올바르지 않습니다."}), 401

      # 답글(children) 먼저 삭제
      replies = db.session.execute(
          select(Comment).where(Comment.parent_id == comment_id)
      ).scalars().all()
      for reply in replies:
          db.session.delete(reply)
      db.session.delete(comment)

      try:
          db.session.commit()
      except Exception:
          db.session.rollback()
          return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
      return jsonify({"success": True, "data": {}, "error": ""}), 200
  ```

- [ ] **Step 3: 동작 확인 (curl)**

  ```bash
  # 게스트 댓글 수정 → 성공
  COMMENT_ID=<위에서 작성한 게스트 댓글 id>
  curl -s -X PUT http://localhost:5000/api/comments/$COMMENT_ID \
    -H "Content-Type: application/json" \
    -d '{"content":"수정된 내용","author_email":"guest@test.com","author_password":"pass123"}' \
    | python3 -m json.tool

  # 잘못된 패스워드 → 401 확인
  curl -s -X PUT http://localhost:5000/api/comments/$COMMENT_ID \
    -H "Content-Type: application/json" \
    -d '{"content":"수정","author_email":"guest@test.com","author_password":"wrong"}' \
    | python3 -m json.tool

  # 로그인 사용자가 타인 댓글 수정 → 403 확인
  curl -s -X PUT http://localhost:5000/api/comments/$COMMENT_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"content":"해킹"}' | python3 -m json.tool
  ```

- [ ] **Step 4: 커밋**

  ```bash
  git add backend/api/comments.py
  git commit -m "feat: 댓글 수정(PUT) + 삭제(DELETE) 소유권 인증 + cascade"
  ```

---

### Task 4: `admin.py` — 전체 댓글 목록 + Comment orphan 처리

**Files:**
- Modify: `backend/api/admin.py`

- [ ] **Step 1: import 수정**

  `admin.py` 상단 (`from sqlalchemy import select, update`와 `from models.schema import User, Post`는 이미 존재):
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

- [ ] **Step 3: `admin_delete_user`에 Comment orphan 처리 추가**

  기존 `admin_delete_user`의 `db.session.delete(user)` 바로 위:
  ```python
  # 기존
  db.session.execute(
      update(Post).where(Post.author_id == user_id).values(author_id=None)
  )
  # 추가
  db.session.execute(
      update(Comment).where(Comment.author_id == user_id).values(author_id=None)
  )
  db.session.delete(user)
  ```

- [ ] **Step 4: 동작 확인 (curl)**

  ```bash
  ADMIN_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"YOUR_ADMIN","password":"YOUR_PW"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

  curl -s http://localhost:5000/api/admin/comments \
    -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
  # 기대: post_title 포함된 댓글 목록
  ```

- [ ] **Step 5: 커밋**

  ```bash
  git add backend/api/admin.py
  git commit -m "feat: admin_list_comments 엔드포인트 + admin_delete_user Comment orphan 처리"
  ```

---

## Chunk 2: 프론트엔드 API 클라이언트 & CommentSection

### Task 5: `frontend/src/api/comments.js` 생성

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

  // data: { content, parent_id?, author_name?, author_email?, author_password? }
  export const createComment = async (token, postId, data) => {
    try {
      const headers = token ? authHeader(token) : {};
      const response = await axios.post(BASE_URL, { post_id: postId, ...data }, { headers });
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || '댓글 작성에 실패했습니다.' };
    }
  };

  // data: { content, author_email?, author_password? }
  export const updateComment = async (token, commentId, data) => {
    try {
      const headers = token ? authHeader(token) : {};
      const response = await axios.put(`${BASE_URL}/${commentId}`, data, { headers });
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || '댓글 수정에 실패했습니다.' };
    }
  };

  // data: { author_email?, author_password? } — 게스트 삭제 시 필요
  export const deleteComment = async (token, commentId, data = {}) => {
    try {
      const headers = token ? authHeader(token) : {};
      const response = await axios.delete(`${BASE_URL}/${commentId}`, { headers, data });
      return response.data;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || '삭제에 실패했습니다.' };
    }
  };

  export const listAllComments = async (token, status = '') => {
    try {
      const params = status ? { status } : {};
      const response = await axios.get('/api/admin/comments', { headers: authHeader(token), params });
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

### Task 6: `CommentSection.jsx` 컴포넌트 생성

**Files:**
- Create: `frontend/src/components/CommentSection.jsx`

- [ ] **Step 1: 파일 생성**

  ```jsx
  // frontend/src/components/CommentSection.jsx
  import { useEffect, useState } from 'react';
  import { Link } from 'react-router-dom';
  import { listComments, createComment, updateComment, deleteComment } from '../api/comments';

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // 게스트 이메일을 localStorage에서 관리
  const getGuestEmail = () => localStorage.getItem('guest_email') || '';
  const setGuestEmail = (email) => localStorage.setItem('guest_email', email);

  // ─── 댓글 작성 폼 ─────────────────────────────────────────────
  function CommentForm({ token, postId, parentId = null, onSuccess, onCancel }) {
    const isLoggedIn = !!token;
    const [content, setContent] = useState('');
    const [authorName, setAuthorName] = useState('');
    const [authorEmail, setAuthorEmail] = useState(getGuestEmail());
    const [authorPassword, setAuthorPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!content.trim()) return;
      setSubmitting(true);
      setError('');

      const data = isLoggedIn
        ? { content: content.trim(), parent_id: parentId || undefined }
        : { content: content.trim(), parent_id: parentId || undefined,
            author_name: authorName.trim(), author_email: authorEmail.trim(),
            author_password: authorPassword };

      const res = await createComment(token, postId, data);
      setSubmitting(false);
      if (res.success) {
        if (!isLoggedIn) setGuestEmail(authorEmail.trim());
        setContent('');
        setAuthorPassword('');
        onSuccess(res.data);
      } else {
        setError(res.error);
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        {!isLoggedIn && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input className="form-input" placeholder="이름 *" value={authorName}
              onChange={(e) => setAuthorName(e.target.value)} required />
            <input className="form-input" type="email" placeholder="이메일 *" value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)} required />
            <input className="form-input" type="password" placeholder="패스워드 * (수정/삭제에 사용)" value={authorPassword}
              onChange={(e) => setAuthorPassword(e.target.value)} required />
          </div>
        )}
        <textarea
          className="form-input"
          rows={3}
          placeholder={parentId ? '답글을 입력하세요...' : '댓글을 입력하세요...'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
        {!isLoggedIn && (
          <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
            게스트 댓글은 관리자 승인 후 표시됩니다.
          </p>
        )}
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 4 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting || !content.trim()}>
            {submitting ? '등록 중...' : '등록'}
          </button>
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>
          )}
        </div>
      </form>
    );
  }

  // ─── 댓글 수정 폼 ─────────────────────────────────────────────
  function EditForm({ comment, token, onSuccess, onCancel }) {
    const isLoggedIn = !!token;
    const [content, setContent] = useState(comment.content);
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!content.trim()) return;
      setSubmitting(true);
      setError('');

      const data = isLoggedIn
        ? { content: content.trim() }
        : { content: content.trim(), author_email: comment.author_email, author_password: password };

      const res = await updateComment(token, comment.id, data);
      setSubmitting(false);
      if (res.success) onSuccess(res.data);
      else setError(res.error);
    };

    return (
      <form onSubmit={handleSubmit} style={{ marginTop: 8 }}>
        <textarea
          className="form-input"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
        {!isLoggedIn && (
          <input className="form-input" type="password" placeholder="패스워드 입력"
            value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 6, width: '100%' }} required />
        )}
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 4 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '저장 중...' : '저장'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>
        </div>
      </form>
    );
  }

  // ─── 삭제 확인 폼 (게스트 전용) ───────────────────────────────
  function GuestDeleteForm({ comment, onSuccess, onCancel }) {
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      setError('');
      const res = await deleteComment(null, comment.id,
        { author_email: comment.author_email, author_password: password });
      setSubmitting(false);
      if (res.success) onSuccess();
      else setError(res.error);
    };

    return (
      <form onSubmit={handleDelete} style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input className="form-input" type="password" placeholder="패스워드 확인"
          value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="btn btn-danger" disabled={submitting}>
          {submitting ? '삭제 중...' : '삭제 확인'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>
        {error && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>}
      </form>
    );
  }

  // ─── 댓글 아이템 ──────────────────────────────────────────────
  function CommentItem({ comment, replies, token, postId, user, onRefresh }) {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [deleteMode, setDeleteMode] = useState(false);

    const guestEmail = getGuestEmail();
    const isLoggedIn = !!token && !!user;

    // 본인 댓글 여부
    const isOwner = isLoggedIn
      ? (user.role === 'admin' || comment.author_id === user.id)
      : (comment.author_id === null && comment.author_email === guestEmail && guestEmail !== '');

    const handleLoggedInDelete = async () => {
      if (!window.confirm('댓글을 삭제할까요?')) return;
      const res = await deleteComment(token, comment.id);
      if (res.success) onRefresh();
      else alert(res.error);
    };

    return (
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
        {editMode ? (
          <EditForm
            comment={comment}
            token={token}
            onSuccess={() => { setEditMode(false); onRefresh(); }}
            onCancel={() => setEditMode(false)}
          />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-h)' }}>
                  {comment.author_name}
                </span>
                {comment.author_id === null && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-light)',
                    background: 'var(--bg-subtle)', padding: '1px 6px', borderRadius: 99 }}>
                    게스트
                  </span>
                )}
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-light)' }}>
                  {formatDate(comment.created_at)}
                </span>
                <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.7, color: 'var(--text-h)', whiteSpace: 'pre-wrap' }}>
                  {comment.content}
                </p>
              </div>
              {isOwner && !deleteMode && (
                <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }}
                    onClick={() => setEditMode(true)}>수정</button>
                  {isLoggedIn ? (
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: '2px 8px' }}
                      onClick={handleLoggedInDelete}>삭제</button>
                  ) : (
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: '2px 8px' }}
                      onClick={() => setDeleteMode(true)}>삭제</button>
                  )}
                </div>
              )}
            </div>

            {/* 게스트 삭제 패스워드 입력 */}
            {deleteMode && (
              <GuestDeleteForm
                comment={comment}
                onSuccess={() => { setDeleteMode(false); onRefresh(); }}
                onCancel={() => setDeleteMode(false)}
              />
            )}

            {/* 답글 달기 버튼 (최상위 댓글에만) */}
            {!comment.parent_id && (
              <button className="btn btn-ghost"
                style={{ fontSize: 12, marginTop: 6, padding: '2px 8px' }}
                onClick={() => setShowReplyForm((v) => !v)}>
                {showReplyForm ? '취소' : '답글 달기'}
              </button>
            )}
          </>
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
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-h)' }}>{reply.author_name}</span>
                {reply.author_id === null && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-light)',
                    background: 'var(--bg-subtle)', padding: '1px 6px', borderRadius: 99 }}>
                    게스트
                  </span>
                )}
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

  // ─── 메인 컴포넌트 ─────────────────────────────────────────────
  export default function CommentSection({ postId, user }) {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('token');

    useEffect(() => {
      const load = async () => {
        setLoading(true);
        const res = await listComments(postId);
        if (res.success) setComments(res.data);
        setLoading(false);
      };
      load();
    }, [postId]);

    const loadComments = async () => {
      const res = await listComments(postId);
      if (res.success) setComments(res.data);
    };

    // flat list → 계층 구조
    const rootComments = comments.filter((c) => c.parent_id === null);
    const repliesOf = (id) => comments.filter((c) => c.parent_id === id);

    return (
      <div style={{ marginTop: 48 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-h)', marginBottom: 20 }}>
          댓글 {comments.length > 0 ? `${comments.length}개` : ''}
        </h3>

        {/* 댓글 작성 폼 */}
        <div style={{ marginBottom: 32 }}>
          {!token && !user && (
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 8 }}>
              <Link to="/login" style={{ color: 'var(--accent)' }}>로그인</Link>하거나 아래 게스트 정보를 입력해 댓글을 남길 수 있습니다.
            </p>
          )}
          <CommentForm token={token} postId={postId} onSuccess={loadComments} />
        </div>

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
              user={user}
              onRefresh={loadComments}
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
  git commit -m "feat: CommentSection 컴포넌트 (로그인/게스트 분기 + 수정/삭제)"
  ```

---

### Task 7: `PostDetail.jsx`에 CommentSection 삽입

**Files:**
- Modify: `frontend/src/pages/PostDetail.jsx`

- [ ] **Step 1: import 추가**

  ```js
  import CommentSection from '../components/CommentSection';
  ```

- [ ] **Step 2: 이전/다음 내비게이션 블록 바로 위에 삽입**

  ```jsx
  {/* 댓글 */}
  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0 0' }} />
  <CommentSection postId={post.id} user={user} />
  ```

- [ ] **Step 3: 브라우저 확인**

  1. `/posts/<id>` 접속 → 댓글 섹션 표시 확인
  2. 로그인 사용자: textarea만 표시, 등록 후 즉시 목록에 나타남
  3. 비로그인: 이름/이메일/패스워드 + textarea 표시, "게스트 댓글은 관리자 승인 후 표시됩니다" 안내
  4. 본인 댓글: [수정] [삭제] 버튼 노출
  5. 게스트 [삭제] 클릭 → 패스워드 입력 폼 인라인 표시

- [ ] **Step 4: 커밋**

  ```bash
  git add frontend/src/pages/PostDetail.jsx
  git commit -m "feat: PostDetail에 CommentSection 삽입"
  ```

---

## Chunk 3: Admin 댓글 관리 페이지 및 라우팅

### Task 8: `AdminComments.jsx` 생성

**Files:**
- Create: `frontend/src/pages/admin/AdminComments.jsx`

- [ ] **Step 1: 파일 생성**

  ```jsx
  // frontend/src/pages/admin/AdminComments.jsx
  import { useEffect, useState } from 'react';
  import { useNavigate, Link } from 'react-router-dom';
  import { listAllComments, deleteComment } from '../../api/comments';

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
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const loadComments = async () => {
      const res = await listAllComments(token);
      if (res.success) setComments(res.data);
      else setError(res.error);
      setLoading(false);
    };

    useEffect(() => {
      if (!token) { navigate('/login'); return; }
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user?.role !== 'admin') { navigate('/my-posts'); return; }
      } catch { navigate('/login'); return; }
      loadComments();
    }, []);

    const handleDelete = async (commentId) => {
      if (!window.confirm('이 댓글을 삭제할까요? 답글도 함께 삭제됩니다.')) return;
      const res = await deleteComment(token, commentId);
      if (res.success) loadComments();
      else alert(res.error);
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
      </div>
    );
  }
  ```

- [ ] **Step 2: 커밋**

  ```bash
  git add frontend/src/pages/admin/AdminComments.jsx
  git commit -m "feat: AdminComments 페이지 (댓글 상태 컬럼 + 삭제)"
  ```

---

### Task 9: `Nav.jsx`와 `App.jsx` 라우팅 연결

**Files:**
- Modify: `frontend/src/components/Nav.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: `Nav.jsx` admin 블록 전체 교체**

  기존 admin 로그인 블록 (lines 32-39)을 아래로 교체:
  ```jsx
  <>
    <Link to="/admin/posts" className="nav-link">포스트 관리</Link>
    <Link to="/admin/users" className="nav-link">회원 관리</Link>
    <Link to="/admin/comments" className="nav-link">댓글 관리</Link>
    <button onClick={handleLogout} className="nav-link"
      style={{ border: 'none', cursor: 'pointer', background: 'none', color: 'var(--danger)' }}>
      로그아웃
    </button>
  </>
  ```

- [ ] **Step 2: `App.jsx` import + 라우트 추가**

  상단 import에 추가:
  ```js
  import AdminComments from './pages/admin/AdminComments';
  ```

  `AdminUsers` 라우트 바로 아래에 추가:
  ```jsx
  <Route path="/admin/comments" element={<AdminComments />} />
  ```

- [ ] **Step 3: 브라우저 확인**

  1. admin 로그인 후 Nav에 "댓글 관리" 링크 표시 확인
  2. `/admin/comments` → 댓글 목록, 상태(공개/승인 대기) 뱃지 확인
  3. 삭제 버튼 → confirm 후 목록 재조회 확인

- [ ] **Step 4: 커밋**

  ```bash
  git add frontend/src/components/Nav.jsx frontend/src/App.jsx
  git commit -m "feat: /admin/comments 라우트 및 Nav 링크 추가"
  ```

---

## 최종 검증

- [ ] **전체 시나리오 테스트**

  1. **로그인 댓글:** editor 로그인 → 댓글 등록 → 즉시 목록에 표시 (approved)
  2. **로그인 본인 수정:** [수정] 클릭 → 인라인 에디팅 → 저장 확인
  3. **로그인 본인 삭제:** [삭제] → confirm → 목록에서 사라짐
  4. **타인 댓글 버튼 없음:** 다른 사용자의 댓글에 [수정]/[삭제] 버튼이 보이지 않음
  5. **게스트 댓글:** 이름/이메일/패스워드 입력 → "승인 대기" 상태로 등록 (목록에 미노출)
  6. **게스트 수정:** [수정] 클릭 → 패스워드 입력 → 저장 성공
  7. **게스트 잘못된 패스워드:** 틀린 패스워드 → 401 에러 메시지 표시
  8. **게스트 삭제:** [삭제] → 패스워드 인라인 폼 → 확인 → 삭제
  9. **1단 답글 차단:** curl로 답글의 id를 parent_id로 요청 → 400
  10. **Admin 댓글 관리:** `/admin/comments` → 전체 목록 + 상태 뱃지 + 삭제

- [ ] **최종 커밋**

  ```bash
  git add -A
  git commit -m "feat: 댓글 기능 전체 구현 완료 (로그인/게스트 + 수정/삭제 + Admin 관리)"
  ```
