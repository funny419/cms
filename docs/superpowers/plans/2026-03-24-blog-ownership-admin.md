# 개인 블로그 소유권 + Admin 대시보드 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원이 자신의 글만 관리하는 개인 블로그 방식으로 전환하고, Admin이 전체 포스트·회원을 관리하는 대시보드를 구축한다.

**Architecture:** 백엔드에 소유권 검사(PUT/DELETE)와 admin Blueprint를 추가하고, 프론트엔드는 role 기반으로 Login 분기·Nav 분리·전용 페이지를 생성한다.

**Tech Stack:** Flask + SQLAlchemy 3.x / React 19 + Vite + CSS Variables / axios

---

## Chunk 1: 백엔드

### Task 1: Post.author_id nullable 마이그레이션

**Files:**
- Modify: `backend/models/schema.py`

- [ ] **Step 1: schema.py 수정**

`backend/models/schema.py` Post 클래스에서:

```python
# 변경 전 (line ~66)
author_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)

# 변경 후
author_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'), nullable=True)
```

- [ ] **Step 2: 마이그레이션 생성 및 적용**

```bash
docker compose exec backend flask db migrate -m "Post author_id nullable"
docker compose exec backend flask db upgrade
```

Expected: `Running upgrade ... -> <hash>, Post author_id nullable`

- [ ] **Step 3: Commit**

```bash
git add backend/models/schema.py backend/migrations/
git commit -m "fix: Post.author_id nullable 허용 (회원 삭제 시 고아 포스트 처리)"
```

---

### Task 2: auth.py — deactivated 계정 로그인 차단

**Files:**
- Modify: `backend/api/auth.py`

현재 `login()` 함수의 `if user and user.check_password(...)` 블록 안에 체크를 추가합니다.

- [ ] **Step 1: auth.py 수정**

```python
@auth_bp.route('/login', methods=['POST'])
def login() -> tuple:
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'data': {}, 'error': 'Missing request body'}), 400
    user = db.session.execute(select(User).where(User.username == data.get('username'))).scalar_one_or_none()
    if user and user.check_password(data.get('password')):
        if user.role == 'deactivated':
            return jsonify({'success': False, 'data': {}, 'error': '비활성화된 계정입니다.'}), 401
        access_token = create_access_token(identity=str(user.id))
        return jsonify({
            'success': True,
            'data': {'access_token': access_token, 'user': user.to_dict()},
            'error': ''
        }), 200
    return jsonify({'success': False, 'data': {}, 'error': 'Invalid username or password'}), 401
```

- [ ] **Step 2: 동작 확인**

```bash
# deactivated 계정 테스트용으로 DB에서 직접 비활성화
docker compose exec db mariadb -u funnycms -pdev_app_password cmsdb \
  -e "UPDATE users SET role='deactivated' WHERE username='newuser';"

curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"test1234"}' | python3 -m json.tool
# Expected: {"success": false, "error": "비활성화된 계정입니다."}

# 복구
docker compose exec db mariadb -u funnycms -pdev_app_password cmsdb \
  -e "UPDATE users SET role='editor' WHERE username='newuser';"
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/auth.py
git commit -m "feat: deactivated 계정 로그인 차단"
```

---

### Task 3: posts.py — GET /mine 추가 + PUT/DELETE 소유권 검사

**Files:**
- Modify: `backend/api/posts.py`

- [ ] **Step 1: posts.py 전체 교체**

`backend/api/posts.py` 를 아래 내용으로 교체합니다:

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Post, User
from database import db

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")


@posts_bp.route("", methods=["GET"])
def list_posts() -> tuple:
    """공개된 포스트 목록 조회."""
    posts = db.session.execute(
        select(Post).where(Post.status == "published")
    ).scalars().all()
    return jsonify({"success": True, "data": [p.to_dict() for p in posts], "error": ""}), 200


@posts_bp.route("/mine", methods=["GET"])
@jwt_required()
def get_my_posts() -> tuple:
    """로그인 유저의 모든 포스트 조회 (draft + published)."""
    current_user_id: int = int(get_jwt_identity())
    user: User | None = db.session.get(User, current_user_id)
    if user and user.role == 'deactivated':
        return jsonify({"success": False, "data": {}, "error": "비활성화된 계정입니다."}), 403
    posts = db.session.execute(
        select(Post)
        .where(Post.author_id == current_user_id)
        .order_by(Post.created_at.desc())
    ).scalars().all()
    return jsonify({"success": True, "data": [p.to_dict() for p in posts], "error": ""}), 200


