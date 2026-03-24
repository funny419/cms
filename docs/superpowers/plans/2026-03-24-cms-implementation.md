# CMS 전체 기능 구현 계획서

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WordPress 스타일 설치형 CMS의 인증 이후 모든 미구현 기능(Core / CMS / UI/UX)을 단계적으로 완성한다.

**Architecture:** Flask Blueprint 패턴으로 도메인별 API를 분리하고, React 프론트엔드와 연동한다. 각 Phase는 독립적으로 동작 가능한 단위로 구성된다.

**Tech Stack:** Python 3.11 + Flask + SQLAlchemy 3.x + Flask-JWT-Extended / React 19 + Vite + Tailwind CSS / MariaDB 10.11 / Docker

---

> **⚠️ 규모 안내:** 이 계획서는 3개의 독립적인 대형 서브시스템을 다룹니다.
> 필요 시 Phase별로 분리하여 별도 계획서로 진행할 수 있습니다.
> - Phase 1 (Core 완성) → 단독 실행 가능
> - Phase 2 (CMS 콘텐츠) → Phase 1 완료 후 실행
> - Phase 3 (UI/UX) → Phase 2 완료 후 실행

---

## Phase 1: Core 완성 — 버그 수정 + 권한 시스템

> **목표:** 현재 알려진 버그를 모두 수정하고, RBAC 및 사이트 설정 API를 완성한다.

---

## Chunk 1: 버그 수정

### Task 1: CORS 초기화 및 User.to_dict() 수정

**Files:**
- Modify: `backend/app.py`
- Modify: `backend/models/schema.py`
- Modify: `backend/api/auth.py`

- [ ] **Step 1: CORS 초기화 추가**

`backend/app.py`의 `create_app()` 내부에 추가:

```python
from flask_cors import CORS

def create_app(config_name: str = "development") -> Flask:
    app = Flask(__name__)
    # ... 기존 설정 ...
    CORS(app, origins=["http://localhost:5173"])
    # ...
```

- [ ] **Step 2: `User.to_dict()` 메서드 추가**

`backend/models/schema.py`의 `User` 클래스에 추가:

```python
def to_dict(self) -> dict:
    return {
        "id": self.id,
        "username": self.username,
        "email": self.email,
        "role": self.role,
        "created_at": self.created_at.isoformat() if self.created_at else None,
    }
```

- [ ] **Step 3: `PUT /api/auth/me` 엔드포인트 구현**

`backend/api/auth.py`에 추가:

```python
@auth_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_profile() -> tuple[dict, int]:
    current_user_id: int = get_jwt_identity()
    user: User | None = db.session.get(User, current_user_id)
    if not user:
        return {"success": False, "data": {}, "error": "User not found"}, 404

    data: dict = request.get_json() or {}
    if "username" in data:
        user.username = data["username"]
    if "email" in data:
        user.email = data["email"]

    db.session.commit()
    return {"success": True, "data": user.to_dict(), "error": ""}, 200
```

- [ ] **Step 4: 빈 파일 정리**

`backend/schema.py` 파일이 빈 파일임을 확인 후 삭제:

```bash
rm backend/schema.py
```

- [ ] **Step 5: 로컬에서 Flask 실행하여 수동 검증**

```bash
cd backend && flask run
# curl로 확인
curl -X PUT http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"username": "newname"}'
# Expected: {"success": true, "data": {...}, "error": ""}
```

- [ ] **Step 6: Commit**

```bash
git add backend/app.py backend/models/schema.py backend/api/auth.py
git commit -m "fix: CORS 초기화, User.to_dict 추가, PUT /api/auth/me 구현"
```

---

### Task 2: axios 정리 (프론트엔드)

**Files:**
- Modify: `frontend/src/api/auth.js`

- [ ] **Step 1: fetch → axios 마이그레이션 또는 axios 제거 결정**

`frontend/src/api/auth.js`의 현재 구현을 확인한 후, 팀 컨벤션에 따라 하나로 통일.
(기본 방침: axios 사용으로 통일 — package.json에 이미 포함되어 있음)

```js
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const login = (email, password) =>
  axios.post(`${BASE_URL}/api/auth/login`, { email, password });

export const register = (username, email, password) =>
  axios.post(`${BASE_URL}/api/auth/register`, { username, email, password });

export const getMe = (token) =>
  axios.get(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const updateMe = (token, data) =>
  axios.put(`${BASE_URL}/api/auth/me`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/auth.js
git commit -m "fix: fetch → axios 통일, updateMe API 추가"
```

