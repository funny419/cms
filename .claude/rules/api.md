## 주요 API 엔드포인트

| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| `GET /api/posts` | 공개 | published 포스트 목록. 파라미터: `?page=1&per_page=20&q=검색어` (페이지네이션+검색) |
| `GET /api/posts/:id` | 공개 | 포스트 단건 + view_count +1 (`?skip_count=1` 시 미증가) — `content_format` 포함 |
| `POST /api/posts/:id/like` | editor/admin | 추천 토글 (본인 글 불가, 1인 1추천) |
| `GET /api/posts/mine` | 로그인 | 내 글 전체. 파라미터: `?page=1&per_page=20` |
| `POST /api/posts` | editor/admin | 글 작성 (`content_format`: 'html'|'markdown', 기본 'html') |
| `PUT /api/posts/:id` | 소유자/admin | 수정 (소유권 검사, `content_format` 변경 가능) |
| `DELETE /api/posts/:id` | 소유자/admin | 삭제 (소유권 검사) |
| `GET /api/auth/me` | 로그인 | 현재 사용자 조회 |
| `PUT /api/auth/me` | 로그인 | 프로필 수정 |
| `GET /api/settings` | 공개 | 사이트 설정 조회 (`site_title`, `site_skin` 등) |
| `PUT /api/settings` | admin | 사이트 설정 수정 (`site_skin` 포함) |
| `GET /api/media` | editor/admin | 미디어 목록 (응답: `url`, `thumbnail_url` 포함) |
| `POST /api/media` | editor/admin | 파일 업로드. 응답: `{ url: "/uploads/...", thumbnail_url: "/uploads/thumb_..." }` |
| `GET /api/comments/post/:id` | 공개 | 포스트별 승인된 댓글 목록 |
| `POST /api/comments` | 공개 | 댓글 작성 (로그인=즉시공개, 게스트=이름+이메일+패스워드 필수+승인대기) |
| `PUT /api/comments/:id` | 소유자/게스트인증 | 댓글 수정 (로그인=author_id 일치, 게스트=이메일+패스워드 인증) |
| `DELETE /api/comments/:id` | admin/소유자/게스트인증 | 댓글 삭제 (cascade 답글 포함) |
| `GET /api/admin/posts` | admin | 전체 포스트 관리. 파라미터: `?page=1&per_page=20&q=검색어&status=published` |
| `GET /api/admin/users` | admin | 전체 회원 목록 |
| `GET /api/admin/comments` | admin | 전체 댓글 목록 (post_title 포함). 파라미터: `?page=1&per_page=20` |
| `PUT /api/admin/users/:id/role` | admin | 권한 변경 |
| `PUT /api/admin/users/:id/deactivate` | admin | 비활성화 |
| `DELETE /api/admin/users/:id` | admin | 회원 삭제 (포스트·댓글 orphan 처리) |
