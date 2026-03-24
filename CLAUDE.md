# CMS Project

React(FE) + Flask(BE) + MariaDB(DB) 기반 개인 블로그형 설치형 CMS.
Docker 컨테이너로 관리. main 브랜치 push → GitHub Actions → Windows 서버 자동 배포.

## 개발 환경

**Mac 로컬 개발:**
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
# 앱 재시작 시 flask db upgrade 자동 실행됨
```

**프로덕션:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 아키텍처

| 구분 | 기술 |
|------|------|
| Frontend | React 19 + Vite + CSS Variables (Tailwind 미설치) |
| Backend | Python 3.11 + Flask + SQLAlchemy 3.x + Flask-JWT-Extended |
| Database | MariaDB 10.11 |
| 로컬 개발 포트 | FE: 5173, BE: 5000, DB: 4807 |

**권한 체계 (Role):**
- `admin` — 전체 포스트/회원 관리, Admin 대시보드 접근
- `editor` — 본인 글 작성/수정/삭제 (회원가입 시 기본 권한)
- `deactivated` — 로그인 차단

**로그인 후 분기:**
- admin → `/admin/posts`
- editor → `/my-posts`

## 코딩 표준

### Backend (Python/Flask)

- **Import**: Docker 빌드 시 `backend/` 파일이 `/app` 루트로 복사됨 → `backend.` 접두사 생략
- **Blueprint 패턴**: 도메인별 파일 분리 (`api/auth.py`, `api/posts.py`, `api/admin.py` 등)
- **타입 힌트**: 모든 함수에 필수
- **응답 포맷**: 항상 `{ "success": bool, "data": {}, "error": str }`
- **DB 쿼리**: SQLAlchemy 2.x 스타일 (`select()`, `db.session.get()`, `scalar_one_or_none()`)
- **JWT identity**: `create_access_token(identity=str(user.id))` — 반드시 문자열
  - 조회 시: `int(get_jwt_identity())`

### Frontend (React/Vite)

- **스타일**: CSS Variables (`var(--text)`, `var(--bg)` 등) + 유틸리티 클래스. Tailwind 사용 불가
- **HTTP**: axios 사용 (fetch 금지). API 클라이언트는 `frontend/src/api/`에 위치
- **테마**: `useTheme()` 훅 사용. `data-theme="dark"` 속성이 `document.documentElement`에 토글
- **Vite proxy**: `/api` → `BACKEND_URL` 환경변수 분기 (`vite.config.js`)
  - Docker: `http://backend:5000` / 로컬: `http://localhost:5000`
- **권한 확인 패턴**:
  ```js
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  };
  ```

## 주요 API 엔드포인트

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/posts` | 공개 | published 포스트 목록 |
| `GET /api/posts/mine` | 로그인 | 내 글 전체 (draft+published) |
| `POST /api/posts` | editor/admin | 글 작성 |
| `PUT /api/posts/:id` | 소유자/admin | 수정 |
| `DELETE /api/posts/:id` | 소유자/admin | 삭제 |
| `GET /api/admin/posts` | admin | 전체 포스트 관리 |
| `GET /api/admin/users` | admin | 전체 회원 목록 |
| `PUT /api/admin/users/:id/role` | admin | 권한 변경 |
| `PUT /api/admin/users/:id/deactivate` | admin | 비활성화 |
| `DELETE /api/admin/users/:id` | admin | 회원 삭제 (포스트 orphan 처리) |

## 주의사항

- **시크릿 하드코딩 금지**: `.env` 파일 참조 (gitignore 처리됨)
- **마이그레이션 파일 커밋 필수**: `backend/migrations/versions/`
- **requirements.txt**: 새 패키지 추가 시 즉시 반영 + `--no-cache` 재빌드
- **CI/CD 인코딩**: PowerShell `.env` 생성 시 UTF-8 No BOM 필수
- `CORS`: 개발 환경 `localhost:5173` 허용 설정됨

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
│       ├── components/      # Nav, widgets
│       ├── context/         # ThemeContext
│       └── pages/
│           ├── admin/       # AdminPosts, AdminUsers
│           ├── Login, Register, Profile
│           ├── MyPosts      # 내 블로그 (editor 로그인 후)
│           ├── PostList     # 전체 공개 글
│           ├── PostDetail   # 글 상세
│           └── PostEditor   # Quill WYSIWYG 에디터
├── docs/superpowers/        # 설계 스펙 및 구현 계획서
├── docker-compose.yml       # 로컬 개발 (Watch 모드)
├── docker-compose.prod.yml  # 프로덕션 (Gunicorn 4 workers + Nginx)
└── .github/workflows/deploy.yml  # main push → Windows 서버 배포
```