---

## Chunk 2: RBAC 권한 시스템

### Task 3: 역할 기반 접근 제어 (RBAC) 데코레이터

**Files:**
- Create: `backend/api/decorators.py`
- Modify: `backend/api/auth.py`

- [ ] **Step 1: 권한 검증 데코레이터 작성**

`backend/api/decorators.py` 생성:

```python
from functools import wraps
from typing import Callable
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from models.schema import User
from database import db


def roles_required(*roles: str) -> Callable:
    """JWT 토큰의 사용자 역할을 검증하는 데코레이터."""
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id: int = get_jwt_identity()
            user: User | None = db.session.get(User, user_id)
            if not user or user.role not in roles:
                return jsonify({
                    "success": False,
                    "data": {},
                    "error": "Permission denied"
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
```

- [ ] **Step 2: 관리자 전용 사용자 목록 API 추가 (데코레이터 검증용)**

`backend/api/auth.py`에 추가:

```python
from api.decorators import roles_required
from sqlalchemy import select

@auth_bp.route("/users", methods=["GET"])
@roles_required("admin")
def list_users() -> tuple[dict, int]:
    users = db.session.execute(select(User)).scalars().all()
    return {"success": True, "data": [u.to_dict() for u in users], "error": ""}, 200
```

- [ ] **Step 3: 수동 검증**

```bash
# 일반 유저 토큰으로 접근 → 403 확인
curl http://localhost:5000/api/auth/users \
  -H "Authorization: Bearer <editor_token>"
# Expected: {"success": false, "error": "Permission denied"}

# 관리자 토큰으로 접근 → 200 확인
curl http://localhost:5000/api/auth/users \
  -H "Authorization: Bearer <admin_token>"
# Expected: {"success": true, "data": [...]}
```

- [ ] **Step 4: Commit**

```bash
git add backend/api/decorators.py backend/api/auth.py
git commit -m "feat: RBAC 데코레이터 및 관리자 전용 사용자 목록 API"
```

---

## Chunk 3: 사이트 설정 API

### Task 4: Option 모델 기반 사이트 메타 API

**Files:**
- Create: `backend/api/settings.py`
- Modify: `backend/app.py`

- [ ] **Step 1: 사이트 설정 Blueprint 작성**

`backend/api/settings.py` 생성:

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Option
from database import db

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")


@settings_bp.route("", methods=["GET"])
def get_settings() -> tuple[dict, int]:
    """공개 사이트 설정 조회 (site_title, tagline 등)."""
    public_keys = ["site_title", "tagline", "site_url"]
    options = db.session.execute(
        select(Option).where(Option.key.in_(public_keys))
    ).scalars().all()
    data = {opt.key: opt.value for opt in options}
    return {"success": True, "data": data, "error": ""}, 200


@settings_bp.route("", methods=["PUT"])
@roles_required("admin")
def update_settings() -> tuple[dict, int]:
    """관리자 전용 사이트 설정 수정."""
    data: dict = request.get_json() or {}
    for key, value in data.items():
        option = db.session.execute(
            select(Option).where(Option.key == key)
        ).scalar_one_or_none()
        if option:
            option.value = str(value)
        else:
            db.session.add(Option(key=key, value=str(value)))
    db.session.commit()
    return {"success": True, "data": data, "error": ""}, 200
```

- [ ] **Step 2: Blueprint 등록**

`backend/app.py`의 `create_app()`에 추가:

```python
from api.settings import settings_bp
app.register_blueprint(settings_bp)
```

- [ ] **Step 3: 수동 검증**

```bash
# 설정 조회
curl http://localhost:5000/api/settings
# Expected: {"success": true, "data": {}}

