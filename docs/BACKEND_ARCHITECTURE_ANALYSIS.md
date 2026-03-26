# CMS 백엔드 아키텍처 분석 보고서
## 대형 블로그 플랫폼 규모 서비스 확장 로드맵

**작성일**: 2026-03-26
**분석 대상**: Python 3.11 + Flask + SQLAlchemy 3.x
**현재 환경**: 로컬 Mac Docker (dev 브랜치)

---

## 1. 현재 API 구조 분석

### 1.1 기본 아키텍처

**현재 구조:**
```
app.py (Flask Factory 패턴)
├── api/
│   ├── auth.py        (인증/권한 8개 엔드포인트)
│   ├── posts.py       (포스트 7개 엔드포인트)
│   ├── comments.py    (댓글 5개 엔드포인트, 스팸필터링)
│   ├── media.py       (파일업로드 2개 엔드포인트, 썸네일)
│   ├── admin.py       (관리자 API 6개 엔드포인트)
│   ├── settings.py    (사이트설정 2개 엔드포인트)
│   ├── menus.py       (메뉴 관리)
│   └── decorators.py  (JWT + RBAC 데코레이터)
├── models/schema.py   (8개 모델: User, Post, PostMeta, Media, PostLike, Comment, Menu, MenuItem)
├── database.py        (SQLAlchemy 초기화)
├── config.py          (Dev/Prod 환경설정)
└── extensions.py      (Flask 확장모듈)
```

**Blueprint 등록 방식:** 직선적 등록 (7개 블루프린트)

### 1.2 현재 엔드포인트 현황 (총 30개)

| 카테고리 | 메서드 | 엔드포인트 | 권한 | 기능 |
|---------|--------|-----------|------|------|
| **Auth** | POST | /api/auth/register | 공개 | 회원가입 |
| | POST | /api/auth/login | 공개 | 로그인 |
| | GET | /api/auth/me | JWT | 내정보조회 |
| | PUT | /api/auth/me | JWT | 프로필수정 |
| | GET | /api/auth/users | admin | 전체회원조회 |
| **Posts** | GET | /api/posts | 공개 | 공개글목록 (q, page, per_page) |
| | POST | /api/posts | editor/admin | 글작성 |
| | GET | /api/posts/:id | 공개 | 상세조회 (+view_count) |
| | PUT | /api/posts/:id | 소유자/admin | 수정 |
| | DELETE | /api/posts/:id | 소유자/admin | 삭제 |
| | GET | /api/posts/mine | JWT | 내글목록 |
| | POST | /api/posts/:id/like | editor/admin | 추천토글 |
| **Comments** | POST | /api/comments | 공개 | 댓글작성 (로그인/게스트) |
| | GET | /api/comments/post/:id | 공개 | 포스트댓글목록 |
| | PUT | /api/comments/:id | 소유자 | 댓글수정 |
| | DELETE | /api/comments/:id | admin/소유자 | 댓글삭제 |
| | PUT | /api/comments/:id/approve | admin | 댓글승인 |
| **Media** | POST | /api/media | editor/admin | 파일업로드 |
| | GET | /api/media | editor/admin | 미디어목록 |
| **Settings** | GET | /api/settings | 공개 | 사이트설정(site_skin) |
| | PUT | /api/settings | admin | 설정수정 |
| **Admin** | GET | /api/admin/posts | admin | 전체글관리 (q, status, page) |
| | GET | /api/admin/users | admin | 회원관리 |
| | GET | /api/admin/users/:id/posts | admin | 특정유저글 |
| | PUT | /api/admin/users/:id/role | admin | 권한변경 |
| | PUT | /api/admin/users/:id/deactivate | admin | 비활성화 |
| | DELETE | /api/admin/users/:id | admin | 회원삭제 |
| | GET | /api/admin/comments | admin | 댓글관리 |
| **Menus** | POST/GET | /api/menus | admin | 메뉴관리 |

### 1.3 데이터 모델 분석

**테이블 구조:**
- **User** (id, username, email, password_hash, role, created_at)
- **Post** (id, author_id, title, slug, content, excerpt, status, post_type, created_at, updated_at, view_count, content_format)
- **PostMeta** (id, post_id, meta_key, meta_value) — Custom fields 지원
- **PostLike** (id, post_id, user_id, created_at) — 1인 1추천 (UQ 제약)
- **Comment** (id, post_id, author_id, parent_id, author_name, author_email, author_password_hash, content, status, created_at)
- **Media** (id, uploaded_by, filename, filepath, mimetype, size, meta_data, created_at)
- **Menu / MenuItem** (id, name, location, order) — 계층구조
- **Option** (id, option_name, option_value, autoload) — WordPress wp_options 패턴

### 1.4 강점 (Strengths)

