## 트러블슈팅

**모델 파일 분리 (models/ 디렉토리, Issue #21 이후):**
- `from models.schema import X` ImportError: `schema.py`는 삭제됨 → `from models import X`로 변경
- 새 모델 추가 후 Alembic이 해당 테이블을 DROP으로 감지: `models/__init__.py`에 re-export 누락 → 반드시 `__init__.py`에 추가 후 `flask db migrate` 재실행
- 새 도메인 상수(`MAX_DEPTH` 등) 추가 위치: `models/constants.py` (config.py가 아님 — config.py는 환경/배포 설정 전용)
- 크로스 파일 forward reference 오류 (`Mapped["Post"]`에서 ruff F821 또는 mypy name-defined): `from __future__ import annotations` + `TYPE_CHECKING` 블록으로 조건부 import 추가

**Docker 빌드:**
- `SELF_SIGNED_CERT_IN_CHAIN`: 개발용 `frontend/Dockerfile`에 `npm config set strict-ssl false` 적용됨
- `npm ci` 실패(lock 불일치): 개발용은 `npm install` 사용, `Dockerfile.prod`만 `npm ci` 사용
- Gunicorn 500: `app:create_app()` 팩토리 문법 확인 → `docker exec cms_backend_prod python app.py`로 ImportError 확인
- 프론트엔드 패키지 누락(`Failed to resolve import`): `docker compose build frontend && docker compose up -d frontend` — 이미지 재빌드로 해결. 이후에는 `docker compose up -d`만으로 자동 설치됨 (command에 `npm install` 포함)

**API 연결:**
- Docker 내부 API 호출 실패: `vite.config.js`의 `BACKEND_URL` 환경변수 확인
- 업로드 이미지 로드 실패: `vite.config.js`의 `FILES_URL` 환경변수 확인 (`http://nginx-files:80`), `nginx-files` 컨테이너 실행 여부 확인
- 테이블 없음 오류: `docker exec cms_backend_prod flask db upgrade` 실행
- JWT "Subject must be a string": `create_access_token(identity=str(user.id))` 확인

**Flask-Limiter 429 응답:**
- 기본 동작: HTML 반환 → FE/E2E에서 JSON 파싱 오류 발생
- 해결: `app.py`에 `@app.errorhandler(RateLimitExceeded)` 등록하여 JSON 응답 반환 (커밋: fa1fc0c)
- 테스트 환경: `TestConfig.RATELIMIT_ENABLED = False` 설정으로 rate limit 비활성화
- **`rl_client` 픽스처에서 `create_app()` 재호출 시 test DB 오염**: 새 앱 인스턴스가 TestConfig를 무시하고 운영 DB에 접속 → `conftest.py`의 `app` 픽스처를 의존성으로 받아 `app.test_client()` 재사용해야 함 (environment.md pytest 정책 참조)

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

**스킨 관련:**
- 스킨 적용 안됨: `GET /api/settings` 응답에 `site_skin` 포함 여부 확인. `PUBLIC_KEYS`에 `site_skin` 있어야 함.
- 스킨 CSS 미적용: `index.css`의 `[data-skin="forest"]:root` 선택자가 `html` 엘리먼트의 `data-skin` 속성과 매칭되는지 확인 (`SkinContext`가 `document.documentElement`에 속성 설정)

**권한 관련:**
- User 모델 DB 기본값(`default='subscriber'`)과 register API(`role='editor'`)가 다름 — 회원가입 API로 생성된 계정은 항상 editor. DB에 직접 삽입한 계정은 subscriber가 될 수 있어 PostEditor 접근 시 전체 글 페이지로 리다이렉트될 수 있음 → `UPDATE users SET role='editor' WHERE username='...'` 로 수정

**pre-commit 훅:**
- `pytest exit 5`: 테스트 파일 없음 — 정상 (pass로 처리됨)
- Docker 컨테이너 미실행 시: 해당 언어 검사를 건너뜀 (오류 아님)
- ruff 경로 오류(`No such file or directory: backend`): Docker 내부에서 경로는 `backend/`가 아닌 `.` (`/app` 루트) — `scripts/pre-commit.sh` 확인
- 훅 미설치: `bash scripts/setup-hooks.sh` 실행 (새 클론 후 1회 필요)
- ruff auto-fix 후 diff가 생김: 정상 — 수정된 파일이 자동 재스테이징되어 같이 커밋됨
- **ESLint staged files 경로 오류 (커밋 0a034a10 수정)**: `No such file or directory: frontend/src/` — `scripts/pre-commit.sh` line 70에서 `sed 's|^frontend/||'`로 컨테이너 내부 경로(`/app`)로 변환하도록 수정. staged files만 lint하는 방식 적용.
- **react-hooks/rules-of-hooks ESLint 에러 (useEffect + setState)**: 비동기 작업 중 unmount 시 setState 호출 제한 — `async/cancelled` 패턴으로 수정: `useEffect(() => { let cancelled = false; const fetchData = async () => { /*...*/ if (!cancelled) setState(...) }; return () => { cancelled = true } })`. BlogHome.jsx 등 비동기 페칭 컴포넌트에 적용.

**Setup Wizard Phase 2:**
- Wizard Step 1에서 DB 연결 실패 시 오류 코드 분류: `auth_failed`(비밀번호 틀림) / `host_unreachable`(호스트 미도달) / `db_not_found`(DB 없음 또는 권한 없음) / `invalid_url`(URL 형식 오류)
- `db_not_found` vs `auth_failed` 혼동: MariaDB에서 존재하지 않는 DB 접근 시 권한 없는 사용자의 경우 `Access denied ... to database '...'` 오류 발생 → `to database` 키워드로 `db_not_found` 분류 (wizard_phase2.py:32-35)
- Step 2 재시작 후 Step 3로 진행 안됨: `docker compose restart backend` 실행 후 "재시작 완료 — 새로고침" 버튼 클릭 필요. 새로고침 없이는 Step 2 유지됨
- Step 3 마이그레이션 실패 (`already exists`): `wizard_phase2.py`에서 자동으로 `flask db stamp head` 후 재시도. 수동으로도 `docker compose exec backend flask db stamp head` 실행 가능
- Step 3 마이그레이션 `Multiple head` 오류: 409 반환 → `docker compose exec backend flask db merge heads -m "merge"` 후 Wizard 재시도
- `DB_ENV_WRITTEN=true` 환경변수 설정 후 Step 2 재실행 시 `already_written: true` 200 반환 (정상) — 재시작 전 중복 작성 방지 로직
- Setup Wizard 완료 후에도 `/wizard`로 리다이렉트됨: admin 계정이 없거나 `.env`에 `WIZARD_COMPLETED=true` 미포함 → `POST /api/wizard/setup` 재실행 또는 직접 추가

**팀 에이전트 (멀티 에이전트) 스폰:**
- `API Error: 500 Invalid model: claude-opus-4-6` — `"opus"` 명시 또는 model 파라미터 **생략** 시 모두 발생. **생략도 금지.**
- **⚠️ 반드시 `model: "sonnet"` 명시할 것 — 생략하면 claude-opus-4-6이 기본값으로 설정되어 500 에러 발생**
- 검증된 model 값: `"sonnet"` (claude-sonnet-4-6), `"haiku"` (claude-haiku-4-5-20251001)
- `"opus"` 단독 지정 및 model 생략 모두 현재 API에서 유효하지 않은 모델 ID로 처리됨 → 에이전트 즉시 오류 종료
- **올바른 스폰 예시**: `Agent(subagent_type: "general-purpose", model: "sonnet", team_name: "...", name: "...")`

**Playwright E2E 테스트:**
- 실행 전제: `docker compose up -d` + FE/BE 모두 정상 기동 상태 (`http://localhost:5173` 접속 가능)
- `npm run test:e2e` 실행 위치: `frontend/` 디렉토리 (또는 `cd frontend && npx playwright test`)
- `globalSetup.js`가 pw_editor 계정을 자동 생성하고 `.auth/` 디렉토리에 storageState 저장
  - pw_editor 계정이 이미 존재하면 로그인만 재시도 (중복 오류 무시)
- `.auth/` 디렉토리는 `.gitignore` 제외됨 — CI/CD 파이프라인에서는 globalSetup이 매번 재실행됨
- `Page.goto` timeout 오류: `docker compose ps`로 모든 컨테이너 healthy 상태 확인 후 재실행
- `AdminPosts` 디바운스 타이밍 이슈: UI 대신 API 레벨로 검증 (TC-A001 — 300ms debounce 우회)
- `SeriesNav` N/M span 선택 충돌: 전역 Nav의 `이전`/`다음` 링크와 SeriesNav 충돌 → XPath로 `.series-nav` 내부 스코핑
- **E2E 병렬 실행 시 Rate Limit 발동**: 다수 spec 파일이 `getToken()`으로 직접 로그인 호출 → 10/min 초과. 해결: `globalSetup.js`의 storageState 활용(`readFileSync` 기반 `getTokenFromStorageState`). `.auth/` 디렉토리에 admin.json, editor.json, editor2.json 저장 (커밋: 0b5fe25)

**팀 에이전트 작업 완료 보고 형식:**
작업 완료 보고 시 아래 항목을 반드시 명시할 것 — roadmap.md/api.md 등 문서 자동 반영을 위함:
- **DB 변경**: 추가/수정된 테이블명 + 컬럼명 (예: `users.blog_layout VARCHAR(20) NULL`)
- **API 변경**: 추가/수정된 엔드포인트 + 요청/응답 필드 변경 (예: `GET /api/auth/users/:username` 응답에 `total_view_count` 추가)
- **컴포넌트 변경**: 신규 생성/수정된 파일 경로 (예: `frontend/src/components/widgets/StatsWidget.jsx` 신규)
- **커밋 해시**: 변경 커밋 ID
- **코드 리뷰**: `code-review.md` 체크리스트 실행 결과 (예: `통과`, `필수 수정 N건`, `미실행`)
  - 코드 변경이 있는 모든 작업에서 필수. 커밋 전 반드시 실행할 것.

예시 보고 형식:
```
[완료 보고]
- DB: posts.thumbnail_url VARCHAR(500) NULL 추가 (마이그레이션: abc1234_add_thumbnail.py)
- API: GET /api/posts 응답에 thumbnail_url 필드 추가
- 컴포넌트: frontend/src/pages/BlogLayoutPhoto.jsx 신규, BlogHome.jsx 수정
- 커밋: a1b2c3d
```
