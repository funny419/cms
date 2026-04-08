## 아키텍처

| 구분 | 기술 |
|------|------|
| Frontend | React 19 + Vite + CSS Variables (Tailwind 미설치) |
| Backend | Python 3.11 + Flask + Flask-SQLAlchemy 3.x (SQLAlchemy 2.x 스타일 쿼리) + Flask-JWT-Extended |
| Database | MariaDB 10.11 |
| 로컬 개발 포트 | FE: 5173, BE: 5000, DB: 4807 |

**Docker 서비스 구성 (개발):**

| 컨테이너 | 역할 | 포트 |
|---------|------|------|
| `cms_backend` | Flask API | 5000 |
| `cms_db` | MariaDB | 4807 |
| `cms_frontend` | Vite 개발 서버 | 5173 |
| `cms_nginx_files` | 업로드 파일 전용 Nginx | 내부전용 (외부 미노출) |

**권한 체계 (Role):**
- `admin` — 전체 포스트/회원 관리, Admin 대시보드 (`/admin/*`) 접근, 사이트 스킨 설정
- `editor` — 본인 글만 작성/수정/삭제, 내 블로그 (`/my-posts`) 접근 (회원가입 시 기본)
- `deactivated` — 로그인 차단 (기존 JWT도 roles_required에서 자동 차단)

**로그인 후 분기:** admin → `/admin/posts`, editor → `/my-posts`

**포스트 소유권:** PUT/DELETE `/api/posts/:id` — admin은 모두, editor는 본인 글(`author_id == 현재 유저`)만 가능. 위반 시 403.

---

## 코딩 표준

### Backend (Python/Flask)

- **Import**: Docker 빌드 시 `backend/` 파일이 `/app` 루트로 복사 → `backend.` 접두사 생략
- **Blueprint 패턴**: 도메인별 파일 분리 (`api/auth.py`, `api/posts.py`, `api/admin.py` 등)
- **타입 힌트**: 모든 함수에 필수
- **응답 포맷**: 항상 `{ "success": bool, "data": {}, "error": str }`
- **DB 쿼리**: SQLAlchemy 2.x 스타일 (`select()`, `db.session.get()`, `scalar_one_or_none()`)
- **JWT identity**: `create_access_token(identity=str(user.id))` — 반드시 문자열
  - 조회 시: `int(get_jwt_identity())`
- **requirements.txt**: 새 패키지 추가 시 즉시 반영 후 `--no-cache` 재빌드
- **Gunicorn Entry**: `app.py`에 `app = create_app()` 최하단 선언 필요
- **린팅/타입체크**: `ruff`(lint+format), `mypy`(type check), `pytest` — requirements.txt에 포함, Docker 내부에서 실행
  - ruff 설정: `backend/pyproject.toml` (`migrations/` 제외, line-length=100)
  - Docker 내부 경로: `ruff check .` (`.`이 `/app` 루트 — `backend/` 아님)

### Frontend (React/Vite)

- **스타일**: CSS Variables (`var(--text)`, `var(--bg)`) + 유틸리티 클래스. **Tailwind 사용 불가**
- **디자인 시스템**: Notion/Bear 테마 (`index.css`). 유틸리티 클래스: `.btn`, `.card`, `.form-input`, `.alert`, `.badge` 등
- **HTTP**: **axios 사용** (fetch 금지). API 클라이언트는 `frontend/src/api/`에 위치
- **테마/스킨**:
  - `useTheme()` 훅 → `data-theme="dark"` 라이트/다크 토글
  - `useSkin()` 훅 → `data-skin="forest"` 스킨 적용 (`SkinContext.jsx`)
  - 스킨 프리셋 4종: `notion`(보라, 기본) / `forest`(초록) / `ocean`(파랑) / `rose`(분홍)
