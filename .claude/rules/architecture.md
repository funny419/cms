## 아키텍처

| 구분 | 기술 |
|------|------|
| Frontend | React 19 + Vite + CSS Variables (Tailwind 미설치) |
| Backend | Python 3.11 + Flask + SQLAlchemy 3.x + Flask-JWT-Extended |
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
- **권한 확인 패턴** (각 페이지에서 사용):
  ```js
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  };
  ```

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
│   │   ├── comments.py          # 댓글 + 스팸 필터
│   │   ├── decorators.py        # roles_required 데코레이터
│   │   ├── media.py             # 파일 업로드 + 썸네일 (storage.py 통해 저장)
│   │   ├── menus.py             # 동적 메뉴
│   │   ├── posts.py             # 포스트 CRUD + 소유권 + 검색(q) + 페이지네이션
│   │   └── settings.py          # 사이트 설정 (site_skin 포함)
│   ├── migrations/              # Flask-Migrate (반드시 git 커밋)
│   ├── models/schema.py         # SQLAlchemy ORM 모델
│   ├── app.py                   # Flask 팩토리 + 자동 마이그레이션
│   ├── config.py                # Dev/Prod 설정
│   ├── database.py              # db = SQLAlchemy(model_class=Base)
│   ├── storage.py               # StorageBackend 추상화 (LocalStorage / R2Storage 예정)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── auth.js          # 인증 API
│       │   ├── posts.js         # 포스트 API (page/per_page/q 파라미터 포함)
│       │   ├── admin.js         # Admin API (page/per_page/q/status 파라미터 포함)
│       │   ├── comments.js      # 댓글 API (listAllComments page/per_page 포함)
│       │   ├── media.js         # 미디어 업로드 API (uploadMedia)
│       │   └── settings.js      # 사이트 설정 API (getSettings, updateSettings)
│       ├── components/
│       │   ├── Nav.jsx          # role별 네비게이션 (Admin: 사이트 설정 링크 포함)
│       │   ├── CommentSection.jsx
│       │   └── widgets/
│       │       └── RecentPosts.jsx
│       ├── context/
│       │   ├── ThemeContext.jsx  # 라이트/다크 모드 (useTheme)
│       │   └── SkinContext.jsx   # 스킨 4종 관리 (useSkin, SKINS 목록)
│       ├── hooks/
│       │   └── useInfiniteScroll.js  # IntersectionObserver 기반 인피니트 스크롤
│       └── pages/
│           ├── admin/
│           │   ├── AdminPosts.jsx     # 포스트 관리 (검색+필터+무한스크롤)
│           │   ├── AdminUsers.jsx     # 회원 관리
│           │   ├── AdminComments.jsx  # 댓글 관리 (무한스크롤)
│           │   └── AdminSettings.jsx  # 사이트 설정 (스킨 선택)
│           ├── MyPosts.jsx       # 내 블로그 (editor 로그인 후, 무한스크롤)
│           ├── PostList.jsx      # 전체 공개 글 (검색+무한스크롤)
│           ├── PostDetail.jsx    # 추천 버튼 + 댓글 섹션 + Markdown/HTML 렌더링 분기
│           └── PostEditor.jsx    # WYSIWYG(Quill+이미지업로드) + Markdown(이미지삽입버튼) 탭 전환
├── docs/
│   ├── superpowers/             # 설계 스펙 및 구현 계획서
│   ├── BACKEND_ARCHITECTURE_ANALYSIS.md
│   ├── FE_Architecture_Analysis_2026-03-26.md
│   ├── INFRA_ANALYSIS_REPORT.md
│   └── 멀티유저블로그_UX기획_분석보고서.md
├── .github/workflows/deploy.yml
├── docker-compose.yml           # 로컬 개발 (nginx-files 포함, 컨테이너 시작 시 npm install)
└── docker-compose.prod.yml      # 프로덕션 (Gunicorn 4 workers + Nginx + uploads_data 볼륨)
```
