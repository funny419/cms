# 댓글 기능 설계 문서

**날짜:** 2026-03-25 (v2 — 2026-03-25 요구사항 변경 반영)
**상태:** 승인됨
**범위:** 포스트 상세 페이지 댓글 UI + Admin 댓글 관리 패널

---

## 목표

포스트 상세 페이지(`PostDetail`)에 댓글 작성/조회/답글/수정/삭제 기능을 추가하고, Admin 대시보드에서 전체 댓글을 관리(삭제)할 수 있도록 한다.

---

## 결정 사항

| 항목 | 결정 |
|------|------|
| 작성 권한 | 로그인 사용자(editor/admin) + 비로그인 게스트 모두 가능 |
| 게스트 작성 조건 | 이름(author_name) + 이메일(author_email) + 패스워드(author_password) 필수 |
| 승인 정책 | 로그인 사용자 → 즉시 공개(approved), 게스트 → 승인 대기(pending) |
| 수정/삭제 권한 | 로그인 사용자: 본인 글만(author_id 일치), 게스트: 이메일+패스워드 인증 |
| 계층 구조 | 1단 답글(parent_id) 지원 |
| Admin 관리 | 전체 댓글 목록 조회 + 삭제(cascade) |

---

## DB 스키마 변경

### `backend/models/schema.py` — Comment 모델에 컬럼 추가

```python
author_password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
# 게스트 댓글 전용. 로그인 사용자 댓글은 NULL.
```

**마이그레이션:** `flask db migrate -m "add Comment.author_password_hash"` 후 `flask db upgrade` (앱 재시작 시 자동 실행)

---

## 백엔드 설계

### `backend/api/comments.py` 수정

#### `create_comment`

| 경우 | 처리 |
|------|------|
| JWT 있음 (로그인) | `author_id = user.id`, `author_name = user.username`, `author_password_hash = None`, `status = "approved"` |
| JWT 없음 (게스트) | `author_name`, `author_email`, `author_password` 필수, `author_password_hash = hash(password)`, `status = "pending"` |

- `deactivated` 차단: JWT 있을 때 user.role == "deactivated"이면 403
- `parent_id` 유효성 검사:
  - 존재하지 않으면 404
  - `post_id` 불일치 시 400
  - 이미 답글(parent_id != null)이면 400 (1단 초과 차단)
- 내용 길이: 최대 2000자

#### 신규 엔드포인트: 댓글 수정

```
PUT /api/comments/<id>
Body: { content: str, author_email?: str, author_password?: str }

인증 로직:
  - JWT 있음 → comment.author_id == 현재 user_id (또는 admin) 확인
  - JWT 없음 → body의 author_email == comment.author_email AND hash 검증
오류: 403 (본인 아님), 401 (비밀번호 불일치)
수정 가능 필드: content만 (내용 2000자 제한 동일)
```

#### 기존 엔드포인트 변경: 댓글 삭제

```
DELETE /api/comments/<id>
Body (optional): { author_email?: str, author_password?: str }

인증 로직:
  - admin 역할: 항상 허용
  - JWT 있음 + editor: comment.author_id == 현재 user_id 확인
  - JWT 없음 (게스트): body의 author_email == comment.author_email AND hash 검증
cascade: 해당 댓글의 답글 먼저 삭제 후 부모 삭제
```

#### 신규 엔드포인트 (admin.py): 전체 댓글 목록

```
GET /api/admin/comments
  - 권한: admin
  - 쿼리 파라미터: status (선택, 미지정 시 전체)
  - 응답: { success, data: [{ ...comment_fields, post_title: str }], error }
  - Comment + Post JOIN으로 post_title 포함
```

#### `PUT /api/comments/<id>/approve` (기존 유지)

코드 삭제 안 함. 게스트 댓글 승인 시 사용. Admin UI에 노출.

#### `admin.py` 회원 삭제

- `admin_delete_user`에서 `Comment.author_id` NULL 처리 추가 (Post orphan 처리와 동일 패턴)

---

## 프론트엔드 설계

### `frontend/src/api/comments.js` (신규)