- **Vite proxy**: `vite.config.js`에서 환경변수로 분기
  - `/api` → `BACKEND_URL` (Docker: `http://backend:5000`, 로컬: `http://localhost:5000`)
  - `/uploads` → `FILES_URL` (Docker: `http://nginx-files:80`, 로컬: `http://localhost:5000`)
- **권한 확인 패턴** (리팩토링 후):
  ```js
  import { useAuth } from '../hooks/useAuth';
  const { token, user, isLoggedIn } = useAuth();
  ```
  (`hooks/useAuth.js` — localStorage 직접 접근 단일 창구. 리팩토링 전 `getUser()` 인라인 패턴은 제거됨)

---

## 프로젝트 구조

```
cms/
├── nginx/
│   └── nginx-files.conf         # 개발용 파일 서버 Nginx 설정 (/uploads/ 전용)
├── backend/
│   ├── api/
│   │   ├── admin.py             # Admin 대시보드 API (검색/필터/페이지네이션 포함)
│   │   ├── auth.py              # 인증
│   │   ├── categories.py        # 카테고리 CRUD API (계층형 3단, Sprint 2)
│   │   ├── comments.py          # 댓글 + 스팸 필터
│   │   ├── decorators.py        # roles_required 데코레이터
│   │   ├── feeds.py             # RSS 2.0 피드 (`/blog/:username/feed.xml`)
│   │   ├── follows.py           # 팔로우/언팔로우/팔로워/팔로잉 + 이웃 피드 API
│   │   ├── helpers.py           # 공통 헬퍼 (페이지네이션/응답/게스트인증, BE 리팩토링 Issue #14)
│   │   ├── media.py             # 파일 업로드 + 썸네일 (storage.py 통해 저장)
│   │   ├── menus.py             # 동적 메뉴
│   │   ├── posts.py             # 포스트 CRUD + 소유권 + 검색(q) + 페이지네이션
│   │   ├── series.py            # 포스트 시리즈 CRUD + 시리즈-포스트 연결 API
│   │   ├── settings.py          # 사이트 설정 (site_skin 포함)
│   │   ├── stats.py             # 블로그 통계 + Admin 통계 API
│   │   ├── tags.py              # 태그 CRUD API (Sprint 2)
│   │   ├── wizard.py            # Setup Wizard Phase 1 (GET /api/wizard/status, POST /api/wizard/setup)
│   │   └── wizard_phase2.py     # Setup Wizard Phase 2 (POST /api/wizard/db-test, /env, /migrate)
│   ├── migrations/              # Flask-Migrate (반드시 git 커밋)
│   ├── models/                  # SQLAlchemy ORM 모델 (도메인별 분리, Issue #21)
│   │   ├── __init__.py          # 전체 모델 re-export (Alembic 자동 감지용)
│   │   ├── base.py              # Base(DeclarativeBase)
│   │   ├── user.py              # User, Follow
│   │   ├── post.py              # Post, PostMeta, PostLike, VisitLog
│   │   ├── comment.py           # Comment
│   │   ├── media.py             # Media
│   │   ├── category.py          # Category
│   │   ├── tag.py               # Tag, PostTag
│   │   ├── series.py            # Series, SeriesPost
│   │   ├── option.py            # Option, Menu, MenuItem
│   │   └── constants.py         # MAX_CATEGORY_DEPTH=3 등 비즈니스 상수
│   ├── app.py                   # Flask 팩토리 + 자동 마이그레이션
│   ├── config.py                # Dev/Prod 설정
│   ├── database.py              # db = SQLAlchemy(model_class=Base)
│   ├── storage.py               # StorageBackend 추상화 (LocalStorage / R2Storage 예정)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── auth.js          # 인증 API (getCurrentUser, updateUser)
│       │   ├── posts.js         # 포스트 API (page/per_page/q/category/tags 파라미터 포함)
│       │   ├── admin.js         # Admin API (page/per_page/q/status/category 파라미터 포함)
│       │   ├── comments.js      # 댓글 API (listAllComments page/per_page 포함) + approveComment, rejectComment
│       │   ├── media.js         # 미디어 업로드 API (uploadMedia)
│       │   ├── settings.js      # 사이트 설정 API (getSettings, updateSettings)
│       │   ├── categories.js    # 카테고리 API (getCategories) — Sprint 2
│       │   ├── tags.js          # 태그 API (getTags, getTagPosts) — Sprint 2
│       │   ├── users.js         # 사용자 API (getUserProfile, getUserPosts) — Sprint 2
│       │   ├── series.js        # 시리즈 API (getSeries, createSeries 등) — Phase 3
│       │   ├── stats.js         # 통계 API (getBlogStats) — Phase 3
│       │   ├── wizard.js        # Setup Wizard API (getWizardStatus, testDbConnection, saveEnvFile, runMigration, submitWizardSetup)
│       │   └── client.js        # axios 인스턴스 + authHeader 헬퍼 — 9개 api/*.js 공통 사용 (리팩토링 FE-P1)
│       ├── components/
│       │   ├── Nav.jsx          # role별 네비게이션 (editor: 내 블로그 링크 추가 — Sprint 2)
│       │   ├── CommentSection.jsx
│       │   ├── ProfileCard.jsx  # 사용자 프로필 카드 (아바타, bio) — Sprint 2
│       │   ├── inputs/          # 입력 컴포넌트
│       │   │   ├── CategoryDropdown.jsx  # 카테고리 단일 선택 셀렉트 (PostEditor + AdminPosts) — Sprint 2
│       │   │   ├── TagInput.jsx        # 태그 chip 입력 (PostEditor) — Sprint 2
│       │   │   └── SeriesDropdown.jsx  # 시리즈 선택 드롭다운 (PostEditor) — Phase 3
│       │   ├── layouts/         # 블로그 홈 레이아웃 컴포넌트 (Phase 3.1)
│       │   │   ├── BlogLayoutDefault.jsx   # Layout A: 사이드바 + 포스트 목록
│       │   │   ├── BlogLayoutCompact.jsx   # Layout B: 사이드바 숨김
│       │   │   ├── BlogLayoutMagazine.jsx  # Layout D: 카드형 메인 + 리스트
│       │   │   └── BlogLayoutPhoto.jsx     # Layout C: 썸네일 그리드
│       │   ├── SeriesNav.jsx    # 시리즈 이전/다음 탐색 (PostDetail) — Phase 3
│       │   ├── OnboardingModal.jsx  # 첫 로그인 editor 온보딩 모달 — Phase 3.1
│       │   ├── ShareButtons.jsx # 소셜 공유 버튼 (Twitter/Facebook/LinkedIn/링크복사) — Phase 3
│       │   └── widgets/
│       │       ├── RecentPosts.jsx
│       │       ├── Sidebar.jsx
│       │       ├── CategorySidebar.jsx  # 카테고리 계층형 필터 (PostList + BlogHome) — Sprint 2
│       │       ├── TagCloud.jsx        # 태그 클라우드 위젯 (PostDetail) — Sprint 2
│       │       └── StatsWidget.jsx     # 블로그 홈 통계 위젯 (포스트/조회수/댓글/팔로워) — Phase 3.1
│       ├── context/
│       │   ├── ThemeContext.jsx     # 라이트/다크 모드 (useTheme)
│       │   ├── SkinContext.jsx      # 스킨 4종 관리 (useSkin, SKINS 목록)
│       │   └── CategoryContext.jsx  # 전역 카테고리 목록 — Sprint 2
│       ├── hooks/
│       │   ├── useInfiniteScroll.js  # IntersectionObserver 기반 인피니트 스크롤
│       │   ├── useAuth.js            # localStorage token/user 단일 창구 (리팩토링 FE-P1)
│       │   ├── useFetch.js           # cancelled 패턴 공통 훅 — 단순 단일 fetch 케이스 (리팩토링 FE-P2)
│       │   └── usePostEditor.js      # PostEditor 폼 상태 + draft 자동저장 + API 호출 (리팩토링 FE-P3)
│       ├── test/                     # 프론트엔드 컴포넌트 테스트 (Vitest)
│       │   ├── setup.js              # Vitest 설정
│       │   ├── OnboardingModal.test.jsx
│       │   ├── SeriesNav.test.jsx
│       │   ├── ShareButtons.test.jsx
│       │   └── usePostEditor.test.jsx  # usePostEditor 훅 테스트 3개 (리팩토링 FE-P3)
│       └── test/e2e/                 # Playwright E2E 테스트 (High 우선순위 38개 TC 전체 커버)
│           ├── globalSetup.js        # pw_editor 계정 생성 + admin/editor storageState 저장
│           ├── admin.spec.js         # TC-A001~A003: Admin 포스트 관리
│           ├── layout.spec.js        # TC-U022~U025: 블로그 레이아웃 4종
│           ├── access-control.spec.js # TC-U043, U048, U049: 비로그인 접근 차단
│           ├── auth-guard.spec.js    # TC-A007, A012, A014~A017: 권한/인증 검증
│           ├── series.spec.js        # TC-U001~U003, U005: 포스트 시리즈
│           ├── stats.spec.js         # TC-U007~U009: 블로그 통계
│           ├── follow.spec.js        # TC-U031~U034, I002: 팔로우/피드
│           ├── admin-actions.spec.js # TC-A005, A008, A009, A011, I004: Admin 액션
│           └── misc.spec.js          # TC-U013, U026, U036, U042, I005: 기타
│       └── pages/
│           ├── admin/
│           │   ├── AdminPosts.jsx     # 포스트 관리 (검색+status필터+category필터+무한스크롤 — Sprint 2)
│           │   ├── AdminUsers.jsx     # 회원 관리
│           │   ├── AdminComments.jsx  # 댓글 관리 (승인/스팸 버튼 추가 — Sprint 1)
│           │   └── AdminSettings.jsx  # 사이트 설정 (스킨 선택)
│           ├── BlogHome.jsx           # 유저별 블로그 페이지 (`/blog/:username`) — Sprint 2
│           ├── SeriesDetail.jsx       # 시리즈 상세 (`/blog/:username/series/:slug`) — Phase 3
│           ├── BlogSettings.jsx       # 블로그 설정 (`/my-blog/settings`, 기본정보/디자인 탭) — Phase 2.5
│           ├── Feed.jsx               # 이웃 피드 (`/feed`) — Phase 3
│           ├── Search.jsx             # 검색 페이지 (`/search`) — 검색 고도화
│           ├── Statistics.jsx         # 블로그 통계 대시보드 (`/my-blog/statistics`) — Phase 3
│           ├── MyPosts.jsx            # 내 글 목록 (editor 로그인 후, 무한스크롤)
│           ├── PostList.jsx           # 전체 공개 글 (검색+category필터+CategorySidebar — Sprint 2)
│           ├── PostDetail.jsx         # 추천 + 댓글 + TagCloud + SeriesNav + ShareButtons — Phase 3
│           ├── PostEditor.jsx         # WYSIWYG/Markdown탭 + visibility선택 + category선택 + 태그입력 + 시리즈선택 + thumbnail_url + localStorage자동저장
│           ├── Profile.jsx            # 프로필 수정 (bio/avatar_url 편집 — Sprint 1)
│           ├── Login.jsx
│           ├── Register.jsx
│           └── SetupWizard.jsx  # Setup Wizard 5단계 UI (DB연결→재시작→마이그레이션→계정→완료)
├── docs/
│   ├── superpowers/             # 설계 스펙 및 구현 계획서
│   ├── qa/                      # QA 테스트 케이스 (tc_sprint3.md 인덱스, tc_user.md, tc_admin.md, tc_integration.md, tc_wizard.md)
│   ├── INSTALL.md               # 설치 가이드 (Setup Wizard 5단계 포함)
│   ├── INFRA_ANALYSIS_REPORT.md
│   └── 멀티유저블로그_UX기획_분석보고서.md
├── scripts/
│   ├── pre-commit.sh            # 코드 품질 검증 (ruff→mypy→pytest→eslint)
│   └── setup-hooks.sh           # pre-commit 훅 설치 (클론 후 1회 실행)
├── .claude/
│   ├── hooks/
│   │   └── check-commit.sh      # PostToolUse 훅: 커밋 실패 시 Claude 자가수정 지시
│   ├── rules/                   # CLAUDE.md에서 @ import하는 규칙 파일들
│   └── skills/                  # 프로젝트 특화 스킬 12개
│       ├── new-api-endpoint.md  # Flask API 추가 워크플로
│       ├── db-migration.md      # DB 마이그레이션 워크플로
│       ├── new-page.md          # React 페이지 추가 워크플로
│       ├── code-review.md       # BE/FE 코드 리뷰 체크리스트
│       ├── test-generation.md   # pytest/vitest 테스트 작성 패턴
│       ├── dba-query.md         # MariaDB 쿼리/인덱스 가이드
│       ├── db-erd.md            # schema.py → Mermaid ERD 생성
│       ├── api-docs.md          # api.md 업데이트 워크플로
│       ├── infra.md             # Docker/GitHub Actions/Nginx 변경 체크리스트
│       ├── debug.md             # 브랜치별 환경 분기 + 오류 진단 흐름
│       ├── deploy.md            # dev→main PR + CI/CD + 프로덕션 마이그레이션
│       └── service-planning.md  # 기획 → 스펙 → task 분해 워크플로
├── .github/workflows/deploy.yml
├── docker-compose.yml           # 로컬 개발 (nginx-files 포함, 컨테이너 시작 시 npm install)
└── docker-compose.prod.yml      # 프로덕션 (Gunicorn 4 workers + Nginx + uploads_data 볼륨)
```

