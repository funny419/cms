## 프로젝트 관리

**GitHub Projects:** https://github.com/users/funny419/projects/1
- Done (93개): 완료된 기능
- Todo (1개): 게스트북 (미래 로드맵)
- 기능 추가/완료 시 상태 업데이트 필요 (`gh project item-edit` 또는 웹 UI)

**관련 분석 문서** (`.claude/rules/` 폴더):
- `sprint-planning.md` — **UX 기획 전략 · 미래 로드맵 상세** (2026-03-30 Sprint 2 완료 반영)
  - Sprint 2 완료 요약 / 카테고리-태그 UX 설계 원칙
  - Phase 2.5: 블로그 설정 (SNS, 대표색상) / Phase 3.1: 고급 레이아웃
  - 멀티유저 플랫폼 확장 로드맵 (Phase 1~3) / 성공 지표(KPI)

---

## 구현 현황

> 마지막 업데이트: 2026-04-10
> 최근 완료: #29 RSS 피드 nginx/vite 라우팅 수정 (fdfdb58, e86cecb) + #30 posts.slug UNIQUE 제약 + slug 중복 409 (ed5c206, e5d7d13) + #66 AdminUsers 페이지네이션+인피니트스크롤 (2eef8e9, bfe1250) + #31 list_posts N+1 → GROUP BY 단일 쿼리 (37dd1a6)
> 스팩아웃 확정: 포스트 예약 발행, 알림 시스템(Socket.IO), JWT 블랙리스트

### 완료

