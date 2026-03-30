## 주요 API 엔드포인트

### 포스트 API

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/posts` | 공개 | published 포스트 목록. 파라미터: `?page=1&per_page=20&q=검색어&category_id=5&author=username` (페이지네이션+검색+필터). visibility는 JWT 여부로 자동 결정 (비로그인=public만, 로그인=public+members_only+본인private) |
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
| `GET /api/auth/me` | 로그인 | 현재 사용자 조회 (id, username, email, role, bio, avatar_url, created_at 포함) |
| `PUT /api/auth/me` | 로그인 | 프로필 수정 (username, email, bio, avatar_url) |
| `GET /api/auth/users/:username` | 공개 | 유저 블로그 프로필 조회 (id, username, bio, avatar_url, post_count, created_at). 404: 없음/비활성화된 사용자 |

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
