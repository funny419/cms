## 트러블슈팅

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