✅ **명확한 Blueprint 구조** — 도메인별 파일 분리로 확장 용이
✅ **공통 응답포맷** — `{ success: bool, data: {}, error: "" }` 통일
✅ **권한 분리 (RBAC)** — `@roles_required` 데코레이터로 깔끔한 구현
✅ **페이지네이션 지원** — Offset 기반 페이지네이션
✅ **소유권 검사** — POST 수정/삭제 시 author_id 확인
✅ **댓글 계층구조** — parent_id로 답글 구현
✅ **파일 스토리지 추상화** — LocalStorage/R2 전환 가능한 구조
✅ **콘텐츠 포맷 지원** — HTML/Markdown 분기 (`content_format`)
✅ **스팸필터링** — 키워드 기반 댓글 스팸검사
✅ **자동 마이그레이션** — Flask-Migrate로 DB 버전관리

### 1.5 약점 (Weaknesses)

⚠️ **캐싱 부재** — 인기 포스트, 댓글 수 등 집계값이 매번 계산
⚠️ **N+1 쿼리 문제** — list_posts()에서 author_username을 outerjoin으로만 처리 (여전히 최적화 여지)
⚠️ **검색 기능 미흡** — title 키워드만 지원 (태그/카테고리/작성자 검색 없음)
⚠️ **인덱스 부족** — DB 스키마에서 복합 인덱스 없음 (status + created_at, author_id + created_at 등)
⚠️ **Pagination 한계** — Offset 기반 → 대용량 데이터에서 성능 저하
⚠️ **실시간 기능 없음** — WebSocket/SSE 미지원 (알림, 실시간 댓글 등)
⚠️ **레이트 제한 없음** — API 남용 방지 기능 부재
⚠️ **로깅 미흡** — print()만 사용 → 프로덕션 운영 어려움
⚠️ **API 문서화 없음** — Swagger/OpenAPI 미지원
⚠️ **테스트 미확인** — 유닛테스트/통합테스트 코드 없음

---

## 2. 대형 블로그 플랫폼 핵심 기능 분석

### 2.1 핵심 도메인 7가지

| 도메인 | 대형 블로그 플랫폼 기능 | 현재 CMS 상태 | 확장 필요도 |
|--------|------------------|-------------|----------|
| **1. 유저 블로그** | 유저별 개인 블로그 (`/blog/:username`) | ❌ 미구현 | ⭐⭐⭐⭐⭐ |
| **2. 카테고리/태그** | 포스트 분류 + 태그클라우드 | ❌ 미구현 (PostMeta로 가능) | ⭐⭐⭐⭐ |
| **3. 구독/이웃** | 팔로우 시스템 | ❌ 미구현 | ⭐⭐⭐⭐ |
| **4. 포스트 시리즈** | 시리즈로 묶인 포스트 | ❌ 미구현 | ⭐⭐⭐ |
| **5. 알림 시스템** | 댓글/이웃 구독 알림 (실시간) | ❌ 미구현 | ⭐⭐⭐⭐⭐ |
| **6. 블로그 통계** | 방문자통계, 포스트별 분석 | ⚠️ 기초만 (view_count) | ⭐⭐⭐ |
| **7. RSS/Atom 피드** | 콘텐츠 배포 | ❌ 미구현 | ⭐⭐⭐ |

---

## 3. 신규 API 엔드포인트 설계

### 3.1 유저 블로그 API (`/api/blog/` 도메인)

**목표:** 개별 유저의 블로그 페이지 구성
**핵심 엔드포인트:**

```http
GET /api/blog/:username
→ 응답: {
    user: { id, username, bio, avatar_url, created_at },
    blog_title: string,
    blog_description: string,
    statistics: { total_posts, total_views, total_comments },
    skin: string,
  }

GET /api/blog/:username/posts?category=&tag=&page=1&per_page=20
→ published 포스트 목록 + 카테고리/태그 필터

GET /api/blog/:username/categories
→ 포스트 분류 목록 (계산된 count 포함)

GET /api/blog/:username/tags
→ 태그클라우드 (count 기반 가중치)

GET /api/blog/:username/stats
→ { total_posts, total_views, average_views_per_post, most_viewed_post }
```

**DB 변경사항:**
```python
# User 모델 추가 컬럼
class User(Base):
    bio: Mapped[Optional[str]]
    avatar_url: Mapped[Optional[str]]
    blog_title: Mapped[Optional[str]]  # 커스텀 블로그 제목
    blog_description: Mapped[Optional[str]]
    # ...
```

---

### 3.2 카테고리 & 태그 API (`/api/categories/`, `/api/tags/`)

**목표:** 포스트 분류 및 검색 개선

```http
# 카테고리 API
POST /api/categories (admin)
→ { slug: string, name: string, description: string }

GET /api/categories
→ [{ id, slug, name, post_count }]

GET /api/categories/:slug/posts?page=1&per_page=20
→ 카테고리별 포스트 목록

# 태그 API
GET /api/tags
→ [{ id, name, post_count }] (클라우드용)

GET /api/tags/:name/posts?page=1&per_page=20
→ 태그별 포스트 목록

# 포스트에 태그 추가
PUT /api/posts/:id/tags
→ { tags: ["JavaScript", "React"] }
```