---

## 현재 DB 테이블 목록 (스키마)

> 마지막 업데이트: 2026-04-08 (인덱스 2개 추가 — visit_logs.visited_at, posts 복합 인덱스)

### 테이블 요약

| 테이블 | 역할 | 주요 컬럼 | 관계 |
|--------|------|---------|------|
| `users` | 사용자 | id(PK), username, email, role, bio, avatar_url, blog_title, blog_color, website_url, social_links, blog_layout, banner_image_url | Post(1:N), Comment(1:N), Media(1:N), Follow(1:N), Series(1:N) |
| `posts` | 포스트 | id(PK), author_id(FK), title, slug, content, status, visibility, category_id(FK, nullable), thumbnail_url | User, Category, Comment(1:N), PostLike(1:N), PostTag(N:N), VisitLog(1:N) |
| `categories` | 카테고리(계층형, MAX_DEPTH=3) | id(PK), name, slug, parent_id(자기참조, nullable), order | Post(1:N) |
| `tags` | 태그 | id(PK), name, slug | PostTag(N:N) |
| `post_tags` | Post-Tag 연결 | post_id(FK), tag_id(FK) | Post, Tag |
| `comments` | 댓글 | id(PK), post_id(FK), author_id(FK, nullable), content, status | Post, User, Comment(계층형) |
| `post_likes` | 추천 | id(PK), post_id(FK), user_id(FK) | Post, User |
| `post_meta` | 포스트 메타데이터 | id(PK), post_id(FK), meta_key, meta_value | Post |
| `media` | 파일 메타데이터 | id(PK), uploaded_by(FK), filename, filepath, size | User |
| `options` | 전역 설정 | id(PK), option_name, option_value | (단일 행) |
| `menus` / `menu_items` | 네비게이션 메뉴 | menu_id, parent_id(자기참조) | (계층형) |
| `follows` | 팔로우 관계 | id(PK), follower_id(FK), following_id(FK) | User(N:M) |
| `visit_logs` | 방문 로그 | id(PK), post_id(FK nullable), user_id(FK nullable), ip_address, visited_at | Post, User |
| `series` | 포스트 시리즈 | id(PK), author_id(FK), title, slug, description | User, SeriesPost(1:N) |
| `series_posts` | 시리즈-포스트 연결 | id(PK), series_id(FK), post_id(FK), order | Series, Post |

