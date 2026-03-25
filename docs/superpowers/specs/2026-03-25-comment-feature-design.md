# 댓글 기능 설계 문서

**날짜:** 2026-03-25
**상태:** 승인됨
**범위:** 포스트 상세 페이지 댓글 UI + Admin 댓글 관리 패널

---

## 목표

포스트 상세 페이지(`PostDetail`)에 댓글 작성/조회/답글 기능을 추가하고, Admin 대시보드에서 전체 댓글을 관리(삭제)할 수 있도록 한다.

---

## 결정 사항

| 항목 | 결정 |
|------|------|
| 작성 권한 | 로그인 사용자(editor/admin)만 |
| 승인 정책 | 로그인 사용자 작성 시 즉시 공개(auto-approve) |
| 계층 구조 | 1단 답글(parent_id) 지원 |
| Admin 관리 | 전체 댓글 목록 조회 + 삭제 |

---

## 백엔드 설계

### `backend/api/comments.py` 수정

**`create_comment` 변경사항:**

- `verify_jwt_in_request(optional=True)` → `@jwt_required()` 데코레이터로 교체 (비로그인 차단)
- JWT identity에서 `User` 조회 후 `author_name = user.username`, `author_id = user.id` 자동 설정
- `author_name`, `author_email` 요청 바디에서 제거
- `status` 고정값 `"approved"` (로그인 사용자 즉시 공개)

**신규 엔드포인트:**

```
GET /api/admin/comments
  - 권한: admin
  - 쿼리 파라미터: status (선택, 미지정 시 전체)
  - 응답: { success, data: [comment, ...], error }
```

**유지되는 기존 엔드포인트:**

| 엔드포인트 | 변경 없음 |
|-----------|----------|
| `GET /api/comments/post/<post_id>` | 승인된 댓글 목록 |
| `PUT /api/comments/<id>/approve` | admin/editor 승인 |
| `DELETE /api/comments/<id>` | admin 삭제 |

---

## 프론트엔드 설계

### 신규 파일

#### `frontend/src/api/comments.js`

axios 기반 API 클라이언트. 4개 함수:

- `listComments(postId)` — `GET /api/comments/post/:id` (인증 불필요)
- `createComment(token, postId, content, parentId?)` — `POST /api/comments`
- `deleteComment(token, commentId)` — `DELETE /api/comments/:id`
- `listAllComments(token, status?)` — `GET /api/admin/comments`

#### `frontend/src/components/CommentSection.jsx`

`PostDetail`에 삽입되는 독립 컴포넌트. props: `postId`, `user`.

```
CommentSection
├── 댓글 수 헤더 (예: "댓글 3개")
├── 댓글 작성 폼 (로그인 시만 표시)
│   ├── textarea (content)
│   └── [등록] 버튼
├── 비로그인 안내: "댓글을 작성하려면 로그인하세요"
└── 댓글 목록
    └── CommentItem
        ├── 작성자명 + 날짜
        ├── 내용
        ├── [답글 달기] 버튼 (로그인 시, 최상위 댓글에만)
        ├── 인라인 답글 폼 (토글, 로그인 시)
        └── 들여쓰기된 답글 목록
```

- 답글은 1단만 허용 (parent 댓글에만 [답글 달기] 표시)
- 작성/답글 성공 시 목록 즉시 재조회
- 스타일: 기존 CSS Variables + `.card`, `.form-input`, `.btn` 유틸리티 클래스 사용

#### `frontend/src/pages/admin/AdminComments.jsx`

Admin 전용 댓글 관리 페이지.

```
AdminComments
├── 헤더: "댓글 관리"
├── 댓글 테이블
│   └── 포스트 제목 | 작성자 | 내용(앞 50자) | 작성일 | [삭제] 버튼
└── 빈 상태: "등록된 댓글이 없습니다"
```

- 삭제: `window.confirm` 후 `deleteComment()` 호출, 목록 즉시 갱신

### 수정 파일

#### `frontend/src/pages/PostDetail.jsx`

본문(`ql-editor`) 아래, 이전/다음 글 내비게이션 위에 `<CommentSection>` 삽입.

```jsx
<CommentSection postId={post.id} user={user} />
```

#### `frontend/src/components/Nav.jsx`

admin 로그인 시 "댓글 관리" 링크 추가 (`/admin/comments`).

#### `frontend/src/App.jsx`

`/admin/comments` 라우트 등록 (admin guard 적용).

---

## 변경 파일 목록

| 파일 | 유형 |
|------|------|
| `backend/api/comments.py` | 수정 |
| `frontend/src/api/comments.js` | 신규 |
| `frontend/src/components/CommentSection.jsx` | 신규 |
| `frontend/src/pages/PostDetail.jsx` | 수정 |
| `frontend/src/pages/admin/AdminComments.jsx` | 신규 |
| `frontend/src/components/Nav.jsx` | 수정 |
| `frontend/src/App.jsx` | 수정 |

---

## 범위 외 (이번 구현 제외)

- 게스트 댓글 (비로그인 작성)
- 댓글 수정 기능
- 페이지네이션
- 댓글 알림
- 2단 이상 중첩 답글