**DB 스키마:**
```python
class Category(Base):
    __tablename__ = 'categories'
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)

class Tag(Base):
    __tablename__ = 'tags'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)

class PostTag(Base):  # 다:다 관계
    __tablename__ = 'post_tags'
    post_id: Mapped[int] = mapped_column(ForeignKey('posts.id', ondelete='CASCADE'))
    tag_id: Mapped[int] = mapped_column(ForeignKey('tags.id', ondelete='CASCADE'))
    __table_args__ = (UniqueConstraint('post_id', 'tag_id'),)

# Post 모델 추가
class Post(Base):
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey('categories.id'))
    tags: Mapped[List["Tag"]] = relationship(secondary="post_tags")
```

---

### 3.3 구독/이웃 API (`/api/followers/`, `/api/subscriptions/`)

**목표:** 팔로우 시스템 (대형 블로그 플랫폼 "이웃 추가", "구독")

```http
POST /api/users/:id/follow (JWT 필수)
→ 이웃 추가 (토글)

GET /api/users/:id/followers?page=1&per_page=20
→ 이웃 목록

GET /api/users/:id/following?page=1&per_page=20
→ 구독 중인 유저 목록

GET /api/feed?page=1&per_page=20 (JWT 필수)
→ 팔로우 유저들의 최신 포스트 피드
```

**DB 스키마:**
```python
class Follow(Base):  # 누가 누구를 팔로우하는가
    __tablename__ = 'follows'
    follower_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    following_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('follower_id', 'following_id'),)
```

---

### 3.4 포스트 시리즈 API (`/api/series/`)

**목표:** 연속된 포스트를 시리즈로 관리

```http
POST /api/series (editor/admin)
→ { title: string, description: string }

GET /api/series?page=1&per_page=20
→ 시리즈 목록

GET /api/series/:id?page=1&per_page=20
→ 시리즈 내 포스트 목록 (순서대로)

PUT /api/posts/:id/series
→ { series_id: number, order: number }
```

**DB 스키마:**
```python
class Series(Base):
    __tablename__ = 'series'
    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

# Post 모델 추가
class Post(Base):
    series_id: Mapped[Optional[int]] = mapped_column(ForeignKey('series.id'))
    series_order: Mapped[Optional[int]] = mapped_column(Integer)  # 시리즈 내 순서
```

---

### 3.5 알림 API (`/api/notifications/`)

**목표:** 실시간 알림 시스템 (WebSocket + 폴링 겸용)

```http
GET /api/notifications?page=1&per_page=20 (JWT)
→ 알림 목록 (최신순, read 상태 포함)

PUT /api/notifications/:id/read (JWT)
→ 알림 읽음 처리

PUT /api/notifications/read-all (JWT)
→ 모든 알림 일괄 읽음

DELETE /api/notifications/:id (JWT)
→ 알림 삭제

WebSocket: ws://localhost:5000/ws/notifications?token=JWT
→ 실시간 알림 스트림
```

**DB 스키마:**
```python
class Notification(Base):
    __tablename__ = 'notifications'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'))  # 누가 했는가
    action_type: Mapped[str]  # 'comment', 'like', 'follow', 'post_publish'
    post_id: Mapped[Optional[int]] = mapped_column(ForeignKey('posts.id', ondelete='CASCADE'))
    comment_id: Mapped[Optional[int]] = mapped_column(ForeignKey('comments.id', ondelete='CASCADE'))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

---

### 3.6 포스트 스케줄링 개선 API

**현재:** status = 'scheduled'만 존재 (실제 발행 로직 없음)
**개선:**

```http
POST /api/posts/:id/schedule (editor/admin)
→ { scheduled_at: ISO8601 datetime }

GET /api/posts/scheduled (admin)
→ 예약된 포스트 목록

# 자동 발행을 위한 백그라운드 작업
# → Celery + Redis로 스케줄링
```

---

### 3.7 검색 & 필터 API 개선

**현재:** title 키워드 검색만 지원
**개선:**

```http
GET /api/posts/search?q=&author=&category=&tags=&status=&sort=recent|popular|relevant&page=1
→ 통합 검색 + 다중 필터

# Elasticsearch 또는 전문검색 (Full-Text Search)
# MySQL FULLTEXT INDEX 활용
```

---

### 3.8 블로그 통계 API (`/api/blog/:username/stats/`)

```http
GET /api/blog/:username/stats
→ {
    total_posts: number,
    total_views: number,
    total_comments: number,
    avg_views_per_post: number,
    most_viewed_post: { id, title, views }
  }

GET /api/blog/:username/stats/daily?days=30
→ 일별 방문통계 (차트용)

GET /api/posts/:id/stats
→ {
    views: number,
    likes: number,
    comments: number,
    engagement_rate: float
  }
```

---

### 3.9 RSS/Atom 피드 API

```http
GET /blog/:username/feed.xml
→ RSS 2.0 피드 (최근 20개 포스트)

GET /blog/:username/atom.xml
→ Atom 1.0 피드