### 상세 컬럼 정의

#### `users` (사용자 관리)
```
id: int (PK)
username: str(64) UNIQUE NOT NULL
email: str(120) UNIQUE NOT NULL
password_hash: str(255) NOT NULL
role: str(20) default='subscriber' [admin, editor, subscriber, deactivated]
bio: Text nullable (Sprint 1 추가)
avatar_url: str(500) nullable (Sprint 1 추가)
blog_title: str(200) nullable (Phase 2.5 추가)
blog_color: str(7) nullable — #rrggbb 형식 (Phase 2.5 추가)
website_url: str(500) nullable (Phase 2.5 추가)
social_links: JSON nullable (Phase 2.5 추가)
blog_layout: str(20) nullable [default, compact, magazine, photo] (Phase 3.1 추가)
banner_image_url: str(500) nullable (Phase 3.1 추가)
created_at: DateTime server_default=now()
```

#### `posts` (포스트)
```
id: int (PK)
author_id: int FK nullable (마이그레이션 d56f01212789에서 nullable 변경)
title: str(255) NOT NULL
slug: str(255) INDEX NOT NULL
content: Text nullable
excerpt: Text nullable
status: str(20) default='draft' [draft, published, scheduled]
post_type: str(20) default='post'
content_format: str(10) default='html' [html, markdown] (Sprint 1 추가)
visibility: str(20) default='public' [public, members_only, private] (Sprint 1 추가)
category_id: int FK nullable, ondelete=SET NULL (Sprint 2 추가)
thumbnail_url: str(500) nullable (Phase 3.1 추가)
view_count: int default=0
created_at: DateTime server_default=now()
updated_at: DateTime nullable, onupdate=now()
```

