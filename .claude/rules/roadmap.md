## 프로젝트 관리

**GitHub Projects:** https://github.com/users/funny419/projects/1
- Done (24개): 완료된 기능
- Todo (18개): Phase 1~3 미구현 기능 + 기존 기능 개선
- 기능 추가/완료 시 상태 업데이트 필요 (`gh project item-edit` 또는 웹 UI)

**관련 분석 문서** (`.claude/rules/` 폴더):
- `sprint-planning.md` — **Sprint 2 기획 분석 + 블로그 커스터마이제이션 전략** (2026-03-30)
  - Sprint 2 구현 순서: 블로그 홈 → 태그 → 카테고리 → 블로그 홈 완성 (6주)
  - Phase 2.5: 프로필 커스터마이제이션 (사진, bio, SNS) + 배너 색상 (1.5주)
  - Phase 3.1: 고급 레이아웃 선택 + 폰트 설정 (2주)

---

## 구현 현황

> 마지막 업데이트: 2026-03-31
> 최근 완료: Sprint 1 + Sprint 2 (기획 분석 참고: `.claude/rules/sprint-planning.md`)

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

### 미구현

#### Phase 1 — 기본 블로그 구조 (진행 중)

| 기능 | 비고 | 상태 |
|------|------|------|
| 검색 고도화 | DB Fulltext 인덱스. `/search` FE 페이지 (작성자/카테고리/태그 필터) | 미구현 |

#### Phase 2 — 공개 제어 및 예약 발행 (진행 중)

| 기능 | 비고 | 상태 |
|------|------|------|
| 포스트 예약 발행 | `posts.published_at` + APScheduler 1분 간격 자동 발행 | 미구현 |

#### Phase 3 — 상호작용 및 분석

| 기능 | 비고 |
|------|------|
| 구독/이웃 | `follows` 테이블. `GET /api/feed` 피드 페이지 |
| 알림 시스템 | `notifications` 테이블 + Socket.IO |
| 블로그 통계 | `visit_logs` + 집계. recharts 대시보드 |
| 포스트 시리즈 | `series` 테이블. 시리즈 네비게이션 컴포넌트 |
| RSS/Atom 피드 | `GET /blog/:username/feed.xml` |
| 소셜 공유 버튼 | PostDetail 하단 공유 버튼 |

#### 기존 기능 개선

| 기능 | 비고 | 상태 |
|------|------|------|
| DB 연결 마법사 (Setup Wizard) | | 미구현 |

---

## 멀티 유저 블로그 플랫폼 확장 로드맵

> 단일 설치형 CMS → 멀티 유저 블로그 플랫폼으로 확장 계획 (2026-03-26 전문가팀 분석)
> **핵심 전제:** 모든 확장은 `blogs` 테이블(유저별 블로그 분리) 생성이 선행되어야 함

### Phase 1 (1-2개월): 기반 구조

| 영역 | 작업 |
|------|------|
| DB | `blogs`, `categories`, `tags`, `series`, `visit_logs` 테이블. `posts`에 `blog_id`, `visibility`, `published_at` 추가 |
| BE | `GET /api/blog/:username` + 카테고리/태그 API. Redis 캐싱(`flask-caching`). 복합 인덱스 추가 |
| FE | `/blog/:username` 블로그 홈. Zustand 상태관리. Route-based 코드 스플리팅 |
| INFRA | Redis Cluster, Prometheus+Grafana, TLS+Cloudflare WAF |

### Phase 2 (2-3개월): 커뮤니티 기능

| 영역 | 작업 |
|------|------|
| DB | `follows`, `guestbook`, `notifications`, `post_tags`, `visit_daily_stats` 테이블 |
| BE | `POST /api/users/:id/follow`, `GET /api/feed`, `WS /ws/notifications` (Socket.IO) |
| FE | `/feed` 이웃 피드, `/notifications` 알림 센터, `/my-blog/settings` |
| INFRA | DB Read Replica, Cloudflare R2 마이그레이션 |

### Phase 3 (3-6개월): 고도화

| 영역 | 작업 |
|------|------|
| DB | `post_stats`, `series_posts`. `visit_logs` 월별 파티셔닝 |
| BE | RSS 피드, Elasticsearch 전문 검색, 통계 API |
| FE | `/my-blog/statistics` 대시보드(recharts), 블로그 스킨 커스터마이저 |
| INFRA | Kubernetes 전환, 멀티리전 확장 |