GET /api/feed/rss.xml
→ 플랫폼 전체 공개 포스트 피드
```

---

## 4. 아키텍처 개선 방안

### 4.1 Blueprint 구조 재편성

**현재:**
```
api/
├── auth.py
├── posts.py
├── comments.py
├── admin.py
└── ...
```

**개선 안 (도메인 중심):**
```
api/
├── auth/
│   ├── __init__.py
│   ├── routes.py      # 인증 엔드포인트
│   ├── schemas.py     # 요청/응답 Pydantic (선택)
│   └── services.py    # 비즈니스 로직
├── blog/
│   ├── __init__.py
│   ├── routes.py
│   ├── services.py
│   └── models.py      # 블로그 관련 쿼리
├── posts/
│   ├── __init__.py
│   ├── routes.py
│   └── services.py
├── comments/
│   ├── __init__.py
│   └── routes.py
├── notifications/
│   ├── __init__.py
│   └── routes.py
├── search/
│   ├── __init__.py
│   └── routes.py
└── common/
    ├── decorators.py
    ├── errors.py
    └── middleware.py
```

**장점:**
- 도메인별 독립적 개발
- 테스트 용이
- 마이크로서비스 분리 가능

### 4.2 계층 분리 (Repository Pattern)

**목표:** ORM 의존성 줄이기

```python
# api/posts/repositories.py
class PostRepository:
    @staticmethod
    def find_by_id(post_id: int) -> Post:
        return db.session.get(Post, post_id)

    @staticmethod
    def list_published(page: int, per_page: int):
        return db.session.execute(
            select(Post).where(Post.status == 'published')
            .order_by(Post.created_at.desc())
            .offset((page-1) * per_page)
            .limit(per_page)
        ).scalars().all()

# api/posts/services.py
class PostService:
    def __init__(self, repo: PostRepository = None):
        self.repo = repo or PostRepository()

    def get_post_with_stats(self, post_id: int):
        post = self.repo.find_by_id(post_id)
        # 캐시 확인 → 없으면 계산 → 캐시 저장
        stats = self._get_or_compute_stats(post_id)
        return {**post.to_dict(), **stats}

    def _get_or_compute_stats(self, post_id: int):
        # Redis에서 조회, 없으면 DB 집계
        pass

# api/posts/routes.py
@posts_bp.route('/<int:post_id>')
def get_post(post_id: int):
    post = PostService().get_post_with_stats(post_id)
    return jsonify({"success": True, "data": post})
```

### 4.3 에러 처리 표준화

**현재:** 각 함수별로 다른 에러 반환

**개선:**
```python
# api/common/errors.py
class APIException(Exception):
    def __init__(self, message: str, status_code: int = 400, data=None):
        self.message = message
        self.status_code = status_code
        self.data = data

class NotFoundError(APIException):
    def __init__(self, resource: str):
        super().__init__(f"{resource} not found", 404)

class UnauthorizedError(APIException):
    def __init__(self):
        super().__init__("Unauthorized", 401)

# app.py에 글로벌 에러핸들러
@app.errorhandler(APIException)
def handle_api_error(error):
    return jsonify({
        "success": False,
        "data": error.data or {},
        "error": error.message
    }), error.status_code
```

### 4.4 요청/응답 스키마 (Pydantic 도입)

```python
# api/posts/schemas.py
from pydantic import BaseModel, Field

class CreatePostRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(default="")
    excerpt: Optional[str] = None
    content_format: Literal["html", "markdown"] = "html"
    status: Literal["draft", "published", "scheduled"] = "draft"

class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    author_username: str
    view_count: int
    like_count: int
    comment_count: int
    created_at: str

    class Config:
        from_attributes = True

# routes.py에서
from pydantic import ValidationError

@posts_bp.route("", methods=["POST"])
@roles_required("editor", "admin")
def create_post():
    try:
        req = CreatePostRequest(**request.get_json())
    except ValidationError as e:
        return jsonify({"success": False, "data": {}, "error": str(e)}), 400

    # ...
```

---

## 5. 캐싱 전략 (Redis)

### 5.1 캐싱 대상 식별

| 대상 | TTL | 전략 | 예상 효과 |
|-----|-----|------|---------|
| 인기 포스트 목록 | 5분 | `cache.get('posts:published:page:1')` | DB 쿼리 60% 감소 |
| 포스트 상세 (view_count, like_count) | 1분 | Write-Through | 조회 성능 10배 |
| 사용자 정보 | 10분 | `cache.get('user:{id}')` | 권한 확인 속도 향상 |
| 태그/카테고리 목록 | 1시간 | 거의 변경 없음 | 클라우드 생성 가속화 |
| 블로그 통계 | 1시간 | 배경 작업 갱신 | 실시간 계산 제거 |
| 댓글 목록 | 3분 | `cache.get('post:{id}:comments:page:1')` | 댓글 조회 가속화 |
| 검색 결과 | 30초 | 사용자별 키 분리 | 반복 검색 최적화 |

### 5.2 Redis 활용 코드 예시

```python
# config.py
class Config:
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# extensions.py
from flask_caching import Cache

cache = Cache(app, config={'CACHE_TYPE': 'redis', 'CACHE_REDIS_URL': app.config['REDIS_URL']})