#### `categories` (카테고리, Sprint 2 완료)
```
id: int (PK)
name: str(100) NOT NULL
slug: str(100) UNIQUE NOT NULL
description: Text nullable
parent_id: int FK nullable, ondelete=SET NULL (자기참조)
order: int default=0
created_at: DateTime server_default=now()
MAX_DEPTH: 3 (API 검증)
```

#### `tags` (태그, Sprint 2 완료)
```
id: int (PK)
name: str(50) UNIQUE NOT NULL
slug: str(50) UNIQUE NOT NULL
created_at: DateTime server_default=now()
```

#### `post_tags` (Post-Tag 조인, Sprint 2 완료)
```
id: int (PK)
post_id: int FK (CASCADE delete)
tag_id: int FK (CASCADE delete)
created_at: DateTime server_default=now()
UNIQUE constraint: (post_id, tag_id)
```

#### `comments` (댓글)
```
id: int (PK)
post_id: int FK NOT NULL
author_id: int FK nullable (로그인 사용자) / author_name, author_email (게스트)
author_password_hash: str(255) nullable (게스트 전용, 댓글 수정/삭제 인증용)
parent_id: int FK nullable (자기참조, 1단 계층만 지원)
content: Text NOT NULL
status: str(20) default='approved' [approved, pending, spam]
created_at: DateTime server_default=now()
```