# 관리자로 설정 저장
curl -X PUT http://localhost:5000/api/settings \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"site_title": "My CMS", "tagline": "Hello World"}'
# Expected: {"success": true, "data": {"site_title": "My CMS", ...}}
```

- [ ] **Step 4: Commit**

```bash
git add backend/api/settings.py backend/app.py
git commit -m "feat: 사이트 메타 설정 API (GET/PUT /api/settings)"
```

---

## Phase 2: CMS 콘텐츠 관리

> **목표:** 포스트 CRUD, 미디어 업로드, 댓글 시스템 API와 프론트엔드를 구현한다.
> **선행 조건:** Phase 1 완료

---

## Chunk 4: 포스트 엔진

### Task 5: 포스트 CRUD API

**Files:**
- Create: `backend/api/posts.py`
- Modify: `backend/app.py`
- Modify: `backend/models/schema.py` (Post.to_dict 추가)

- [ ] **Step 1: Post.to_dict() 추가**

`backend/models/schema.py`의 `Post` 클래스에 추가:

```python
def to_dict(self) -> dict:
    return {
        "id": self.id,
        "title": self.title,
        "content": self.content,
        "status": self.status,
        "post_type": self.post_type,
        "author_id": self.author_id,
        "created_at": self.created_at.isoformat() if self.created_at else None,
        "published_at": self.published_at.isoformat() if self.published_at else None,
    }
```

- [ ] **Step 2: 포스트 Blueprint 작성**

`backend/api/posts.py` 생성:

```python
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Post
from database import db

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")


@posts_bp.route("", methods=["GET"])
def list_posts() -> tuple[dict, int]:
    """공개 포스트 목록 조회."""
    posts = db.session.execute(
        select(Post).where(Post.status == "published")
    ).scalars().all()
    return {"success": True, "data": [p.to_dict() for p in posts], "error": ""}, 200


@posts_bp.route("/<int:post_id>", methods=["GET"])
def get_post(post_id: int) -> tuple[dict, int]:
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return {"success": False, "data": {}, "error": "Not found"}, 404
    return {"success": True, "data": post.to_dict(), "error": ""}, 200


@posts_bp.route("", methods=["POST"])
@roles_required("admin", "editor")
def create_post() -> tuple[dict, int]:
    data: dict = request.get_json() or {}
    author_id: int = get_jwt_identity()
    post = Post(
        title=data.get("title", ""),
        content=data.get("content", ""),
        status=data.get("status", "draft"),
        post_type=data.get("post_type", "post"),
        author_id=author_id,
    )
    db.session.add(post)
    db.session.commit()
    return {"success": True, "data": post.to_dict(), "error": ""}, 201


@posts_bp.route("/<int:post_id>", methods=["PUT"])
@roles_required("admin", "editor")
def update_post(post_id: int) -> tuple[dict, int]:
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return {"success": False, "data": {}, "error": "Not found"}, 404
    data: dict = request.get_json() or {}
    for field in ("title", "content", "status", "post_type"):
        if field in data:
            setattr(post, field, data[field])
    db.session.commit()
    return {"success": True, "data": post.to_dict(), "error": ""}, 200


@posts_bp.route("/<int:post_id>", methods=["DELETE"])
@roles_required("admin")
def delete_post(post_id: int) -> tuple[dict, int]:
    post: Post | None = db.session.get(Post, post_id)
    if not post:
        return {"success": False, "data": {}, "error": "Not found"}, 404
    db.session.delete(post)
    db.session.commit()
    return {"success": True, "data": {}, "error": ""}, 200
```

- [ ] **Step 3: Blueprint 등록**

`backend/app.py`에 추가:

```python
from api.posts import posts_bp
app.register_blueprint(posts_bp)
```

- [ ] **Step 4: 수동 검증**

```bash
# 포스트 생성
curl -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer <editor_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello", "content": "World", "status": "published"}'

# 목록 조회
curl http://localhost:5000/api/posts
```

- [ ] **Step 5: Commit**

```bash
git add backend/api/posts.py backend/app.py backend/models/schema.py
git commit -m "feat: 포스트 CRUD API (GET/POST/PUT/DELETE /api/posts)"
```

---

### Task 6: 포스트 관리 프론트엔드 페이지

**Files:**
- Create: `frontend/src/api/posts.js`
- Create: `frontend/src/pages/PostList.jsx`
- Create: `frontend/src/pages/PostEditor.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: 포스트 API 클라이언트**

`frontend/src/api/posts.js` 생성:

```js
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const listPosts = () => axios.get(`${BASE_URL}/api/posts`);

export const getPost = (id) => axios.get(`${BASE_URL}/api/posts/${id}`);

export const createPost = (token, data) =>
  axios.post(`${BASE_URL}/api/posts`, data, { headers: authHeader(token) });

export const updatePost = (token, id, data) =>
  axios.put(`${BASE_URL}/api/posts/${id}`, data, { headers: authHeader(token) });

export const deletePost = (token, id) =>
  axios.delete(`${BASE_URL}/api/posts/${id}`, { headers: authHeader(token) });
```