# api/posts/services.py
from extensions import cache

class PostService:
    @staticmethod
    @cache.cached(timeout=300, key_prefix='posts:published')
    def list_published(page: int, per_page: int):
        return db.session.execute(
            select(Post).where(Post.status == 'published')
            .order_by(Post.created_at.desc())
            .offset((page-1) * per_page)
            .limit(per_page)
        ).scalars().all()

    @staticmethod
    def get_post_stats(post_id: int):
        """캐시된 포스트 통계"""
        cache_key = f'post:{post_id}:stats'
        cached = cache.get(cache_key)
        if cached:
            return cached

        stats = {
            'view_count': db.session.execute(
                select(Post.view_count).where(Post.id == post_id)
            ).scalar() or 0,
            'like_count': db.session.execute(
                select(func.count(PostLike.id)).where(PostLike.post_id == post_id)
            ).scalar() or 0,
            'comment_count': db.session.execute(
                select(func.count(Comment.id))
                .where(Comment.post_id == post_id, Comment.status == 'approved')
            ).scalar() or 0,
        }
        cache.set(cache_key, stats, timeout=60)
        return stats

# 캐시 무효화 (포스트 수정 시)
def update_post(post_id: int, data: dict):
    post = db.session.get(Post, post_id)
    # ... 수정 로직 ...
    db.session.commit()

    # 캐시 무효화
    cache.delete(f'post:{post_id}:stats')
    cache.delete('posts:published')  # 목록도 무효화
```

### 5.3 캐시 워밍 (Background Tasks)

```python
# 서버 시작 시 인기 포스트 미리 캐싱
# Celery task로 주기적 갱신
@app.cli.command()
def warm_cache():
    """인기 포스트 캐시 사전 로드"""
    posts = PostService.list_published(1, 20)
    for post in posts:
        cache.set(f'post:{post.id}:stats',
                 PostService.get_post_stats(post.id),
                 timeout=3600)
    print("Cache warmed!")
```

---

## 6. 실시간 기능 구현

### 6.1 WebSocket 기반 알림 (Socket.IO)

```python
# requirements.txt에 추가
python-socketio>=5.7.0
python-engineio>=4.5.0

# notifications.py
from flask_socketio import SocketIO, emit, join_room, leave_room

socketio = SocketIO(app, cors_allowed_origins="*")

@socketio.on('connect')
def on_connect(auth):
    token = auth.get('token')
    user_id = decode_jwt(token)  # JWT 검증
    join_room(f'user:{user_id}')  # 유저별 room 입장
    emit('connected', {'data': 'Connected to notifications'})

@socketio.on('disconnect')
def on_disconnect():
    emit('disconnected', {'data': 'Disconnected'})

# 알림 발송 함수
def notify_user(user_id: int, notification_type: str, payload: dict):
    """유저에게 실시간 알림 발송"""
    socketio.emit(
        'notification',
        {'type': notification_type, 'payload': payload},
        room=f'user:{user_id}'
    )

# API에서 사용
# → 댓글 작성 시
def create_comment(...):
    comment = Comment(...)
    db.session.add(comment)
    db.session.commit()

    # 포스트 작성자에게 알림
    notify_user(comment.post.author_id, 'new_comment', {
        'post_id': comment.post_id,
        'comment_id': comment.id,
        'author': comment.author_name
    })

    # DB에도 저장
    Notification.create(
        user_id=comment.post.author_id,
        action_type='comment',
        post_id=comment.post_id,
        comment_id=comment.id
    )
```

### 6.2 폴링 기반 알림 (낮은 우선순위)

```python
# WebSocket 미지원 환경용 대체 수단
GET /api/notifications/unread-count (JWT)
→ { unread_count: number }

GET /api/notifications?since=<timestamp>
→ 해당 시간 이후 신규 알림
```

---

## 7. 데이터베이스 성능 최적화

### 7.1 필수 인덱스 추가

```sql
-- 포스트 목록 조회 성능
ALTER TABLE posts ADD INDEX idx_status_created (status, created_at DESC);

-- 사용자별 포스트
ALTER TABLE posts ADD INDEX idx_author_status (author_id, status);

-- 댓글 조회
ALTER TABLE comments ADD INDEX idx_post_status (post_id, status);

-- 팔로우 관계 조회 (추가 예정)
ALTER TABLE follows ADD INDEX idx_follower (follower_id);
ALTER TABLE follows ADD INDEX idx_following (following_id);

-- 태그별 포스트 (추가 예정)
ALTER TABLE post_tags ADD INDEX idx_tag_id (tag_id);
```

### 7.2 쿼리 최적화

**현재 문제:**
```python
# ❌ 비효율: 매번 댓글 수, 추천 수 계산
comment_count = db.session.execute(...).scalar()
like_count = db.session.execute(...).scalar()
```

**개선:**
```python
# ✅ Denormalization: Post 테이블에 컬럼 추가
class Post(Base):
    comment_count: Mapped[int] = mapped_column(Integer, default=0)  # 캐시
    like_count: Mapped[int] = mapped_column(Integer, default=0)    # 캐시