| 영역 | 기능 |
|------|------|
| 인증 | 로그인/회원가입/프로필 수정/JWT/RBAC/deactivated 차단 |
| 포스트 | CRUD API + WYSIWYG 에디터(react-quill-new) + 소유권 검사 |
| 포스트 에디터 | WYSIWYG/Markdown 탭 전환 (`content_format` 컬럼), Markdown 후 WYSIWYG 전환 불가(잠금), 다크모드 대응 |
| 포스트 에디터 이미지 | WYSIWYG: 툴바 이미지 버튼 → 파일 업로드 → Quill에 삽입. Markdown: "🖼 이미지 삽입" 버튼 → `![이미지](url)` 추가 |
| 포스트 통계 | 조회수(view_count) + 댓글수 + 추천수 — PostList/PostDetail에 표시 |
| 포스트 추천 | 로그인 사용자 추천/취소 토글, 본인 글 추천 불가, 1인 1추천(DB UniqueConstraint) |
| 페이지네이션 | Offset 기반 + 인피니트 스크롤 — PostList/MyPosts/AdminPosts/AdminComments/AdminUsers 5개 페이지, `useInfiniteScroll` 공통 훅 |
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
| **BE 리팩토링** | **Issue #13~#17 완료 (2026-04-06)**. `api/helpers.py` 신규(페이지네이션/응답/게스트인증 헬퍼), comments.py 게스트인증 중복 제거, get_post()/list_posts() 내부 함수 분해. Service Layer(P5) 장기 보류 확정. 커밋: 50a28c5(#14), helpers 일부 포함 |
| **DB 리팩토링** | **Issue #18~#21 완료 (2026-04-06)**. `idx_comments_post_status_created`, `idx_post_tags_tag_id`, `idx_post_likes_user_id` 인덱스 3개 추가(커밋: 83c2b7f). `MAX_CATEGORY_DEPTH` → `models/constants.py` 이동. `schema.py` → `models/` 10개 파일 분리. User.set_password/check_password 이동 스킵(Flask 표준 관례) |
| **FE 리팩토링** | **Issue #22~#27 완료 (2026-04-06)**. `useAuth.js`(#22, 2f4f9b1), `api/client.js`(#23, 898298b), `useFetch.js`(#24, 8b43ad4), `usePostEditor.js`(#25, a7b5f99), BlogLayout Props Drilling 해소(#26, b81bd24), BlogHome LAYOUTS 맵 패턴(#27, 0646dd0). Vitest `usePostEditor.test.jsx` 3개 TC |
| **Playwright E2E** | **High 우선순위 38개 TC 전체 자동화 완료 (2026-04-06)**. 9개 spec 파일: admin/layout/access-control/auth-guard/series/stats/follow/admin-actions/misc. 커밋: 57214b2(환경), afa099d(7개), 63a27e5(+9개), 80829d8(+22개) |
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
| **모델 파일 도메인별 분리** | **`models/schema.py` 단일 480줄 파일 → `models/` 디렉토리 10개 파일 분리 (Issue #21). base.py/user.py/post.py/comment.py/media.py/category.py/tag.py/series.py/option.py/constants.py + __init__.py re-export. 커밋: d02d633, 68bbc24** |
| **보안 강화** | **보안 이슈 9개 전체 처리 (2026-04-07). P1: #1 이메일 노출 제거, #2 댓글 승인 권한(admin 전용), #3 Wizard /migrate 차단, #8 파일 업로드 크기 제한, #9 미디어 조회 권한 분리(admin=전체/editor=본인). P2: #4 MIME magic bytes 검증(python-magic), #5 Flask-Limiter(POST /login 10/min). P3: #7 get_client_ip() X-Real-IP 우선 사용. #6 JWT 블랙리스트 스팩아웃 확정. 커밋: bd640c4/13dce39/31c3cbf/459b7b3** |
| **보안 테스트 보강** | **pytest 319→327개 (+8). Flask-Limiter/MIME/IP추출/미디어권한 통합 테스트 추가. 커밋: 776bc16** |
| **PostEditor 파일 검증** | **파일 input accept 속성 + 10MB 클라이언트 사이드 크기 제한 추가. 커밋: 524f030** |
| **DB 인덱스 추가** | **visit_logs.idx_visit_logs_visited_at + posts.idx_posts_status_visibility_created 복합 인덱스. 마이그레이션: 5d92b5bbdf0c. 커밋: e9d5398** |
| **BUG-7 수정** | **Flask-Limiter 429 HTML 응답 → JSON 변환 (BE: fa1fc0c). E2E getToken→storageState 교체로 rate limit 조기 발동 방지 (E2E: 0b5fe25). 37 passed** |
| **운영 정책 문서화** | **troubleshooting.md 8개 항목 추가 (pytest DB격리/TRUNCATE 표준, E2E 타이밍 패턴, pre-commit 에스컬레이션) + team-operations.md 6개 항목 추가 (파일 소유권/스테이징/세션재개/인프라규칙). 커밋: 0ef1ea0** |
| **RSS 피드 라우팅 수정 (#29)** | **프로덕션 Nginx + 개발 Vite dev server에서 `/blog/:username/feed.xml` → BE 프록시 누락 수정. RSS 리더에 HTML 반환되던 문제 해소. 커밋: fdfdb58(nginx), e86cecb(vite)** |
| **posts.slug UNIQUE 제약 (#30)** | **`posts.slug` 컬럼 INDEX → UNIQUE 변경 + 마이그레이션(bd7da55c). `POST/PUT /api/posts` slug 중복 시 409 반환 (자기 자신 제외 체크). 커밋: ed5c206(DB), e5d7d13(API)** |
| **AdminUsers 페이지네이션 (#66)** | **`GET /api/admin/users` 페이지네이션 적용 — 응답 포맷 flat list → `{ items, total, page, per_page, has_more }`. AdminUsers.jsx useInfiniteScroll 훅 적용 + useAuth() 통일. 커밋: 2eef8e9(BE), bfe1250(FE)** |
| **list_posts N+1 쿼리 개선 (#31)** | **`list_posts()` 포스트 목록 조회 시 N+1 문제 해소 — comment_sq/like_sq scalar_subquery → `outerjoin + GROUP BY` 단일 쿼리. 포스트 20개 기준 추가 쿼리 40회 → 0회. 커밋: 37dd1a6** |

### 미구현

| 기능 | 비고 | 상태 |
|------|------|------|
| (없음) | 모든 계획 기능 구현 완료 | - |

#### 스팩아웃 (2026-03-31 확정)

| 기능 | 제거 사유 |
|------|---------|
| 포스트 예약 발행 | APScheduler + Gunicorn 4 workers 중복 실행 문제. Redis 없이 분산 락 불가. 구현 비용 대비 사용 빈도 낮음 |
| 알림 시스템 (Socket.IO) | Gunicorn sync → eventlet/gevent 교체 필요. Redis 없이 멀티워커 브로드캐스트 불가. 아키텍처 전면 교체 수준 부담 |
| `post_meta` 테이블 (#50) | 실제 사용하는 API/기능 없음. meta_key/meta_value 자유형 구조 대신 필요 시 전용 컬럼으로 대체. 2026-04-13 확정 |

---

> **플랫폼 확장 로드맵** (멀티유저 블로그 플랫폼 전환 전략, 성공 지표 KPI):
> `sprint-planning.md` 참조 — "멀티 유저 블로그 플랫폼 확장 로드맵" 및 "성공 지표(KPI)" 섹션
