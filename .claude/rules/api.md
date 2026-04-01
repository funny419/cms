## 주요 API 엔드포인트

### Setup Wizard API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/wizard/status` | 공개 | Wizard 완료 여부 조회. 응답: `{ completed: bool, db_connected: bool, has_admin: bool, step: int }`. step: 1=DB미연결, 3=마이그레이션필요, 4=관리자계정필요, 5=완료 |
| `POST /api/wizard/setup` | 공개 (미완료 시에만) | 관리자 계정 생성 + 사이트 설정. 요청: `{ admin: {username, email, password}, site: {site_title, site_url, tagline} }`. 이미 완료 시 409. 비밀번호 8자 미만 시 400. setup 완료 후 `.env`에 `WIZARD_COMPLETED=true` 추가 |
| `POST /api/wizard/db-test` | 공개 | DB 연결 테스트. 요청: `{ host, port, user, password, dbname }`. 응답: `{ error_code: "auth_failed"\|"host_unreachable"\|"db_not_found"\|"invalid_url"\|null }`. 성공 200, 실패 400. 응답에 비밀번호 미포함 |
| `POST /api/wizard/env` | 공개 | .env 파일 생성. 요청: `{ host, port, user, password, dbname, secret_key?, jwt_secret_key? }`. DB 연결 재확인 후 파일 작성(chmod 0o600). `DB_ENV_WRITTEN=true` 시 200+already_written, 첫 작성 201 |
| `POST /api/wizard/migrate` | 공개 | DB 마이그레이션 실행 (`flask db upgrade`). 성공 200. "already exists" → stamp head 후 재시도. "Multiple head" → 409. 실패 500. 응답에 DB 비밀번호 미포함 |

### 포스트 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/posts` | 공개 | published 포스트 목록. 파라미터: `?page=1&per_page=20&q=검색어&category_id=5&author=username&tags=tag1,tag2` (페이지네이션+검색+필터). visibility는 JWT 여부로 자동 결정 (비로그인=public만, 로그인=public+members_only+본인private) |
| `GET /api/posts/:id` | 공개 | 포스트 단건 + view_count +1 (`?skip_count=1` 시 미증가) — `content_format`, `visibility`, `category_id`, `tags[]` 포함. **visibility 접근 제어**: private 글은 작성자/admin만 조회 가능 |
| `POST /api/posts/:id/like` | editor/admin | 추천 토글 (본인 글 불가, 1인 1추천) |
| `GET /api/posts/mine` | 로그인 | 내 글 전체. 파라미터: `?page=1&per_page=20` |
| `POST /api/posts` | editor/admin | 글 작성. 요청: `title`, `content`, `excerpt`, `slug`, `status`, `post_type`, `content_format` ('html'\|'markdown'), `visibility` ('public'\|'members_only'\|'private'), `category_id`, `tags: [id, ...]` |
| `PUT /api/posts/:id` | 소유자/admin | 수정 (소유권 검사). 요청 필드 동일 |
| `DELETE /api/posts/:id` | 소유자/admin | 삭제 (소유권 검사) |

