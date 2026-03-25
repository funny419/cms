# 포스트 통계 & 추천 기능 설계 문서

**날짜:** 2026-03-25
**상태:** 승인됨
**범위:** 전체 글(PostList) 메타 정보 확장 + 포스트 추천(좋아요) 기능

---

## 목표

`GET /posts` (전체 글 목록)에 작성자명, 조회수, 댓글 수, 추천 수를 표시하고,
포스트 상세 페이지에서 로그인 사용자가 추천(토글)할 수 있게 한다.

---

## 결정 사항

| 항목 | 결정 |
|------|------|
| 추천 권한 | 로그인 사용자(editor/admin)만 |
| 추천 방식 | 토글 (추천 → 취소 → 추천) |
| 조회수 카운트 | 포스트 상세 페이지 진입 시마다 +1 (중복 방지 없음) |
| 데이터 전달 | `GET /api/posts`에서 JOIN 집계로 한 번에 반환 |

---

## DB 스키마 변경

### Post 모델 — `view_count` 컬럼 추가

```python
view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
```

### PostLike 테이블 신규

```python
class PostLike(Base):
    __tablename__ = 'post_likes'

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey('posts.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint('post_id', 'user_id', name='uq_post_like'),)
```

- `UniqueConstraint(post_id, user_id)` → DB 레벨 1인 1추천 강제
- 마이그레이션 1개로 `view_count` 추가 + `post_likes` 테이블 생성 동시 처리

---

## 백엔드 설계

### `backend/api/posts.py` 변경

#### `GET /api/posts` — 집계 쿼리로 전면 변경

현재 단순 `select(Post).where(status=="published")`를 아래로 교체:

- `User` LEFT JOIN → `author_username` 포함
- `Comment` COUNT (status="approved") → `comment_count`
- `PostLike` COUNT → `like_count`
- JWT optional → 로그인 시 현재 유저의 `PostLike` 존재 여부 → `user_liked` (bool)

**응답 필드:**
```json
{
  "id": 1,
  "title": "...",
  "excerpt": "...",
  "slug": "...",
  "status": "published",
  "author_id": 2,
  "author_username": "funny",
  "view_count": 42,
  "comment_count": 5,
  "like_count": 12,
  "user_liked": true,
  "created_at": "2026-03-25T..."
}
```

비로그인 시 `user_liked: false` 고정.

#### `GET /api/posts/<id>` — view_count +1

포스트 조회 시 `post.view_count += 1` 후 commit. 동일 응답 포맷(위 필드 포함)으로 반환.

#### `POST /api/posts/<id>/like` — 추천 토글 (신규)

- 권한: `@roles_required("editor", "admin")` (deactivated 자동 차단)
- 로직:
  - 기존 PostLike 존재 → 삭제(취소), `liked: false`
  - 미존재 → 생성(추천), `liked: true`
- 응답:
```json
{ "success": true, "data": { "liked": true, "like_count": 13 }, "error": "" }
```

### `backend/api/posts.py` — `get_my_posts` 변경 (선택)

`/api/posts/mine`도 동일 집계 필드 포함으로 변경 (일관성). 단, `user_liked`는 항상 본인 기준.

---

## 프론트엔드 설계

### `frontend/src/pages/PostList.jsx` 수정

각 포스트 아이템(`<li>`) 하단에 메타 한 줄 추가:

```
funny · 2026년 3월 25일 · 👁 42 · 💬 5 · ♥ 12
```

- 작성자명: `post.author_username` (없으면 "알 수 없음")
- 날짜: 기존 `created_at` 포맷 유지
- 아이콘 + 숫자: 👁 `view_count` · 💬 `comment_count` · ♥ `like_count`
- 클릭 동작 없음 (목록은 읽기 전용)

### `frontend/src/pages/PostDetail.jsx` 수정

제목 아래 메타 영역에 추천 버튼 추가:

```
funny · 2026년 3월 25일  [♥ 추천 12]
```

- 로그인 + 본인 글 아닌 경우: 클릭 가능, 추천/취소 토글
- 로그인 + 본인 글인 경우: 버튼 비활성화 (본인 글 추천 불가)
- 비로그인: 버튼 비활성화, title="로그인 후 추천할 수 있습니다"
- 추천 상태: `user_liked` 기준으로 버튼 색상 구분 (추천됨=강조, 미추천=ghost)
- 클릭 시 `likePost()` 호출 → 응답으로 `like_count`, `user_liked` 즉시 업데이트 (낙관적 업데이트 없이 서버 응답 기반)

### `frontend/src/api/posts.js` 수정

`likePost(token, postId)` 함수 추가:
```js
export const likePost = async (token, postId) => {
  // POST /api/posts/:id/like
}
```

---

## 변경 파일 목록

| 파일 | 유형 | 역할 |
|------|------|------|
| `backend/models/schema.py` | 수정 | Post.view_count 추가, PostLike 모델 신규 |
| `backend/migrations/versions/` | 신규 | view_count + post_likes 마이그레이션 |
| `backend/api/posts.py` | 수정 | 집계 쿼리, view_count +1, like 토글 엔드포인트 |
| `frontend/src/api/posts.js` | 수정 | likePost 함수 추가 |
| `frontend/src/pages/PostList.jsx` | 수정 | 메타 정보 한 줄 추가 |
| `frontend/src/pages/PostDetail.jsx` | 수정 | 추천 버튼 추가 |

---

## 범위 외 (이번 구현 제외)

- `GET /api/posts/mine` 집계 필드 확장 (MyPosts 페이지)
- 조회수 중복 방지 (세션/IP 기반)
- 추천 알림
- 인기 포스트 정렬