# 트리거 또는 애플리케이션에서 관리
# trigger는 권장하지 않음 → 애플리케이션에서 명시적으로 관리
def create_comment(...):
    post = db.session.get(Post, comment.post_id)
    post.comment_count += 1
    db.session.commit()
```

### 7.3 배치 처리

```python
# 여러 포스트의 통계를 한 번에 조회
def get_posts_with_stats(post_ids: list):
    """N+1 쿼리 방지"""
    # 댓글 수 한 번에 조회
    comment_counts = db.session.execute(
        select(Comment.post_id, func.count(Comment.id).label('cnt'))
        .where(Comment.post_id.in_(post_ids))
        .where(Comment.status == 'approved')
        .group_by(Comment.post_id)
    ).all()
    comment_map = {post_id: cnt for post_id, cnt in comment_counts}

    # 추천 수 한 번에 조회
    like_counts = db.session.execute(
        select(PostLike.post_id, func.count(PostLike.id).label('cnt'))
        .where(PostLike.post_id.in_(post_ids))
        .group_by(PostLike.post_id)
    ).all()
    like_map = {post_id: cnt for post_id, cnt in like_counts}

    # 포스트 조회
    posts = db.session.execute(
        select(Post).where(Post.id.in_(post_ids))
    ).scalars().all()

    # 결합
    return [
        {**p.to_dict(),
         'comment_count': comment_map.get(p.id, 0),
         'like_count': like_map.get(p.id, 0)}
        for p in posts
    ]
```

---

## 8. API 문서화 & 모니터링

### 8.1 Swagger (OpenAPI) 통합

```python
# requirements.txt
flasgger>=0.9.5

# app.py
from flasgger import Swagger

swagger = Swagger(app)

# routes.py 예시
@posts_bp.route('/<int:post_id>', methods=['GET'])
def get_post(post_id: int):
    """
    포스트 상세 조회
    ---
    parameters:
      - name: post_id
        in: path
        required: true
        type: integer
      - name: skip_count
        in: query
        type: boolean
        description: view_count 증가 생략 여부
    responses:
      200:
        description: 포스트 정보
        schema:
          properties:
            success:
              type: boolean
            data:
              type: object
              properties:
                id:
                  type: integer
                title:
                  type: string
      404:
        description: 포스트 없음
    """
    # ...
```

### 8.2 로깅 (Structlog)

```python
# requirements.txt
structlog>=23.1.0

# logging_config.py
import structlog
import logging

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

# routes.py에서 사용
logger = structlog.get_logger()

@posts_bp.route('/<int:post_id>', methods=['GET'])
def get_post(post_id: int):
    logger.info("post.view", post_id=post_id, user_id=current_user_id)
    # ...
    logger.error("post.not_found", post_id=post_id, status_code=404)
```

---

## 9. 테스트 전략

### 9.1 유닛 테스트

```python
# tests/test_posts.py
import pytest
from app import create_app
from database import db
from models.schema import User, Post

@pytest.fixture
def app():
    app = create_app('testing')  # 테스트 환경
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_create_post(client):
    """포스트 작성 테스트"""
    # 유저 생성
    user = User(username='testuser', email='test@example.com')
    user.set_password('password')
    db.session.add(user)
    db.session.commit()

    # 로그인
    login_response = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'password'
    })
    token = login_response.json['data']['access_token']

    # 포스트 생성
    response = client.post('/api/posts',
        json={'title': 'Test Post', 'content': 'Hello'},
        headers={'Authorization': f'Bearer {token}'}
    )

    assert response.status_code == 201
    assert response.json['success']
    assert response.json['data']['title'] == 'Test Post'