#### `post_likes` (추천, 1인 1추천)
```
id: int (PK)
post_id: int FK
user_id: int FK
created_at: DateTime server_default=now()
UNIQUE constraint: (post_id, user_id)
```

#### `follows` (팔로우 관계, Phase 3 완료)
```
id: int (PK)
follower_id: int FK NOT NULL, ondelete=CASCADE
following_id: int FK NOT NULL, ondelete=CASCADE
created_at: DateTime server_default=now()
UNIQUE constraint: (follower_id, following_id)
INDEX: idx_follows_following_id (following_id) — 팔로워 목록 조회 최적화 (추가: 2026-04-01)
```

#### `visit_logs` (방문 로그, Phase 3 Stage 1 완료)
```
id: int (PK)
post_id: int FK nullable, ondelete=SET NULL
user_id: int FK nullable, ondelete=SET NULL
ip_address: str(45) NOT NULL
visited_at: DateTime server_default=now()
referer: str(500) nullable
INDEX: (post_id, visited_at)
⚠️ 중복 방지: DB UNIQUE 제약 불가(func.date 기반) → BE 레벨 SELECT→조건부 INSERT로 대체 (의도적 결정)
```

#### `series` (포스트 시리즈, Phase 3 Stage 2 완료)
```
id: int (PK)
author_id: int FK NOT NULL, ondelete=CASCADE
title: str(255) NOT NULL
slug: str(255) UNIQUE NOT NULL
description: Text nullable
created_at: DateTime server_default=now()
```

