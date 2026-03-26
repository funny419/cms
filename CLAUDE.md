# CMS Project

React(FE) + Flask(BE) + MariaDB(DB) 기반 개인 블로그형 설치형 CMS.
Docker 컨테이너로 관리. main 브랜치 push → GitHub Actions → Windows 서버 자동 배포.

---

## ⚠️ 브랜치별 작업 환경 규칙

**반드시 현재 브랜치를 확인하고 올바른 환경에 접속할 것.**

| 브랜치 | Docker 환경 | 설명 |
|--------|------------|------|
| `dev` | **로컬 Mac Docker** | `docker compose exec ...` 사용 |
| `main` | **리모트 Windows Docker** | 서버에서 직접 실행하거나 SSH 접속 |

- `main` 브랜치에서 `docker compose exec backend ...` 실행 → **로컬 dev 환경에 접속하는 것** → 잘못된 접근
- `main` 브랜치 관련 DB/마이그레이션 작업 → **Windows 서버에서 `docker exec cms_backend_prod ...` 실행**

---

## 개발 환경 명령어

### dev 브랜치 (로컬 Mac Docker)
```bash
docker compose up -d --build   # 최초 시작
docker compose watch            # 파일 변경 자동 반영 (권장)
docker compose down             # 중지
docker compose restart backend  # 백엔드만 재시작
docker compose logs -f          # 로그
docker compose exec db mariadb -u funnycms -p  # DB 접속
```

**DB 마이그레이션 (schema.py 수정 후):**
```bash
docker compose exec backend flask db migrate -m "변경 내용"
# 앱 재시작 시 flask db upgrade 자동 실행됨 (app.py에 설정)
# 마이그레이션 파일은 반드시 git 커밋할 것
```

### main 브랜치 (리모트 Windows Docker)
```powershell
# 프로덕션 컨테이너에서 실행
docker exec cms_backend_prod flask db upgrade
docker exec cms_backend_prod flask db stamp head
docker exec cms_db_prod mariadb -u funnycms -p<PASSWORD> cmsdb -e "SQL"
docker logs cms_backend_prod --tail=30
docker restart cms_backend_prod
```