```

---

## 10. 구현 우선순위 로드맵

### Phase 1: 기초 인프라 (1-2주)
**목표:** 성능 기초 다지기 + 아키텍처 개선

- [ ] **1.1** Redis 도입 & 캐싱 전략 구현
  - 설정: REDIS_URL 환경변수
  - 대상: 포스트 목록, 포스트 통계, 사용자 정보
  - 검증: 캐시 Hit Rate 50% 이상 확인

- [ ] **1.2** DB 인덱스 추가
  - `posts(status, created_at)`, `posts(author_id, status)`
  - `comments(post_id, status)`, `follows` 준비
  - 검증: 쿼리 성능 10배 향상 확인

- [ ] **1.3** API 에러 처리 표준화
  - `APIException` 기본 클래스 생성
  - 글로벌 에러핸들러 추가
  - 기존 API 리팩토링 (posts.py, comments.py)

- [ ] **1.4** Pydantic 스키마 도입
  - 요청/응답 검증
  - API 문서화 자동화 준비

### Phase 2: 핵심 기능 (2-3주)
**목표:** 대형 블로그 플랫폼 핵심 기능 구현

- [ ] **2.1** 유저 블로그 API (`/api/blog/:username`)
  - User 모델: bio, avatar_url, blog_title 추가
  - 엔드포인트: GET /api/blog/:username, /posts, /categories, /tags
  - DB 마이그레이션: 4개 컬럼 추가
  - 검증: 블로그 페이지 렌더링 테스트

- [ ] **2.2** 카테고리 & 태그 시스템
  - 모델: Category, Tag, PostTag 생성
  - 엔드포인트: POST/GET /api/categories, /api/tags
  - 인덱스: tag_id, post_id 복합인덱스
  - 검증: 태그클라우드 성능 (100개 태그 < 100ms)

- [ ] **2.3** 구독/이웃 API
  - 모델: Follow 테이블
  - 엔드포인트: POST /api/users/:id/follow, GET /api/feed
  - 캐싱: 피드 30초 캐시
  - 검증: 팔로우 토글 + 피드 조회 동작

- [ ] **2.4** 포스트 시리즈 API
  - 모델: Series, Post.series_id 추가
  - 엔드포인트: POST/GET /api/series/:id/posts
  - UI: 시리즈 목록, 이전/다음 포스트 링크
  - 검증: 시리즈 내 순서 정렬 동작

### Phase 3: 실시간 & 고급 기능 (3-4주)
**목표:** 실시간 기능 + 검색/분석

- [ ] **3.1** 알림 시스템
  - 모델: Notification 생성
  - API: GET /api/notifications, PUT /api/notifications/:id/read
  - WebSocket: Socket.IO로 실시간 알림
  - 검증: 댓글 작성 시 실시간 알림 수신 확인

- [ ] **3.2** 고급 검색
  - Elasticsearch 또는 MySQL FULLTEXT INDEX
  - 엔드포인트: GET /api/posts/search?q=&author=&category=&tags=&sort=
  - 캐싱: 검색결과 30초 캐시
  - 검증: 복합 필터 검색 < 500ms

- [ ] **3.3** 블로그 통계
  - 엔드포인트: GET /api/blog/:username/stats, /stats/daily
  - Denormalization: Post 테이블 comment_count, like_count 추가
  - 백그라운드: 매시간 통계 갱신 (Celery)
  - 검증: 통계 데이터 정확도 확인

- [ ] **3.4** RSS/Atom 피드
  - 라이브러리: python-feedgen
  - 엔드포인트: GET /blog/:username/feed.xml, /blog/:username/atom.xml
  - 캐싱: RSS 피드 5분 캐시
  - 검증: RSS 리더기에서 구독 가능 확인

### Phase 4: 운영 & 최적화 (진행 중)
**목표:** 모니터링 + 보안 + 성능 튜닝

- [ ] **4.1** 모니터링 & 로깅
  - Structlog: 구조화된 로그 (JSON)
  - Sentry: 에러 추적
  - Datadog/New Relic: APM 모니터링
  - 검증: API 응답시간, DB 쿼리 시간 추적

- [ ] **4.2** API 문서화
  - Flasgger (Swagger) 통합
  - 모든 엔드포인트 문서화
  - /api/docs 페이지에서 interactive API 테스트

- [ ] **4.3** 보안 강화
  - Rate Limiting: Flask-Limiter
  - CSRF 보호: Flask-WTF (선택)
  - 입력 검증: Pydantic 스키마
  - SQL Injection 방지: SQLAlchemy ORM 사용 (이미 구현)

- [ ] **4.4** 성능 튜닝
  - Query profiling: SQLAlchemy echo, query logs
  - Slow query log 분석
  - N+1 쿼리 최적화 (배치 처리)
  - DB connection pool 튜닝

### 마일스톤

| 마일스톤 | 목표 | 예상 일정 |
|---------|------|---------|
| **M1: 인프라** | Redis 캐싱, 인덱스 추가, 에러처리 표준화 | 1-2주 |
| **M2: 핵심 기능** | 유저블로그, 카테고리/태그, 구독, 시리즈 | 2-3주 |
| **M3: 실시간** | WebSocket 알림, 고급검색, 통계, RSS | 3-4주 |
| **M4: 운영** | 모니터링, 문서화, 보안, 튜닝 | 지속 |

---

## 11. 성능 목표 (SLA)

| 지표 | 현재 | 목표 | 달성 방법 |
|-----|------|------|---------|
| 포스트 목록 조회 | ~500ms | <100ms | Redis 캐싱 |
| 포스트 상세 조회 | ~200ms | <50ms | 쿼리 최적화 + 캐싱 |
| 댓글 작성 | ~300ms | <100ms | 배치 처리 + 트랜잭션 최적화 |
| 검색 | ~2000ms | <500ms | Elasticsearch 또는 FULLTEXT INDEX |
| 캐시 Hit Rate | 0% | 50%+ | 캐싱 전략 |
| API 99th percentile latency | - | <500ms | 모니터링 + 최적화 |

---

## 12. 기술 스택 확장

### 추가 라이브러리

```txt
# 캐싱
redis>=4.0.0
flask-caching>=2.0.0

# 실시간
python-socketio>=5.7.0
python-engineio>=4.5.0