| 함수 | 설명 |
|------|------|
| `listComments(postId)` | `GET /api/comments/post/:id` |
| `createComment(token\|null, postId, data)` | `POST /api/comments` — data: `{content, parent_id?, author_name?, author_email?, author_password?}` |
| `updateComment(token\|null, commentId, data)` | `PUT /api/comments/:id` — data: `{content, author_email?, author_password?}` |
| `deleteComment(token\|null, commentId, data?)` | `DELETE /api/comments/:id` — data: `{author_email?, author_password?}` |
| `listAllComments(token, status?)` | `GET /api/admin/comments` |

### `frontend/src/components/CommentSection.jsx` (신규)

props: `postId`, `user`

**댓글 목록 계층:** 프론트엔드에서 `parent_id` 기준 그룹핑 (flat list → 루트+답글)

```
CommentSection
├── 댓글 수 헤더
├── 댓글 작성 폼
│   ├── [로그인 사용자] textarea만 표시
│   └── [게스트] 이름 + 이메일 + 패스워드 + textarea
│       └── "게스트 댓글은 관리자 승인 후 표시됩니다" 안내
├── 댓글 목록
│   └── CommentItem
│       ├── 작성자명 + 날짜 + (게스트 배지)
│       ├── 내용
│       ├── [수정] [삭제] 버튼 (본인 댓글에만)
│       │   - 로그인: author_id 일치 시 표시
│       │   - 게스트: localStorage의 guest_email과 comment.author_email 일치 시 표시
│       │     → 클릭 시 패스워드 입력 모달
│       ├── [답글 달기] 버튼 (최상위 댓글에만, 로그인+게스트 모두)
│       └── 들여쓰기된 답글 목록
```

**게스트 식별 방법:**
- 게스트가 댓글 작성 성공 시 `localStorage.setItem('guest_email', email)` 저장
- `comment.author_email === localStorage.getItem('guest_email') && comment.author_id === null` 인 경우 수정/삭제 버튼 노출
- 버튼 클릭 시 패스워드 입력 프롬프트(`window.prompt`) 또는 인라인 폼으로 인증

**인라인 수정:**
- [수정] 클릭 → 해당 CommentItem이 textarea로 전환 (인라인 에디팅)
- 로그인: 바로 `updateComment(token, id, {content})` 호출
- 게스트: 패스워드 입력 필드도 함께 표시 후 `updateComment(null, id, {content, author_email, author_password})` 호출

### `frontend/src/pages/admin/AdminComments.jsx` (신규)

```
AdminComments
├── 헤더: "댓글 관리"
├── 댓글 테이블
│   └── 포스트 | 작성자 | 내용(60자) | 상태 | 작성일 | [삭제]
└── 빈 상태: "등록된 댓글이 없습니다"
```

- 상태 컬럼 추가 (approved/pending 구분)
- 삭제: admin JWT로 `deleteComment(token, id)` → 재조회

---

## 변경 파일 목록

| 파일 | 유형 | 이유 |
|------|------|------|
| `backend/models/schema.py` | 수정 | Comment에 author_password_hash 추가 |
| `backend/migrations/versions/` | 신규 | author_password_hash 마이그레이션 |
| `backend/api/comments.py` | 수정 | 게스트 작성 + 수정/삭제 인증 + 신규 PUT 엔드포인트 |
| `backend/api/admin.py` | 수정 | admin_list_comments + admin_delete_user orphan 처리 |
| `frontend/src/api/comments.js` | 신규 | 5개 함수 axios 클라이언트 |
| `frontend/src/components/CommentSection.jsx` | 신규 | 댓글 UI 전체 |
| `frontend/src/pages/PostDetail.jsx` | 수정 | CommentSection 삽입 |
| `frontend/src/pages/admin/AdminComments.jsx` | 신규 | Admin 댓글 관리 |
| `frontend/src/components/Nav.jsx` | 수정 | 댓글 관리 링크 추가 |
| `frontend/src/App.jsx` | 수정 | /admin/comments 라우트 |

---

## 범위 외 (이번 구현 제외)

- 게스트 댓글 Admin 승인 UI (approve 버튼) — API는 존재, UI는 추후
- 페이지네이션
- 댓글 알림
- 2단 이상 중첩 답글