### 인증 & 사용자 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `POST /api/auth/register` | 공개 | 회원가입. 요청: `username`, `email`, `password`. 생성 role: editor |
| `POST /api/auth/login` | 공개 | 로그인. 요청: `username`, `password`. 응답: `access_token`, `user` |
| `GET /api/auth/me` | 로그인 | 현재 사용자 조회. 응답: id, username, email, role, bio, avatar_url, blog_title, blog_color, website_url, social_links, blog_layout, banner_image_url, created_at |
| `PUT /api/auth/me` | 로그인 | 프로필 수정. 요청: username, email, bio, avatar_url, blog_title, blog_color(#rrggbb 형식), website_url, social_links(JSON), blog_layout(default\|compact\|magazine\|photo), banner_image_url |
| `GET /api/auth/users/:username` | 공개 | 유저 블로그 프로필 조회. 응답: User 전체 필드 + post_count, follower_count, following_count, is_following(선택적JWT), total_view_count, total_comment_count. 404: 없음/비활성화된 사용자 |
| `GET /api/auth/users/search` | 공개 | 작성자 자동완성용 유저 검색. 파라미터: `?q=username_prefix`. 비활성화 제외, 최대 10건. 응답: `{ items: [{id, username}] }` |

### 카테고리 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/categories` | 공개 | 카테고리 flat list 전체 반환 (페이지네이션 없음). 응답: id, name, slug, description, parent_id, post_count, created_at. parent_id asc → order asc 정렬 |
| `POST /api/categories` | admin | 카테고리 생성. 요청: `name`, `slug` (선택, 자동생성), `description` (선택), `parent_id` (선택). 깊이 3단 제한 검증 |
| `GET /api/categories/:id` | 공개 | 카테고리 단건 + 자식 목록 조회. 응답: id, name, slug, description, parent_id, children[], post_count, created_at |
| `PUT /api/categories/:id` | admin | 카테고리 수정. 요청: name, slug, description, parent_id |
| `DELETE /api/categories/:id` | admin | 카테고리 삭제 (포스트 category_id → null, FK 제약 안 함) |
| `GET /api/categories/:id/posts` | 공개 | 카테고리별 포스트 목록 (visibility 필터 포함). 파라미터: `?page=1&per_page=20&status=published`. list_posts 동일 응답 |

### 태그 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/tags` | 공개 | 태그 목록 (빈도 순 정렬, 페이지네이션). 파라미터: `?page=1&per_page=50`. 응답: id, name, slug, post_count, created_at |
| `POST /api/tags` | admin | 태그 생성. 요청: `name`, `slug` (선택, 자동생성) |
| `GET /api/tags/:id` | 공개 | 태그 단건 조회. 응답: id, name, slug, post_count, created_at |
| `DELETE /api/tags/:id` | admin | 태그 삭제 (PostTag 레코드 CASCADE 삭제) |
| `GET /api/tags/:id/posts` | 공개 | 태그별 포스트 목록 (visibility 필터 포함, 페이지네이션). 파라미터: `?page=1&per_page=20&status=published`. list_posts 동일 응답 |

### 댓글 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/comments/post/:id` | 공개 | 포스트별 승인된 댓글 목록 |
| `POST /api/comments` | 공개 | 댓글 작성 (로그인=즉시공개, 게스트=이름+이메일+패스워드 필수+승인대기) |
| `PUT /api/comments/:id` | 소유자/게스트인증 | 댓글 수정 (로그인=author_id 일치, 게스트=이메일+패스워드 인증) |
| `DELETE /api/comments/:id` | admin/소유자/게스트인증 | 댓글 삭제 (cascade 답글 포함) |

### 사이트 설정 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/settings` | 공개 | 사이트 설정 조회 (`site_title`, `site_skin` 등) |
| `PUT /api/settings` | admin | 사이트 설정 수정 (`site_skin` 포함) |

### 미디어 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/media` | editor/admin | 미디어 목록 (응답: `url`, `thumbnail_url` 포함) |
| `POST /api/media` | editor/admin | 파일 업로드. 응답: `{ url: "/uploads/...", thumbnail_url: "/uploads/thumb_..." }` |

### 어드민 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/admin/posts` | admin | 전체 포스트 관리. 파라미터: `?page=1&per_page=20&q=검색어&status=published` (status 필터 포함) |
| `GET /api/admin/users` | admin | 전체 회원 목록 (deactivated 포함) |
| `GET /api/admin/users/:id/posts` | admin | 특정 회원의 포스트 전체 조회 |
| `GET /api/admin/comments` | admin | 전체 댓글 목록 (post_title 포함). 파라미터: `?page=1&per_page=20&status=pending\|approved\|spam` |
| `PUT /api/admin/comments/:id/approve` | admin | 게스트 댓글 승인 (pending → approved) |
| `PUT /api/admin/comments/:id/reject` | admin | 댓글 스팸 처리 (pending/approved → spam) |
| `PUT /api/admin/users/:id/role` | admin | 권한 변경 |
| `PUT /api/admin/users/:id/deactivate` | admin | 비활성화 |
| `DELETE /api/admin/users/:id` | admin | 회원 삭제 (포스트·댓글 orphan 처리) |
| `GET /api/admin/stats/:username` | admin | 특정 유저 통계 조회. 파라미터: `?period=7d\|30d\|90d`. 응답: daily, top_posts, total_views, total_posts, follower_count, total_comments |

### 팔로우 & 이웃 피드 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `POST /api/users/:username/follow` | 로그인 | 팔로우. 응답: `{ following: true }`. 신규 팔로우 201, 이미 팔로우 중 200. 자기 팔로우 400 |
| `DELETE /api/users/:username/follow` | 로그인 | 언팔로우. 응답: `{ following: false }` |
| `GET /api/users/:username/followers` | 공개 | 팔로워 목록. 파라미터: `?page=1&per_page=20` (per_page 최대 100). 응답: `items[{id, username, avatar_url}]`, `total`, `has_more` |
| `GET /api/users/:username/following` | 공개 | 팔로잉 목록. 파라미터: `?page=1&per_page=20` (per_page 최대 100). 응답: `items[{id, username, avatar_url}]`, `total`, `has_more` |
| `GET /api/feed` | 로그인 | 이웃 피드 (팔로우한 사람의 published+public/members_only 포스트). 파라미터: `?page=1&per_page=20`. 응답: items, total, has_more |

### 시리즈 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/users/:username/series` | 공개 | 유저 시리즈 목록. 응답: `[{id, title, slug, description, total, created_at}]` |
| `GET /api/series/:id` | 공개 | 시리즈 단건 + 포스트 목록. 응답: `{id, title, slug, description, author_id, total, posts[{id, title, order}], created_at}` |
| `POST /api/series` | editor/admin | 시리즈 생성. 요청: `title`, `description`(선택). slug 자동 생성 |
| `PUT /api/series/:id` | 소유자/admin | 시리즈 수정. 요청: `title`, `description` |
| `DELETE /api/series/:id` | 소유자/admin | 시리즈 삭제 (series_posts CASCADE 삭제) |
| `POST /api/series/:id/posts` | 소유자/admin | 시리즈에 포스트 추가. 요청: `post_id`, `order`(선택) |
| `DELETE /api/series/:id/posts/:post_id` | 소유자/admin | 시리즈에서 포스트 제거 |
| `PUT /api/series/:id/posts/reorder` | 소유자/admin | 포스트 순서 변경. 요청: `items: [{post_id, order}]` |

### 블로그 통계 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/blog/:username/stats` | 본인/admin | 블로그 통계 조회. 파라미터: `?period=7d\|30d\|90d` (기본 7d). 응답: `daily[{date, count}]`, `top_posts[{id, title, view_count, slug}]`, `total_views`, `total_posts`, `follower_count`, `total_comments` |

### RSS 피드

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /blog/:username/feed.xml` | 공개 | RSS 2.0 피드. 최근 20개 published+public 포스트. `SITE_URL` 환경변수 또는 `request.host_url` 기반 동적 생성 |