#### `series_posts` (시리즈-포스트 연결, Phase 3 Stage 2 완료)
```
id: int (PK)
series_id: int FK NOT NULL, ondelete=CASCADE
post_id: int FK NOT NULL, ondelete=CASCADE
order: int default=0
created_at: DateTime server_default=now()
UNIQUE constraint: (series_id, post_id)
INDEX: (series_id, order)
```

#### `media` (파일 메타데이터)
```
id: int (PK)
uploaded_by: int FK NOT NULL
filename: str(255) NOT NULL
filepath: str(500) NOT NULL (storage 경로 또는 CDN URL)
mimetype: str(100)
size: int (bytes)
meta_data: JSON nullable (너비, 높이, alt 텍스트 등)
created_at: DateTime server_default=now()
```

### 인덱스 설계

**주요 인덱스:**
- `posts`: idx_posts_slug, (category_id, status) 복합 인덱스 (Sprint 2)
- `posts`: `ix_posts_author_id` (author_id) — stats/feed 쿼리 최적화 (추가: 2026-04-01, commit a5a52cc)
- `comments`: `idx_comments_post_status_created` (post_id, status, created_at) — 댓글 목록 조회 최적화 (추가: 2026-04-06, commit 83c2b7f)
- `post_tags`: `idx_post_tags_tag_id` (tag_id) — 태그별 포스트 조회 최적화 (추가: 2026-04-06, commit 83c2b7f)
- `categories`: (parent_id, order), slug
- `post_likes`: `idx_post_likes_user_id` (user_id) — 좋아요 집계 최적화 (추가: 2026-04-06, commit 83c2b7f)
- `follows`: `idx_follows_following_id` (following_id) — 팔로워 목록 조회 최적화 (추가: 2026-04-01, commit a5a52cc)
- `visit_logs`: `idx_visit_logs_visited_at` (visited_at) — 통계 날짜 범위 필터 최적화 (추가: 2026-04-08)
- `posts`: `idx_posts_status_visibility_created` (status, visibility, created_at DESC) — 목록 조회 복합 인덱스 (추가: 2026-04-08)

**Fulltext 인덱스 (검색):**
- `posts`: FULLTEXT(title, excerpt, content) — `MATCH ... AGAINST` 쿼리용

### 마이그레이션 히스토리

