## 프로젝트 관리

**GitHub Projects:** https://github.com/users/funny419/projects/1
- Done (47개): 완료된 기능
- Todo (2개): 미구현 기능
- 기능 추가/완료 시 상태 업데이트 필요 (`gh project item-edit` 또는 웹 UI)

**관련 분석 문서** (`.claude/rules/` 폴더):
- `sprint-planning.md` — **UX 기획 전략 · 미래 로드맵 상세** (2026-03-30 Sprint 2 완료 반영)
  - Sprint 2 완료 요약 / 카테고리-태그 UX 설계 원칙
  - Phase 2.5: 블로그 설정 (SNS, 대표색상) / Phase 3.1: 고급 레이아웃
  - 멀티유저 플랫폼 확장 로드맵 (Phase 1~3) / 성공 지표(KPI)

---

## 구현 현황

> 마지막 업데이트: 2026-04-01
> 최근 완료: Setup Wizard Phase 2 (DB 연결 UI + .env 동적 생성 + 마이그레이션)
> 스팩아웃 확정: 포스트 예약 발행, 알림 시스템(Socket.IO)

### 완료

| 영역 | 기능 |
|------|------|
| 인증 | 로그인/회원가입/프로필 수정/JWT/RBAC/deactivated 차단 |
| 포스트 | CRUD API + WYSIWYG 에디터(react-quill-new) + 소유권 검사 |
| 포스트 에디터 | WYSIWYG/Markdown 탭 전환 (`content_format` 컬럼), Markdown 후 WYSIWYG 전환 불가(잠금), 다크모드 대응 |
| 포스트 에디터 이미지 | WYSIWYG: 툴바 이미지 버튼 → 파일 업로드 → Quill에 삽입. Markdown: "🖼 이미지 삽입" 버튼 → `![이미지](url)` 추가 |
| 포스트 통계 | 조회수(view_count) + 댓글수 + 추천수 — PostList/PostDetail에 표시 |
| 포스트 추천 | 로그인 사용자 추천/취소 토글, 본인 글 추천 불가, 1인 1추천(DB UniqueConstraint) |
| 페이지네이션 | Offset 기반 + 인피니트 스크롤 — PostList/MyPosts/AdminPosts/AdminComments 4개 페이지, `useInfiniteScroll` 공통 훅 |
| 포스트 검색/필터 | PostList — 제목 키워드 검색(`?q=`, 300ms 디바운스), AdminPosts — 제목 검색 + 상태 필터 |
| 개인 블로그 | `/my-posts` — 내 글 전체(draft+published), 편집/삭제 |
| 미디어 | 파일 업로드 + Pillow 썸네일(300×300) + uuid 파일명 + path traversal 방어. `StorageBackend` 추상화 |
| 파일 서버 | 개발: `nginx-files` 컨테이너. 프로덕션: Nginx + `uploads_data` named volume |
| 댓글 | 계층형(1단 답글) + 로그인/게스트 분기 + 수정/삭제 소유권 인증 + 스팸 필터링 |
| 댓글 승인/거절 | Admin UI — 게스트 댓글 승인/거절 버튼 (BE API + FE) |
| 사이트 스킨 | 프리셋 4종(Notion/Forest/Ocean/Rose), Admin에서 선택, 즉시 미리보기, 다크모드 연동 |
| Admin 대시보드 | 포스트/회원/댓글 관리 + 사이트 설정(스킨) |
| 포스트 임시저장 | localStorage 자동 저장 (10초 간격) |
| 포스트 공개범위 | `visibility` 컬럼 (public/members_only/private) + API 필터 + FE 셀렉트 |
| **프로필 커스터마이징** | **`bio`, `avatar_url` 컬럼 + FE 편집 UI + DB 마이그레이션** |
| **유저별 블로그** | **`/blog/:username` 페이지 + ProfileCard + CategorySidebar + TagCloud 통합** |
| **카테고리 시스템** | **`categories` 테이블(계층형 3단) + CRUD API 6개 + CategoryDropdown + CategorySidebar FE + PostEditor/PostList 통합** |
| **태그 시스템** | **`tags`, `post_tags` 테이블 + CRUD API 5개 + TagInput + TagCloud FE + PostEditor/PostDetail 통합** |
| **사용자 조회 API** | **`GET /api/users/:username` + `python-slugify` 추가** |
| 인프라 | Docker Watch(로컬) + Gunicorn 4 workers(프로덕션) + CI/CD |
| **개발 도구** | **pre-commit 피드백 루프** — ruff(lint+autofix) → mypy → pytest → eslint. 실패 시 Claude 자가수정 트리거 (`scripts/pre-commit.sh`, `scripts/setup-hooks.sh`). ESLint staged files 버그 수정 완료. pytest 환경 구축 (conftest.py + TestConfig + 14개 테스트) |
| **Claude Code 스킬** | **12개 프로젝트 특화 스킬** — `new-api-endpoint`, `db-migration`, `new-page`, `code-review`, `test-generation`, `dba-query`, `db-erd`, `api-docs`, `infra`, `debug`, `deploy`, `service-planning` |
| **구독/이웃** | **`follows` 테이블 + 팔로우/언팔로우/팔로워목록/팔로잉목록 API + `/feed` 이웃 피드 페이지 + ProfileCard 팔로우 버튼 FE** |
| **블로그 커스터마이제이션** | **`blog_title`, `blog_color`, `website_url`, `social_links` 컬럼 + `/my-blog/settings` 설정 페이지 (기본정보/디자인 탭) + ProfileCard 배너색상·SNS링크 반영** |
| **블로그 레이아웃 (A/B/C/D)** | **`blog_layout` 컬럼 + `posts.thumbnail_url` 컬럼 + 레이아웃 선택 UI + BlogHome 4종 분기 (BlogLayoutDefault/Compact/Magazine/Photo)** |
| **블로그 홈 통계 위젯** | **`total_view_count`, `total_comment_count` 집계 API + `StatsWidget.jsx` (포스트/조회수/댓글/팔로워 4종)** |
| **온보딩 모달** | **`OnboardingModal.jsx` — 첫 로그인 editor 대상, 블로그 설정 유도** |
| **RSS 피드** | **`GET /blog/:username/feed.xml` RSS 2.0 (python-feedgen)** |
| **검색 고도화** | **`GET /api/posts?q=` FULLTEXT MATCH...AGAINST + `?category_id`, `?author`, `?tags` 필터. FE `Search.jsx` (작성자/카테고리/태그 필터 + URL params) — BE/FE 모두 구현 완료** |
| **포스트 시리즈** | **`series`, `series_posts` 테이블 + CRUD API + `GET /api/users/:username/series` + `GET /api/posts/:id` series 필드 임베드. FE: `SeriesDropdown.jsx`(PostEditor) + `SeriesNav.jsx`(PostDetail) + BlogHome 시리즈 목록 섹션. 커밋: 032eba1(DB), 591e8bf(BE), 6aae81c(FE)** |
| **블로그 통계 대시보드** | **`GET /api/blog/:username/stats` (본인/admin, ?period=7d\|30d\|90d) + `GET /api/admin/stats/:username`. FE: `Statistics.jsx` + `stats.js` + recharts@3.8.1. 커밋: c41519a(BE), 2b074c7(FE)** |
| **소셜 공유 버튼** | **`ShareButtons.jsx` 신규 + PostDetail.jsx 수정. Web Share API(모바일) + URL 복사 fallback. BE 작업 없음. 커밋: aff94dc** |
| **Setup Wizard (Phase 1+2)** | **Phase 1: `GET /api/wizard/status` + `POST /api/wizard/setup`. Phase 2: `POST /api/wizard/db-test` (4종 오류 분류) + `POST /api/wizard/env` (.env 동적 생성, chmod 0o600) + `POST /api/wizard/migrate` (already exists→stamp+retry, Multiple head→409). FE: SetupWizard.jsx 5단계 + localStorage step 복원. docker-compose.yml: depends_on service_started+required:false. 커밋: 7024855(P1), 3a3f3ae(docker), d3a28bd(BE), 7cfd47d(FE)** |

### 미구현

| 기능 | 비고 | 상태 |
|------|------|------|
| (없음) | 모든 계획 기능 구현 완료 | - |

#### 스팩아웃 (2026-03-31 확정)

| 기능 | 제거 사유 |
|------|---------|
| 포스트 예약 발행 | APScheduler + Gunicorn 4 workers 중복 실행 문제. Redis 없이 분산 락 불가. 구현 비용 대비 사용 빈도 낮음 |
| 알림 시스템 (Socket.IO) | Gunicorn sync → eventlet/gevent 교체 필요. Redis 없이 멀티워커 브로드캐스트 불가. 아키텍처 전면 교체 수준 부담 |

---

> **플랫폼 확장 로드맵** (멀티유저 블로그 플랫폼 전환 전략, 성공 지표 KPI):
> `sprint-planning.md` 참조 — "멀티 유저 블로그 플랫폼 확장 로드맵" 및 "성공 지표(KPI)" 섹션