**프로덕션 재배포:**
```bash
docker compose -f docker-compose.prod.yml down --remove-orphans
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 아키텍처

| 구분 | 기술 |
|------|------|
| Frontend | React 19 + Vite + CSS Variables (Tailwind 미설치) |
| Backend | Python 3.11 + Flask + SQLAlchemy 3.x + Flask-JWT-Extended |
| Database | MariaDB 10.11 |
| 로컬 개발 포트 | FE: 5173, BE: 5000, DB: 4807 |

**권한 체계 (Role):**
- `admin` — 전체 포스트/회원 관리, Admin 대시보드 (`/admin/*`) 접근
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

### Frontend (React/Vite)

- **스타일**: CSS Variables (`var(--text)`, `var(--bg)`) + 유틸리티 클래스. **Tailwind 사용 불가**
- **디자인 시스템**: Notion/Bear 테마 (`index.css`). 유틸리티 클래스: `.btn`, `.card`, `.form-input`, `.alert`, `.badge` 등
- **HTTP**: **axios 사용** (fetch 금지). API 클라이언트는 `frontend/src/api/`에 위치
- **테마**: `useTheme()` 훅. `data-theme="dark"` 속성이 `document.documentElement`에 토글
- **Vite proxy**: `/api` → `BACKEND_URL` 환경변수 분기 (`vite.config.js`)
  - Docker 실행: `http://backend:5000` / 로컬 직접: `http://localhost:5000`
- **권한 확인 패턴** (각 페이지에서 사용):
  ```js
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  };
  ```

---

## 주요 API 엔드포인트

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/posts` | 공개 | published 포스트 목록 (author_username·view_count·comment_count·like_count·user_liked 포함) |
| `GET /api/posts/:id` | 공개 | 포스트 단건 + view_count +1 (`?skip_count=1` 시 미증가, 편집 페이지용) — `content_format` 포함 |
| `POST /api/posts/:id/like` | editor/admin | 추천 토글 (본인 글 불가, 1인 1추천) |
| `GET /api/posts/mine` | 로그인 | 내 글 전체 (draft+published) |
| `POST /api/posts` | editor/admin | 글 작성 (`content_format`: 'html'|'markdown', 기본 'html') |
| `PUT /api/posts/:id` | 소유자/admin | 수정 (소유권 검사, `content_format` 변경 가능) |
| `DELETE /api/posts/:id` | 소유자/admin | 삭제 (소유권 검사) |
| `GET /api/auth/me` | 로그인 | 현재 사용자 조회 |
| `PUT /api/auth/me` | 로그인 | 프로필 수정 |
| `GET /api/settings` | 공개 | 사이트 설정 조회 |
| `PUT /api/settings` | admin | 사이트 설정 수정 |
| `GET /api/media` | editor/admin | 미디어 목록 |
| `POST /api/media` | editor/admin | 파일 업로드 + 썸네일 |
| `GET /api/comments/post/:id` | 공개 | 포스트별 승인된 댓글 목록 |
| `POST /api/comments` | 공개 | 댓글 작성 (로그인=즉시공개, 게스트=이름+이메일+패스워드 필수+승인대기) |
| `PUT /api/comments/:id` | 소유자/게스트인증 | 댓글 수정 (로그인=author_id 일치, 게스트=이메일+패스워드 인증) |
| `DELETE /api/comments/:id` | admin/소유자/게스트인증 | 댓글 삭제 (cascade 답글 포함) |
| `GET /api/admin/posts` | admin | 전체 포스트 관리 |
| `GET /api/admin/users` | admin | 전체 회원 목록 |
| `GET /api/admin/comments` | admin | 전체 댓글 목록 (post_title 포함) |
| `PUT /api/admin/users/:id/role` | admin | 권한 변경 |
| `PUT /api/admin/users/:id/deactivate` | admin | 비활성화 |
| `DELETE /api/admin/users/:id` | admin | 회원 삭제 (포스트·댓글 orphan 처리) |

---

## CI/CD (GitHub Actions — Windows Self-Hosted Runner)

**인코딩 규칙 (PowerShell):**
- `.env` 생성 시 반드시 **UTF-8 No BOM** 사용 → `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))`
- 스크립트 본문(run 섹션)에 **한글 직접 작성 금지** → `env:` 섹션으로 환경변수 전달 후 `$env:VAR_NAME` 호출
- Discord Webhook JSON 페이로드: `UTF8Encoding($false)`로 바이너리 전송

**배포 흐름:**
1. `.env` 파일 동적 생성 (Secrets 조합)
2. `docker compose -f docker-compose.prod.yml down --remove-orphans`
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. 30초 대기 후 비정상 컨테이너 확인
5. Discord 성공/실패 알림
6. `.env` 파일 삭제 (`always()` 조건)

---

## 트러블슈팅

**Docker 빌드:**
- `SELF_SIGNED_CERT_IN_CHAIN`: 개발용 `frontend/Dockerfile`에 `npm config set strict-ssl false` 적용됨
- `npm ci` 실패(lock 불일치): 개발용은 `npm install` 사용, `Dockerfile.prod`만 `npm ci` 사용
- Gunicorn 500: `app:create_app()` 팩토리 문법 확인 → `docker exec cms_backend_prod python app.py`로 ImportError 확인

**API 연결:**
- Docker 내부 API 호출 실패: `vite.config.js`의 `BACKEND_URL` 환경변수 확인
- 테이블 없음 오류: `docker exec cms_backend_prod flask db upgrade` 실행
- JWT "Subject must be a string": `create_access_token(identity=str(user.id))` 확인

**프로덕션 마이그레이션 오류:**
- `Table already exists`: `docker exec cms_backend_prod flask db stamp head` 실행
- `Can't locate revision`: DB의 `alembic_version`이 존재하지 않는 마이그레이션 참조 → 서버에서 직접 DB 수정
- `Unknown column`: 프로덕션 DB에 컬럼 누락 → `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 실행 후 stamp
- `Multiple head revisions`: 마이그레이션 히스토리가 분기됨 → `flask db heads`로 두 head 확인 후 merge migration 파일 생성 (`down_revision = ('head1', 'head2')`, `upgrade()/downgrade()` 모두 pass)

**포스트 통계:**
- 개발 환경(`<StrictMode>`)에서 포스트 상세 진입 시 view_count가 +2로 보이는 것은 정상 — React StrictMode가 useEffect를 2번 실행하는 개발 전용 동작. 프로덕션 빌드에서는 +1.

**Markdown 에디터:**
- `@uiw/react-md-editor` 다크모드: `data-color-mode={theme === 'dark' ? 'dark' : 'light'}` — `useTheme()` 훅으로 분기
- Markdown 포스트 뷰어: `MDEditor.Markdown` 컴포넌트 사용 (`rehype-sanitize` XSS 방어 내장)
- 포맷 잠금 정책: 한 번 Markdown으로 저장된 포스트는 UI에서 WYSIWYG 탭 비활성화 (DB `content_format` 컬럼 기준)

**권한 관련:**
- User 모델 DB 기본값(`default='subscriber'`)과 register API(`role='editor'`)가 다름 — 회원가입 API로 생성된 계정은 항상 editor. DB에 직접 삽입한 계정은 subscriber가 될 수 있어 PostEditor 접근 시 전체 글 페이지로 리다이렉트될 수 있음 → `UPDATE users SET role='editor' WHERE username='...'` 로 수정

---

## 구현 현황

> 마지막 업데이트: 2026-03-26 (포스트 검색/필터 추가)

### 완료

| 영역 | 기능 |
|------|------|
| 인증 | 로그인/회원가입/프로필 수정/JWT/RBAC/deactivated 차단 |
| 포스트 | CRUD API + WYSIWYG 에디터(react-quill-new) + 소유권 검사 |
| 포스트 에디터 | 포스트별 WYSIWYG/Markdown 선택 (`content_format` 컬럼) — Markdown 선택 후 WYSIWYG 전환 불가(잠금), 다크모드 대응 |
| 포스트 통계 | 조회수(view_count) + 댓글수 + 추천수 — PostList/PostDetail에 표시 |
| 포스트 추천 | 로그인 사용자 추천/취소 토글, 본인 글 추천 불가, 1인 1추천(DB UniqueConstraint) |
| 개인 블로그 | `/my-posts` — 내 글 전체(draft+published), 편집/삭제 |
| 미디어 | 업로드 + Pillow 썸네일 + uuid 파일명 + path traversal 방어 |
| 댓글 | 계층형(1단 답글) + 로그인/게스트 분기 + 수정/삭제 소유권 인증 + 스팸 필터링 |
| 댓글 UI | PostDetail 댓글 섹션 — 로그인(즉시공개), 게스트(이름+이메일+패스워드, 승인대기) |
| 댓글 수정/삭제 | 로그인: author_id 일치, 게스트: 이메일+패스워드 인증 |
| 메뉴 | 동적 메뉴 관리 API |
| 사이트 설정 | GET/PUT `/api/settings` (Option 모델) |
| 페이지네이션 | Offset 기반 + 인피니트 스크롤 — PostList/MyPosts/AdminPosts/AdminComments 4개 페이지, `useInfiniteScroll` 공통 훅 |
| 포스트 검색/필터 | PostList — 제목 키워드 검색(q, 300ms 디바운스), AdminPosts — 제목 검색 + 상태 필터(published/draft/scheduled) |
| Admin 대시보드 | 포스트 관리 + 회원 관리 + 댓글 관리(`/admin/comments`) |
| Admin 회원 관리 | 권한변경·비활성화·활성화·삭제·글 보기(인라인 토글) |
| Admin 댓글 관리 | 전체 댓글 목록(상태 뱃지)·삭제 |
| UI/UX | Notion/Bear 테마 + 라이트/다크 모드 + role별 Nav |
| 인프라 | Docker Watch(로컬) + Gunicorn 4 workers(프로덕션) + CI/CD |

### 미구현

| 기능 | 비고 |
|------|------|
| DB 연결 마법사 (Setup Wizard) | |
| Post Meta API | DB 스키마만 존재 |
| Admin 댓글 승인 UI | approve 엔드포인트 존재, UI 미구현 (게스트 댓글 승인용) |

---

## 프로젝트 구조

```
cms/
├── backend/
│   ├── api/
│   │   ├── admin.py         # Admin 대시보드 API
│   │   ├── auth.py          # 인증
│   │   ├── comments.py      # 댓글 + 스팸 필터
│   │   ├── decorators.py    # roles_required 데코레이터
│   │   ├── media.py         # 파일 업로드 + 썸네일
│   │   ├── menus.py         # 동적 메뉴
│   │   ├── posts.py         # 포스트 CRUD + 소유권
│   │   └── settings.py      # 사이트 설정
│   ├── migrations/          # Flask-Migrate (반드시 git 커밋)
│   ├── models/schema.py     # SQLAlchemy ORM 모델
│   ├── app.py               # Flask 팩토리 + 자동 마이그레이션
│   ├── config.py            # Dev/Prod 설정
│   ├── database.py          # db = SQLAlchemy(model_class=Base)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/             # axios 클라이언트 (auth, posts, admin, comments)
│       ├── components/      # Nav, CommentSection, widgets
│       ├── context/         # ThemeContext
│       └── pages/
│           ├── admin/       # AdminPosts, AdminUsers, AdminComments
│           ├── MyPosts.jsx  # 내 블로그 (editor 로그인 후)
│           ├── PostList.jsx # 전체 공개 글 (작성자·조회수·댓글수·추천수)
│           ├── PostDetail.jsx  # 추천 버튼 + 댓글 섹션 + Markdown/HTML 렌더링 분기
│           └── PostEditor.jsx  # WYSIWYG(Quill) + Markdown(@uiw/react-md-editor) 탭 전환
├── docs/superpowers/        # 설계 스펙 및 구현 계획서
├── .github/workflows/deploy.yml
├── docker-compose.yml       # 로컬 개발 (Watch 모드)
└── docker-compose.prod.yml  # 프로덕션 (Gunicorn 4 workers + Nginx)
```