| 파일명 | 변경 사항 | 상태 |
|--------|---------|------|
| `70ee9763efa3_initial_schema.py` | 초기 스키마 생성 | ✅ |
| `4822d4e6438a_sync_schema_main_branch.py` | 메인 브랜치 스키마 동기화 | ✅ |
| `559b21475b90_posts_updated_at_nullable_수정.py` | posts.updated_at nullable 수정 | ✅ |
| `d56f01212789_post_author_id_nullable.py` | posts.author_id nullable 변경 | ✅ |
| `a296bac8cb7e_add_comment_author_password_hash.py` | comment 게스트 인증 추가 | ✅ |
| `d3b142695ad9_add_post_view_count_and_post_likes_table.py` | view_count + PostLike 추가 | ✅ |
| `merge_heads.py` | 마이그레이션 분기 merge | ✅ |
| `7d29f46cdf24_add_content_format_to_posts.py` | content_format 컬럼 추가 | ✅ |
| `c254032213d8_add_user_bio_avatar_url.py` | bio, avatar_url 추가 (Sprint 1) | ✅ |
| `2f45cb66c55f_add_post_visibility.py` | visibility 컬럼 추가 (Sprint 1) | ✅ |
| `e141b01590f2_create_tags_and_post_tags.py` | Tag + PostTag 테이블 생성 (Sprint 2) | ✅ |
| `761ee81e777c_create_categories_add_category_id_to_.py` | Category 테이블 생성 + Post.category_id FK (Sprint 2) | ✅ |
| `fffa879f6f26_add_fulltext_ngram_index_to_posts.py` | posts FULLTEXT 인덱스 추가 (검색 고도화) | ✅ |
| `c891df1fe353_add_blog_customization_to_users.py` | blog_title, blog_color, website_url, social_links 추가 (Phase 2.5) | ✅ |
| `3ae876c3593f_create_follows_table.py` | follows 테이블 생성 (구독/이웃) | ✅ |
| `684c84c39efb_add_blog_layout_and_banner_image_url_to_.py` | blog_layout, banner_image_url 추가 (Phase 3.1) | ✅ |
| `c888d26c19a1_add_thumbnail_url_to_posts.py` | posts.thumbnail_url 추가 (Phase 3.1) | ✅ |
| `3c1734bf86e6_create_visit_logs_table.py` | visit_logs 테이블 생성 (Phase 3 Stage 1) | ✅ |
| `79e90ed73d8d_create_series_and_series_posts_tables.py` | series, series_posts 테이블 생성 (Phase 3 Stage 2) | ✅ |
| `c6ba37f921ea_add_idx_posts_author_id_follows_.py` | ix_posts_author_id + idx_follows_following_id 인덱스 추가 (성능 개선) | ✅ |
| `5c4b3411ca67_add_indexes_for_comments_post_tags_post_.py` | idx_comments_post_status_created + idx_post_tags_tag_id + idx_post_likes_user_id 인덱스 추가 (리팩토링 P2-DB, Issue #18) | ✅ |
| `5d92b5bbdf0c_add_indexes_visit_logs_posts.py` | visit_logs.visited_at + posts 복합 인덱스(status, visibility, created_at DESC) 추가 | ✅ |

### 주의사항

**Sprint 1 (완료):**
- `users.bio`, `users.avatar_url` — nullable, TEXT/String(500) 타입, 마이그레이션 완료
- `posts.visibility` — default='public', nullable=False, server_default='public' 적용 완료
- `posts.category_id` — Sprint 2에서 추가 완료

**Sprint 2 (완료):**
- `categories` 테이블 — MAX_DEPTH=3 API 레벨 검증 적용됨
- `PostTag` 다대다 — 복합 UNIQUE 제약 `(post_id, tag_id)` 적용됨
- `posts.category_id` — nullable, ondelete=SET NULL (카테고리 삭제 시 포스트 유지)

**성능 최적화:**
- 포스트 > 10만 건 시점에 `(category_id, status, created_at DESC)` 복합 인덱스 추가 권장
- Fulltext 검색은 MariaDB 자연어 검색 사용 (한글 지원: ngram 토크나이저 필요 시 추가)
