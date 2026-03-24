# CMS Project

React(FE) + Flask(BE) + MariaDB(DB) 기반 개인 블로그형 설치형 CMS.
Docker 컨테이너로 관리. main 브랜치 push → GitHub Actions → Windows 서버 자동 배포.

---

## 개발 환경 명령어

**Mac 로컬 개발 (docker compose v2):**
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

**프로덕션:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml down --remove-orphans
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
| `GET /api/posts` | 공개 | published 포스트 목록 |
| `GET /api/posts/mine` | 로그인 | 내 글 전체 (draft+published) |
| `POST /api/posts` | editor/admin | 글 작성 |
| `PUT /api/posts/:id` | 소유자/admin | 수정 (소유권 검사) |
| `DELETE /api/posts/:id` | 소유자/admin | 삭제 (소유권 검사) |
| `GET /api/auth/me` | 로그인 | 현재 사용자 조회 |
| `PUT /api/auth/me` | 로그인 | 프로필 수정 |
| `GET /api/settings` | 공개 | 사이트 설정 조회 |
| `PUT /api/settings` | admin | 사이트 설정 수정 |
| `GET /api/media` | editor/admin | 미디어 목록 |
| `POST /api/media` | editor/admin | 파일 업로드 + 썸네일 |
| `GET /api/admin/posts` | admin | 전체 포스트 관리 |
| `GET /api/admin/users` | admin | 전체 회원 목록 |
| `PUT /api/admin/users/:id/role` | admin | 권한 변경 |
| `PUT /api/admin/users/:id/deactivate` | admin | 비활성화 |
| `DELETE /api/admin/users/:id` | admin | 회원 삭제 (포스트 orphan 처리) |

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
- Gunicorn 500: `app:create_app()` 팩토리 문법 확인 → `docker compose exec backend python app.py`로 ImportError 확인

**API 연결:**
- Docker 내부 API 호출 실패: `vite.config.js`의 `BACKEND_URL` 환경변수 확인
- 테이블 없음 오류: `docker compose exec backend flask db upgrade` 실행
- JWT "Subject must be a string": `create_access_token(identity=str(user.id))` 확인

**Nginx (프로덕션):**
- `npm run build` 실패 시 반드시 로컬에서 선행 빌드 후 오류 수정

---

## 구현 현황

> 마지막 업데이트: 2026-03-24 (dev 브랜치 — 블로그 소유권 + Admin 대시보드 완료)

### 완료

| 영역 | 기능 |
|------|------|
| 인증 | 로그인/회원가입/프로필 수정/JWT/RBAC/deactivated 차단 |
| 포스트 | CRUD API + WYSIWYG 에디터(react-quill-new) + 소유권 검사 |
| 개인 블로그 | `/my-posts` — 내 글 전체(draft+published), 편집/삭제 |
| 미디어 | 업로드 + Pillow 썸네일 + uuid 파일명 + path traversal 방어 |
| 댓글 | 계층형 + 스팸 필터링 + JWT author_id 위조 방지 |
| 메뉴 | 동적 메뉴 관리 API |
| 사이트 설정 | GET/PUT `/api/settings` (Option 모델) |
| Admin 대시보드 | 포스트 관리(`/admin/posts`) + 회원 관리(`/admin/users`) |
| Admin 회원 관리 | 권한변경·비활성화·활성화·삭제·글 보기(인라인 토글) |
| UI/UX | Notion/Bear 테마 + 라이트/다크 모드 + role별 Nav |
| 인프라 | Docker Watch(로컬) + Gunicorn 4 workers(프로덕션) + CI/CD |

### 미구현

| 기능 | 비고 |
|------|------|
| DB 연결 마법사 (Setup Wizard) | |
| Post Meta API | DB 스키마만 존재 |
| 포스트 검색/필터 | |
| 페이지네이션 | 현재 전체 반환 |
| 댓글 UI | API만 구현됨 |

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
│       ├── api/             # axios 클라이언트 (auth, posts, admin)
│       ├── components/      # Nav, widgets (RecentPosts, Sidebar)
│       ├── context/         # ThemeContext
│       └── pages/
│           ├── admin/       # AdminPosts, AdminUsers
│           ├── MyPosts.jsx  # 내 블로그 (editor 로그인 후)
│           ├── PostList.jsx # 전체 공개 글
│           ├── PostDetail.jsx
│           └── PostEditor.jsx  # Quill WYSIWYG
├── docs/superpowers/        # 설계 스펙 및 구현 계획서
├── .github/workflows/deploy.yml
├── docker-compose.yml       # 로컬 개발 (Watch 모드)
└── docker-compose.prod.yml  # 프로덕션 (Gunicorn 4 workers + Nginx)
```