@posts_bp.route("/<int:post_id>", methods=["GET"])
def get_post(post_id: int) -> tuple:
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    return jsonify({"success": True, "data": post.to_dict(), "error": ""}), 200


@posts_bp.route("", methods=["POST"])
@roles_required("admin", "editor")
def create_post() -> tuple:
    data: dict = request.get_json() or {}
    if not data.get("title"):
        return jsonify({"success": False, "data": {}, "error": "title is required"}), 400
    author_id: int = int(get_jwt_identity())
    post = Post(
        title=data["title"],
        slug=data.get("slug", ""),
        content=data.get("content", ""),
        excerpt=data.get("excerpt", ""),
        status=data.get("status", "draft"),
        post_type=data.get("post_type", "post"),
        author_id=author_id,
    )
    db.session.add(post)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": post.to_dict(), "error": ""}), 201


@posts_bp.route("/<int:post_id>", methods=["PUT"])
@roles_required("admin", "editor")
def update_post(post_id: int) -> tuple:
    current_user_id: int = int(get_jwt_identity())
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    user: User | None = db.session.get(User, current_user_id)
    if user and user.role != 'admin' and post.author_id != current_user_id:
        return jsonify({"success": False, "data": {}, "error": "본인 글만 수정할 수 있습니다."}), 403
    data: dict = request.get_json() or {}
    for field in ("title", "slug", "content", "excerpt", "status", "post_type"):
        if field in data:
            setattr(post, field, data[field])
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": post.to_dict(), "error": ""}), 200


@posts_bp.route("/<int:post_id>", methods=["DELETE"])
@roles_required("admin", "editor")
def delete_post(post_id: int) -> tuple:
    current_user_id: int = int(get_jwt_identity())
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return jsonify({"success": False, "data": {}, "error": "Not found"}), 404
    user: User | None = db.session.get(User, current_user_id)
    if user and user.role != 'admin' and post.author_id != current_user_id:
        return jsonify({"success": False, "data": {}, "error": "본인 글만 삭제할 수 있습니다."}), 403
    db.session.delete(post)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200
```

- [ ] **Step 2: 동작 확인**

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# 내 글 목록
curl -s http://localhost:5000/api/posts/mine \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Expected: success: true, data: [...]
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/posts.py
git commit -m "feat: GET /api/posts/mine, PUT/DELETE 소유권 검사 추가"
```

---

### Task 4: admin.py Blueprint 신규 생성 + app.py 등록

**Files:**
- Create: `backend/api/admin.py`
- Modify: `backend/app.py`

- [ ] **Step 1: backend/api/admin.py 생성**

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import select, update
from api.decorators import roles_required
from models.schema import User, Post
from database import db

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/posts", methods=["GET"])
@roles_required("admin")
def admin_list_posts() -> tuple:
    """전체 포스트 목록 (모든 유저, 모든 상태)."""
    posts = db.session.execute(
        select(Post).order_by(Post.created_at.desc())
    ).scalars().all()
    data = [{
        "id": p.id,
        "title": p.title,
        "status": p.status,
        "post_type": p.post_type,
        "author_id": p.author_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in posts]
    return jsonify({"success": True, "data": data, "error": ""}), 200


@admin_bp.route("/users", methods=["GET"])
@roles_required("admin")
def admin_list_users() -> tuple:
    """전체 회원 목록 (deactivated 포함)."""
    users = db.session.execute(select(User)).scalars().all()
    return jsonify({"success": True, "data": [u.to_dict() for u in users], "error": ""}), 200


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@roles_required("admin")
def admin_change_role(user_id: int) -> tuple:
    """회원 권한 변경 (editor ↔ admin, deactivated → editor 재활성화 포함)."""
    current_user_id: int = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({"success": False, "data": {}, "error": "본인의 권한은 변경할 수 없습니다."}), 403
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    data: dict = request.get_json() or {}
    role = data.get("role")
    if role not in ("editor", "admin"):
        return jsonify({"success": False, "data": {}, "error": "유효하지 않은 권한입니다. (editor 또는 admin)"}), 400
    user.role = role
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {"id": user.id, "role": user.role}, "error": ""}), 200