# 검색 (선택)
elasticsearch>=8.0.0
# OR
# MySQL FULLTEXT는 기존 구조에서 사용 가능

# 로깅
structlog>=23.1.0
python-json-logger>=2.0.0

# API 문서화
flasgger>=0.9.5

# 데이터 검증
pydantic>=2.0.0

# 백그라운드 작업 (선택)
celery>=5.0.0
redis>=4.0.0

# 모니터링 (선택)
sentry-sdk>=1.0.0
```

### 배포 구조 개선

```dockerfile
# Dockerfile.prod 개선
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY ../backend .

# Gunicorn + Redis 클라이언트
CMD ["gunicorn", "--workers=4", "--worker-class=sync", \
     "--bind=0.0.0.0:5000", "--timeout=60", "--access-logfile=-", \
     "app:create_app()"]
```

---

## 13. 주요 결정 사항 & 트레이드오프

### 13.1 검색 솔루션

**옵션 1: MySQL FULLTEXT INDEX** (권장)
- ✅ 추가 인프라 불필요
- ✅ 트랜잭션 일관성 보장
- ❌ 복잡한 쿼리 제한

**옵션 2: Elasticsearch**
- ✅ 강력한 검색 기능 (패턴, 분석)
- ❌ 추가 인프라 (메모리 2GB+)
- ❌ 인덱싱 지연 (최대 1초)

**선택:** Phase 3에서 MySQL FULLTEXT로 시작, 필요시 Elasticsearch 전환

### 13.2 실시간 통신

**옵션 1: WebSocket (Socket.IO)** (권장)
- ✅ 실시간 양방향 통신
- ❌ 브라우저 호환성 고려 필요
- ❌ 상태 관리 복잡

**옵션 2: Server-Sent Events (SSE)**
- ✅ 단순한 구현
- ❌ 클라이언트→서버 통신 불가
- ❌ 폴링보다 나을뿐 양방향 아님

**선택:** Socket.IO로 구현, SSE는 폴링으로 대체 가능

### 13.3 백그라운드 작업

**옵션 1: Celery + Redis** (권장)
- ✅ 분산 작업 처리
- ❌ 추가 인프라
- ❌ 디버깅 어려움

**옵션 2: APScheduler**
- ✅ 단순한 스케줄링
- ❌ 단일 프로세스만 지원
- ❌ 스케일링 불가능

**선택:** Phase 4에서 APScheduler로 시작, Celery 전환 고려

---

## 14. 마이그레이션 전략

### 14.1 DB 마이그레이션 (무중단)

**기존 테이블 변경 방식:**
```bash
# 1. 새 컬럼 추가 (nullable)
flask db migrate -m "Add user bio column"
flask db upgrade

# 2. 배경에서 데이터 채우기
flask fill-user-bio  # 커스텀 커맨드

# 3. 제약조건 추가 (nullable 제거)
flask db migrate -m "Make user bio not null"
flask db upgrade
```

**신규 테이블 추가:**
```bash
# Follow, Category, Tag 등은 새 테이블이므로 직접 추가
flask db migrate -m "Add follow table for subscriptions"
flask db upgrade
```

### 14.2 API 버전관리 (선택)

```python
# 기존: /api/posts
# v2: /api/v2/posts

app.register_blueprint(posts_bp, url_prefix='/api/posts')      # v1 (deprecated)
app.register_blueprint(posts_bp_v2, url_prefix='/api/v2/posts') # v2 (new)

# 클라이언트 전환 기간 (2-4주)
# - v1 응답 헤더에 Deprecation 경고
# - v2 문서화 공개
# - v2로 마이그레이션 안내
```

---

## 15. 예상 성능 개선

### 현재 상태
```
초당 처리량 (RPS): ~10-20
응답시간: 200-500ms
캐시 Hit Rate: 0%
DB 연결: 10개
```

### 개선 후
```
초당 처리량 (RPS): ~100-200 (+10배)
응답시간: 50-100ms (평균)
캐시 Hit Rate: 60%+
DB 연결: 20개 (풀링 최적화)
```

---

## 16. 결론 & 추천사항

### 즉시 실행 (1주)
1. ✅ **Redis 캐싱** - 가장 빠른 성능 개선
2. ✅ **DB 인덱스** - 저비용 고효과
3. ✅ **에러 처리 표준화** - 코드 품질 향상

### 단기 (1-2개월)
4. ✅ **유저 블로그 API** - 핵심 기능
5. ✅ **카테고리/태그** - 관리 기능
6. ✅ **구독 시스템** - 참여도 증대

### 중기 (2-4개월)
7. ✅ **실시간 알림** - UX 개선
8. ✅ **고급 검색** - 사용성 향상
9. ✅ **통계 API** - 분석 기능

### 장기 (지속)
10. ✅ **마이크로서비스 분리** - 확장성
11. ✅ **GraphQL 지원** - API 다양성
12. ✅ **모바일 앱 API** - 플랫폼 확장

---

**다음 단계:** Phase 1 인프라 작업 시작 → Redis 도입 → 성능 측정 → Phase 2 기능 개발