- [ ] **Step 2: 포스트 목록 페이지**

`frontend/src/pages/PostList.jsx` 생성:

```jsx
import { useEffect, useState } from "react";
import { listPosts } from "../api/posts";

export default function PostList() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    listPosts().then((res) => setPosts(res.data.data));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">포스트 목록</h1>
      {posts.map((post) => (
        <div key={post.id} className="border rounded p-4 mb-3">
          <h2 className="text-lg font-semibold">{post.title}</h2>
          <p className="text-sm text-gray-500">{post.created_at}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 라우트 등록**

`frontend/src/App.jsx`에 추가:

```jsx
import PostList from "./pages/PostList";
// <Route path="/posts" element={<PostList />} />
```

- [ ] **Step 4: 브라우저에서 `http://localhost:5173/posts` 확인**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/posts.js frontend/src/pages/PostList.jsx frontend/src/App.jsx
git commit -m "feat: 포스트 목록 프론트엔드 페이지"
```

---

## Chunk 5: 미디어 라이브러리

### Task 7: 파일 업로드 API

**Files:**
- Create: `backend/api/media.py`
- Modify: `backend/app.py`
- Modify: `backend/models/schema.py` (Media.to_dict 추가)

> **참고:** 썸네일 생성은 `Pillow` 라이브러리 사용. `requirements.txt`에 `Pillow` 추가 필요.

- [ ] **Step 1: requirements.txt에 Pillow 추가**

```
Pillow>=10.0.0
```

- [ ] **Step 2: Media.to_dict() 추가**

`backend/models/schema.py`의 `Media` 클래스에 추가:

```python
def to_dict(self) -> dict:
    return {
        "id": self.id,
        "filename": self.filename,
        "filepath": self.filepath,
        "mime_type": self.mime_type,
        "file_size": self.file_size,
        "uploaded_by": self.uploaded_by,
        "created_at": self.created_at.isoformat() if self.created_at else None,
    }
```

- [ ] **Step 3: 미디어 Blueprint 작성**

`backend/api/media.py` 생성:

```python
import os
from flask import Blueprint, request, current_app
from flask_jwt_extended import get_jwt_identity
from PIL import Image
from api.decorators import roles_required
from models.schema import Media
from database import db

media_bp = Blueprint("media", __name__, url_prefix="/api/media")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
UPLOAD_FOLDER = "uploads"
THUMBNAIL_SIZE = (300, 300)


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@media_bp.route("", methods=["POST"])
@roles_required("admin", "editor")
def upload_file() -> tuple[dict, int]:
    if "file" not in request.files:
        return {"success": False, "data": {}, "error": "No file"}, 400
    file = request.files["file"]
    if not file.filename or not _allowed_file(file.filename):
        return {"success": False, "data": {}, "error": "Invalid file type"}, 400

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    # 썸네일 생성
    img = Image.open(filepath)
    img.thumbnail(THUMBNAIL_SIZE)
    thumb_path = os.path.join(UPLOAD_FOLDER, f"thumb_{file.filename}")
    img.save(thumb_path)

    media = Media(
        filename=file.filename,
        filepath=filepath,
        mime_type=file.mimetype,
        file_size=os.path.getsize(filepath),
        uploaded_by=get_jwt_identity(),
    )
    db.session.add(media)
    db.session.commit()
    return {"success": True, "data": media.to_dict(), "error": ""}, 201


@media_bp.route("", methods=["GET"])
@roles_required("admin", "editor")
def list_media() -> tuple[dict, int]:
    from sqlalchemy import select
    items = db.session.execute(select(Media)).scalars().all()
    return {"success": True, "data": [m.to_dict() for m in items], "error": ""}, 200
```

- [ ] **Step 4: Blueprint 등록 및 검증**

```bash
# 파일 업로드 테스트
curl -X POST http://localhost:5000/api/media \
  -H "Authorization: Bearer <editor_token>" \
  -F "file=@/path/to/image.jpg"