@admin_bp.route("/users/<int:user_id>/deactivate", methods=["PUT"])
@roles_required("admin")
def admin_deactivate_user(user_id: int) -> tuple:
    """회원 비활성화."""
    current_user_id: int = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({"success": False, "data": {}, "error": "본인을 비활성화할 수 없습니다."}), 403
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    user.role = "deactivated"
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {"id": user.id, "role": "deactivated"}, "error": ""}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@roles_required("admin")
def admin_delete_user(user_id: int) -> tuple:
    """회원 삭제. 해당 회원의 포스트 author_id는 NULL 처리."""
    current_user_id: int = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({"success": False, "data": {}, "error": "본인 계정은 삭제할 수 없습니다."}), 403
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    db.session.execute(
        update(Post).where(Post.author_id == user_id).values(author_id=None)
    )
    db.session.delete(user)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "data": {}, "error": "An internal error occurred."}), 500
    return jsonify({"success": True, "data": {}, "error": ""}), 200


@admin_bp.route("/users/<int:user_id>/posts", methods=["GET"])
@roles_required("admin")
def admin_user_posts(user_id: int) -> tuple:
    """특정 회원의 포스트 전체 조회."""
    user: User | None = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "data": {}, "error": "User not found"}), 404
    posts = db.session.execute(
        select(Post).where(Post.author_id == user_id).order_by(Post.created_at.desc())
    ).scalars().all()
    data = [{
        "id": p.id,
        "title": p.title,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    } for p in posts]
    return jsonify({"success": True, "data": data, "error": ""}), 200
```

- [ ] **Step 2: app.py에 admin_bp 등록**

`backend/app.py`의 기존 blueprint 등록 블록 끝에 추가:

```python
from api.admin import admin_bp
app.register_blueprint(admin_bp)
```

- [ ] **Step 3: 동작 확인**

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

curl -s http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Expected: success: true, data: [{id, username, email, role, ...}]

curl -s http://localhost:5000/api/admin/posts \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Expected: success: true, data: [...]
```

- [ ] **Step 4: Commit**

```bash
git add backend/api/admin.py backend/app.py
git commit -m "feat: Admin API Blueprint (포스트/회원 관리)"
```

---

## Chunk 2: 프론트엔드 — 인증 흐름 + 내 블로그

### Task 5: Login.jsx — role 기반 리다이렉트

**Files:**
- Modify: `frontend/src/pages/Login.jsx`

- [ ] **Step 1: navigate 분기 수정**

`handleSubmit` 내 `navigate('/posts')` 를 아래로 교체:

```jsx
const role = result.data.user.role;
navigate(role === 'admin' ? '/admin/posts' : '/my-posts');
```

- [ ] **Step 2: 확인**

브라우저에서 testuser(admin) 로그인 → `/admin/posts` 이동 확인
editor 계정 로그인 → `/my-posts` 이동 확인

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Login.jsx
git commit -m "feat: 로그인 후 role 기반 페이지 분기 (admin → /admin/posts, editor → /my-posts)"
```

---

### Task 6: Nav.jsx — role별 메뉴 분기

**Files:**
- Modify: `frontend/src/components/Nav.jsx`

- [ ] **Step 1: Nav.jsx 전체 교체**

```jsx
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};

export default function Nav() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = getUser();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="nav">
      <Link
        to={token ? (user?.role === 'admin' ? '/admin/posts' : '/my-posts') : '/login'}
        className="nav-brand"
      >
        ✦ CMS
      </Link>

      <div className="nav-links">
        {token ? (
          user?.role === 'admin' ? (
            <>
              <Link to="/admin/posts" className="nav-link">포스트 관리</Link>
              <Link to="/admin/users" className="nav-link">회원 관리</Link>
              <button onClick={handleLogout} className="nav-link" style={{ border: 'none', cursor: 'pointer', background: 'none', color: 'var(--danger)' }}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/my-posts" className="nav-link">내 글</Link>
              <Link to="/posts" className="nav-link">전체 글</Link>
              <Link to="/profile" className="nav-link">프로필</Link>
              <button onClick={handleLogout} className="nav-link" style={{ border: 'none', cursor: 'pointer', background: 'none', color: 'var(--danger)' }}>
                로그아웃
              </button>
            </>
          )
        ) : (
          <>
            <Link to="/login" className="nav-link">로그인</Link>
            <Link to="/register" className="nav-link">회원가입</Link>
          </>
        )}
        <button className="nav-theme-btn" onClick={toggleTheme} title="테마 전환">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: 확인**

