---
name: api-docs
description: 새 API 엔드포인트 추가 후 api.md 문서를 업데이트할 때 사용. 엔드포인트 누락 방지.
---

# API Docs

## 실행 순서

1. 변경된 API 파일(`backend/api/*.py`)을 Read 도구로 읽는다
2. `.claude/rules/api.md`를 Read 도구로 읽어 현재 문서 상태를 파악한다
3. 누락된 엔드포인트 또는 변경된 내용을 확인한다
4. `api.md`를 Edit 도구로 업데이트한다

---

## api.md 엔드포인트 표기 형식

```markdown
| `METHOD /api/path` | 권한 | 설명 |
```

### 권한 표기
- `공개` — JWT 불필요
- `로그인` — `@jwt_required()`
- `editor/admin` — `@roles_required('editor', 'admin')`
- `admin` — `@roles_required('admin')`
- `소유자/admin` — 소유권 검사 포함
- `소유자/게스트인증` — 게스트는 이메일+패스워드 인증

### 설명 작성 기준
- 파라미터: `파라미터: ?page=1&per_page=20&q=검색어`
- 응답 포함 필드: `응답: url, thumbnail_url 포함`
- 특수 동작: `view_count +1 (?skip_count=1 시 미증가)`
- 제약: `본인 글 불가, 1인 1추천`

---

## 예시

```markdown
| `GET /api/posts` | 공개 | published 포스트 목록. 파라미터: `?page=1&per_page=20&q=검색어` |
| `POST /api/posts/:id/like` | editor/admin | 추천 토글 (본인 글 불가, 1인 1추천) |
| `POST /api/media` | editor/admin | 파일 업로드. 응답: `{ url: "/uploads/...", thumbnail_url: "/uploads/thumb_..." }` |
```

---

## 완료 체크리스트

- [ ] 새로 추가된 엔드포인트가 `api.md`에 반영됨
- [ ] 삭제된 엔드포인트가 `api.md`에서 제거됨
- [ ] 권한 변경 반영됨
- [ ] 파라미터/응답 필드 변경 반영됨
- [ ] 표 형식(컬럼 순서: 엔드포인트 | 권한 | 설명) 유지됨