# Expected: {"success": true, "data": {"id": 1, "filename": "image.jpg", ...}}
```

- [ ] **Step 5: Commit**

```bash
git add backend/api/media.py backend/app.py backend/models/schema.py requirements.txt
git commit -m "feat: 미디어 업로드 API + 썸네일 자동 생성"
```

---

## Chunk 6: 댓글 시스템

### Task 8: 스레드 방식 대댓글 API

**Files:**
- Create: `backend/api/comments.py`
- Modify: `backend/app.py`
- Modify: `backend/models/schema.py` (Comment.to_dict 추가)

- [ ] **Step 1: Comment.to_dict() 추가**

```python
def to_dict(self) -> dict:
    return {
        "id": self.id,
        "post_id": self.post_id,
        "author_id": self.author_id,
        "parent_id": self.parent_id,
        "content": self.content,
        "status": self.status,
        "created_at": self.created_at.isoformat() if self.created_at else None,
    }
```

- [ ] **Step 2: 댓글 Blueprint 작성**

`backend/api/comments.py` 생성:

```python
from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Comment
from database import db

comments_bp = Blueprint("comments", __name__, url_prefix="/api/comments")

SPAM_KEYWORDS = ["casino", "viagra", "click here", "free money"]


def _is_spam(content: str) -> bool:
    lower = content.lower()
    return any(kw in lower for kw in SPAM_KEYWORDS)


@comments_bp.route("", methods=["POST"])
def create_comment() -> tuple[dict, int]:
    data: dict = request.get_json() or {}
    content: str = data.get("content", "")
    status = "spam" if _is_spam(content) else "pending"

    comment = Comment(
        post_id=data.get("post_id"),
        author_id=data.get("author_id"),
        parent_id=data.get("parent_id"),
        content=content,
        status=status,
    )
    db.session.add(comment)
    db.session.commit()
    return {"success": True, "data": comment.to_dict(), "error": ""}, 201


@comments_bp.route("/post/<int:post_id>", methods=["GET"])
def list_comments(post_id: int) -> tuple[dict, int]:
    comments = db.session.execute(
        select(Comment)
        .where(Comment.post_id == post_id, Comment.status == "approved")
    ).scalars().all()
    return {"success": True, "data": [c.to_dict() for c in comments], "error": ""}, 200


@comments_bp.route("/<int:comment_id>/approve", methods=["PUT"])
@roles_required("admin", "editor")
def approve_comment(comment_id: int) -> tuple[dict, int]:
    comment: Comment | None = db.session.get(Comment, comment_id)
    if not comment:
        return {"success": False, "data": {}, "error": "Not found"}, 404
    comment.status = "approved"
    db.session.commit()
    return {"success": True, "data": comment.to_dict(), "error": ""}, 200
```

- [ ] **Step 3: Blueprint 등록 및 검증**

```bash
# 댓글 작성
curl -X POST http://localhost:5000/api/comments \
  -H "Content-Type: application/json" \
  -d '{"post_id": 1, "content": "좋은 글이에요", "parent_id": null}'
# Expected: {"success": true, "data": {"status": "pending", ...}}

# 스팸 필터 확인
curl -X POST http://localhost:5000/api/comments \
  -H "Content-Type: application/json" \
  -d '{"post_id": 1, "content": "free money casino"}'
# Expected: {"success": true, "data": {"status": "spam", ...}}
```

- [ ] **Step 4: Commit**

```bash
git add backend/api/comments.py backend/app.py backend/models/schema.py
git commit -m "feat: 스레드 대댓글 API + 스팸 필터링"
```

---

## Phase 3: 디자인 및 테마 (UI/UX)

> **목표:** 동적 메뉴 API, 테마 스위칭 아키텍처, 위젯 시스템을 구현한다.
> **선행 조건:** Phase 2 완료

---

## Chunk 7: 동적 메뉴 관리

### Task 9: 메뉴 API

**Files:**
- Create: `backend/api/menus.py`
- Modify: `backend/app.py`

- [ ] **Step 1: 메뉴 Blueprint 작성**

`backend/api/menus.py` 생성:

```python
from flask import Blueprint, request
from sqlalchemy import select
from api.decorators import roles_required
from models.schema import Menu, MenuItem
from database import db

menus_bp = Blueprint("menus", __name__, url_prefix="/api/menus")


@menus_bp.route("", methods=["GET"])
def list_menus() -> tuple[dict, int]:
    menus = db.session.execute(select(Menu)).scalars().all()
    return {
        "success": True,
        "data": [{"id": m.id, "name": m.name} for m in menus],
        "error": ""
    }, 200