admin 로그인 → Nav에 "포스트 관리" / "회원 관리" 표시
editor 로그인 → Nav에 "내 글" / "전체 글" / "프로필" 표시

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Nav.jsx
git commit -m "feat: Nav role별 메뉴 분기 (admin / editor)"
```

---

### Task 7: posts.js + admin.js API 클라이언트

**Files:**
- Modify: `frontend/src/api/posts.js`
- Create: `frontend/src/api/admin.js`

- [ ] **Step 1: posts.js에 getMyPosts 추가**

기존 파일 끝에 추가:

```js
export const getMyPosts = async (token) => {
  try {
    const response = await axios.get(`${BASE_URL}/mine`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch my posts.' };
  }
};
```

- [ ] **Step 2: frontend/src/api/admin.js 생성**

```js
import axios from 'axios';

const BASE_URL = '/api/admin';
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const adminListPosts = async (token) => {
  try {
    const response = await axios.get(`${BASE_URL}/posts`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch posts.' };
  }
};

export const adminListUsers = async (token) => {
  try {
    const response = await axios.get(`${BASE_URL}/users`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch users.' };
  }
};

export const adminChangeRole = async (token, userId, role) => {
  try {
    const response = await axios.put(`${BASE_URL}/users/${userId}/role`, { role }, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to change role.' };
  }
};

export const adminDeactivateUser = async (token, userId) => {
  try {
    const response = await axios.put(`${BASE_URL}/users/${userId}/deactivate`, {}, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to deactivate user.' };
  }
};

export const adminDeleteUser = async (token, userId) => {
  try {
    const response = await axios.delete(`${BASE_URL}/users/${userId}`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to delete user.' };
  }
};

export const adminGetUserPosts = async (token, userId) => {
  try {
    const response = await axios.get(`${BASE_URL}/users/${userId}/posts`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch user posts.' };
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/posts.js frontend/src/api/admin.js
git commit -m "feat: getMyPosts API 추가 + admin.js API 클라이언트 신규"
```

---

### Task 8: MyPosts.jsx 신규 생성

**Files:**
- Create: `frontend/src/pages/MyPosts.jsx`

- [ ] **Step 1: MyPosts.jsx 생성**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPosts, deletePost } from '../api/posts';

const STATUS_BADGE = {
  published: { label: '발행됨', style: { background: 'var(--accent-bg)', color: 'var(--accent-text)' } },
  draft: { label: '임시저장', style: { background: 'var(--bg-subtle)', color: 'var(--text-light)' } },
  scheduled: { label: '예약됨', style: { background: '#fef3c7', color: '#92400e' } },
};

export default function MyPosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    getMyPosts(token).then((res) => {
      if (res.success) setPosts(res.data);
      else setError(res.error);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id) => {
    const res = await deletePost(token, id);
    if (res.success) setPosts((prev) => prev.filter((p) => p.id !== id));
    else alert(res.error);
  };

  if (loading) return <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>;

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>내 블로그</h1>
        <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>+ 새 글</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 ? (
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
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/MyPosts.jsx
git commit -m "feat: 내 블로그 페이지 (/my-posts)"
```

---

### Task 9: PostDetail.jsx 편집 버튼 조건 + App.jsx 라우트 추가

**Files:**
- Modify: `frontend/src/pages/PostDetail.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: PostDetail.jsx 편집 버튼 조건 수정**

현재 `isEditorOrAdmin(user)` 조건을 아래로 교체합니다:

```jsx
// 변경 전
{isEditorOrAdmin(user) && (

// 변경 후
{user && (user.role === 'admin' || post.author_id === user.id) && (
```

`isEditorOrAdmin` 함수와 관련 import는 더 이상 필요 없으면 제거합니다.

- [ ] **Step 2: App.jsx에 /my-posts 라우트 추가**

현재 App.jsx를 읽고, `MyPosts` import 추가 및 `/my-posts` 라우트를 등록합니다.

```jsx
import MyPosts from './pages/MyPosts';
// ...
<Route path="/my-posts" element={<MyPosts />} />
```

기존 라우트 순서 유지. `/posts` 다음에 추가:
```
/posts → PostList
/my-posts → MyPosts   ← 추가
/posts/new → PostEditor
/posts/:id/edit → PostEditor
/posts/:id → PostDetail
```

- [ ] **Step 3: 확인**

editor 로그인 → `/my-posts` 자동 이동
내 글 클릭 → `/posts/:id` 이동, 편집 버튼 표시
다른 사람 글 → 편집 버튼 없음

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PostDetail.jsx frontend/src/App.jsx
git commit -m "feat: PostDetail 편집 버튼 소유자 조건 + /my-posts 라우트"
```

---

## Chunk 3: 프론트엔드 — Admin 페이지

### Task 10: AdminPosts.jsx 신규 생성

**Files:**
- Create: `frontend/src/pages/admin/AdminPosts.jsx`

- [ ] **Step 1: frontend/src/pages/admin/ 디렉토리 생성 후 AdminPosts.jsx 작성**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminListPosts } from '../../api/admin';
import { deletePost } from '../../api/posts';

const STATUS_LABEL = { published: '발행됨', draft: '임시저장', scheduled: '예약됨' };
const STATUS_COLOR = {
  published: { background: 'var(--accent-bg)', color: 'var(--accent-text)' },
  draft:     { background: 'var(--bg-subtle)', color: 'var(--text-light)' },
  scheduled: { background: '#fef3c7', color: '#92400e' },
};

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);
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

    adminListPosts(token).then((res) => {
      if (res.success) setPosts(res.data);
      else setError(res.error);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('이 포스트를 삭제할까요?')) return;
    const res = await deletePost(token, id);
    if (res.success) setPosts((prev) => prev.filter((p) => p.id !== id));
    else alert(res.error);
  };

  if (loading) return <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>;

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <h1 className="page-heading" style={{ marginBottom: 24 }}>포스트 관리</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 ? (
        <div className="empty-state"><p>포스트가 없습니다.</p></div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>제목</th>
              <th style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>작성자 ID</th>
              <th style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>상태</th>
              <th style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>작성일</th>
              <th style={{ padding: '10px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-h)', fontWeight: 500 }}>
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
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/AdminPosts.jsx
git commit -m "feat: Admin 포스트 관리 페이지 (/admin/posts)"
```

---

### Task 11: AdminUsers.jsx 신규 생성

**Files:**
- Create: `frontend/src/pages/admin/AdminUsers.jsx`

- [ ] **Step 1: AdminUsers.jsx 생성**

```jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminListUsers, adminChangeRole,
  adminDeactivateUser, adminDeleteUser, adminGetUserPosts,
} from '../../api/admin';

const ROLE_STYLE = {
  admin:       { background: 'var(--accent-bg)',  color: 'var(--accent-text)' },
  editor:      { background: '#dbeafe',           color: '#1d4ed8' },
  deactivated: { background: 'var(--bg-subtle)',  color: 'var(--text-light)' },
};
const ROLE_LABEL = { admin: 'admin', editor: 'editor', deactivated: '비활성화' };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [userPosts, setUserPosts] = useState({});
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const currentUserId = (() => {
    try { return JSON.parse(localStorage.getItem('user'))?.id; }
    catch { return null; }
  })();

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user?.role !== 'admin') { navigate('/my-posts'); return; }
    } catch { navigate('/login'); return; }

    adminListUsers(token).then((res) => {
      if (res.success) setUsers(res.data);
      else setError(res.error);
      setLoading(false);
    });
  }, []);

  const handleRoleChange = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'editor' : 'admin';
    const res = await adminChangeRole(token, userId, newRole);
    if (res.success) setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: res.data.role } : u));
    else alert(res.error);
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('이 회원을 비활성화할까요?')) return;
    const res = await adminDeactivateUser(token, userId);
    if (res.success) setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: 'deactivated' } : u));
    else alert(res.error);
  };

  const handleActivate = async (userId) => {
    const res = await adminChangeRole(token, userId, 'editor');
    if (res.success) setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: 'editor' } : u));
    else alert(res.error);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('이 회원을 삭제할까요? 해당 회원의 글은 유지됩니다.')) return;
    const res = await adminDeleteUser(token, userId);
    if (res.success) setUsers((prev) => prev.filter((u) => u.id !== userId));
    else alert(res.error);
  };

  const handleTogglePosts = async (userId) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    if (!userPosts[userId]) {
      const res = await adminGetUserPosts(token, userId);
      if (res.success) setUserPosts((prev) => ({ ...prev, [userId]: res.data }));
    }
  };

  if (loading) return <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>;

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <h1 className="page-heading" style={{ marginBottom: 24 }}>회원 관리</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
            {['아이디', '이메일', '권한', '가입일', '액션'].map((h) => (
              <th key={h} style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const isDeactivated = user.role === 'deactivated';
            return (
              <React.Fragment key={user.id}>
                <tr style={{ borderBottom: expandedUser === user.id ? 'none' : '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-h)', fontWeight: 500 }}>{user.username}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-light)' }}>{user.email}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...(ROLE_STYLE[user.role] || ROLE_STYLE.editor) }}>
                      {ROLE_LABEL[user.role] || user.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-light)', fontSize: 13 }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : ''}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {/* 권한 변경: 본인·deactivated이면 disabled */}
                      {!isDeactivated && (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                          disabled={isSelf}
                          onClick={() => !isSelf && handleRoleChange(user.id, user.role)}>
                          {user.role === 'admin' ? '→editor' : '→admin'}
                        </button>
                      )}
                      {/* 비활성화/활성화: 본인이면 disabled */}
                      {isDeactivated ? (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: 'var(--success)' }}
                          disabled={isSelf}
                          onClick={() => !isSelf && handleActivate(user.id)}>
                          활성화
                        </button>
                      ) : (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                          disabled={isSelf}
                          onClick={() => !isSelf && handleDeactivate(user.id)}>
                          비활성화
                        </button>
                      )}
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => handleTogglePosts(user.id)}>
                        글 보기
                      </button>
                      {/* 삭제: 본인이면 disabled */}
                      <button className="btn btn-danger" style={{ fontSize: 11, padding: '3px 8px' }}
                        disabled={isSelf}
                        onClick={() => !isSelf && handleDelete(user.id)}>
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedUser === user.id && (
                  <tr>
                    <td colSpan={5} style={{ padding: '0 12px 12px', background: 'var(--bg-subtle)' }}>
                      {(userPosts[user.id] || []).length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-light)', padding: '8px 0' }}>작성한 글이 없습니다.</p>
                      ) : (
                        <ul style={{ listStyle: 'none', padding: '8px 0', margin: 0 }}>
                          {(userPosts[user.id] || []).map((post) => (
                            <li key={post.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                              <span style={{ color: 'var(--text-h)' }}>{post.title}</span>
                              <span style={{ color: 'var(--text-light)' }}>{post.status}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/AdminUsers.jsx
git commit -m "feat: Admin 회원 관리 페이지 (/admin/users)"
```

---

### Task 12: App.jsx — Admin 라우트 등록

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: App.jsx에 Admin 라우트 추가**

현재 App.jsx를 읽고, AdminPosts와 AdminUsers를 import 후 라우트 등록:

```jsx
import AdminPosts from './pages/admin/AdminPosts';
import AdminUsers from './pages/admin/AdminUsers';
// ...
<Route path="/admin/posts" element={<AdminPosts />} />
<Route path="/admin/users" element={<AdminUsers />} />
```

기존 라우트 중 `/my-posts` 다음에 추가.

- [ ] **Step 2: 전체 흐름 확인**

1. testuser(admin) 로그인 → `/admin/posts` 이동, 포스트 테이블 표시
2. 회원 관리 → `/admin/users` 이동, 회원 테이블 표시
3. editor 계정 로그인 → `/my-posts` 이동, 내 글 목록 + `+ 새 글` 버튼
4. `/admin/posts` 직접 접근 → `/my-posts` 리다이렉트
5. 포스트 편집 → 본인 글은 편집 가능, 타인 글은 403

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: Admin 라우트 등록 (/admin/posts, /admin/users)"
```