@menus_bp.route("/<int:menu_id>/items", methods=["GET"])
def get_menu_items(menu_id: int) -> tuple[dict, int]:
    items = db.session.execute(
        select(MenuItem).where(MenuItem.menu_id == menu_id).order_by(MenuItem.order)
    ).scalars().all()
    return {
        "success": True,
        "data": [{"id": i.id, "label": i.label, "url": i.url, "parent_id": i.parent_id} for i in items],
        "error": ""
    }, 200


@menus_bp.route("", methods=["POST"])
@roles_required("admin")
def create_menu() -> tuple[dict, int]:
    data: dict = request.get_json() or {}
    menu = Menu(name=data.get("name", ""))
    db.session.add(menu)
    db.session.commit()
    return {"success": True, "data": {"id": menu.id, "name": menu.name}, "error": ""}, 201
```

- [ ] **Step 2: Blueprint 등록 및 검증**

```bash
# 메뉴 생성
curl -X POST http://localhost:5000/api/menus \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "주 메뉴"}'

# 메뉴 목록
curl http://localhost:5000/api/menus
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/menus.py backend/app.py
git commit -m "feat: 동적 메뉴 관리 API"
```

---

## Chunk 8: 테마 스위칭 아키텍처

### Task 10: React 테마 컨텍스트

**Files:**
- Create: `frontend/src/context/ThemeContext.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: ThemeContext 작성**

`frontend/src/context/ThemeContext.jsx` 생성:

```jsx
import { createContext, useContext, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("cms-theme") || "light"
  );

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("cms-theme", next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={theme === "dark" ? "dark" : ""}>{children}</div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

- [ ] **Step 2: App.jsx에 ThemeProvider 적용**

```jsx
import { ThemeProvider } from "./context/ThemeContext";

// <ThemeProvider> 로 전체 앱 감싸기
```

- [ ] **Step 3: Tailwind dark mode 설정 확인**

`tailwind.config.js`에 `darkMode: "class"` 설정 확인:

```js
export default {
  darkMode: "class",
  // ...
};
```

- [ ] **Step 4: 브라우저에서 테마 토글 동작 확인**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/ThemeContext.jsx frontend/src/App.jsx
git commit -m "feat: React 테마 스위칭 (라이트/다크) 아키텍처"
```

---

## Chunk 9: 위젯 시스템

### Task 11: 위젯 컴포넌트 시스템

**Files:**
- Create: `frontend/src/components/widgets/RecentPosts.jsx`
- Create: `frontend/src/components/widgets/Sidebar.jsx`

- [ ] **Step 1: RecentPosts 위젯 작성**

`frontend/src/components/widgets/RecentPosts.jsx` 생성:

```jsx
import { useEffect, useState } from "react";
import { listPosts } from "../../api/posts";

export default function RecentPosts({ limit = 5 }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    listPosts().then((res) =>
      setPosts(res.data.data.slice(0, limit))
    );
  }, [limit]);

  return (
    <div className="widget">
      <h3 className="font-bold text-lg mb-2">최근 포스트</h3>
      <ul>
        {posts.map((p) => (
          <li key={p.id} className="py-1 border-b text-sm">
            {p.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Sidebar 컴포넌트 작성**

`frontend/src/components/widgets/Sidebar.jsx` 생성:

```jsx
import RecentPosts from "./RecentPosts";

export default function Sidebar() {
  return (
    <aside className="w-64 p-4 border-l">
      <RecentPosts limit={5} />
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/widgets/
git commit -m "feat: 위젯 시스템 (사이드바 + 최근 포스트)"
```

---

## 전체 진행 로드맵

```
Phase 1 (Core 완성)
  └── Chunk 1: 버그 수정 (CORS, to_dict, PUT /me, axios)
  └── Chunk 2: RBAC 권한 시스템
  └── Chunk 3: 사이트 메타 설정 API

Phase 2 (콘텐츠 관리)
  └── Chunk 4: 포스트 CRUD API + 프론트엔드
  └── Chunk 5: 미디어 업로드 + 썸네일
  └── Chunk 6: 댓글 + 스팸 필터링

Phase 3 (UI/UX)
  └── Chunk 7: 동적 메뉴 API
  └── Chunk 8: 테마 스위칭
  └── Chunk 9: 위젯 시스템
```

---

계획서 완성. 저장 위치: `docs/superpowers/plans/2026-03-24-cms-implementation.md`

**실행 준비가 되셨으면 어떤 Phase부터 시작할지 알려주세요.**
