# Markdown 에디터 지원 설계 스펙

**날짜:** 2026-03-26
**상태:** 승인됨

---

## 개요

PostEditor에 WYSIWYG(Quill) 외에 Markdown 에디터(`@uiw/react-md-editor`)를 포스트별로 선택할 수 있도록 추가한다.

---

## 요구사항

- 포스트마다 WYSIWYG 또는 Markdown 에디터를 선택할 수 있다.
- 에디터 선택은 포스트에 저장되어, 다음 편집 시에도 동일한 에디터가 열린다.
- **정책 (형식 잠금)**:
  - **새 포스트**: Markdown 탭 클릭 → React 상태 `content_format='markdown'`으로 즉시 업데이트 + WYSIWYG 탭 `disabled`(비활성화). 이후 WYSIWYG 탭은 클릭 불가. 저장하지 않고 나가면 다음 새 포스트 진입 시 다시 'html'로 초기화.
  - **기존 HTML 포스트**: 탭이 'WYSIWYG'로 고정, Markdown 탭 비활성화.
  - **기존 Markdown 포스트**: 탭이 'Markdown'으로 고정, WYSIWYG 탭 비활성화.
  - Admin 포함 모든 역할에 동일하게 적용.
- Markdown 내용은 DB에 원문(`raw Markdown`) 그대로 저장, 뷰어에서 렌더링.
- 기존 HTML 포스트는 변경 없이 유지.

---

## 데이터 모델

### `posts` 테이블 변경

`content_format` 컬럼 추가:

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `content_format` | `String(10)` | `'html'` | `'html'` 또는 `'markdown'` |

**Flask-Migrate:**
```
# upgrade
ALTER TABLE posts ADD COLUMN content_format VARCHAR(10) NOT NULL DEFAULT 'html';

# downgrade
ALTER TABLE posts DROP COLUMN content_format;
```
기존 포스트는 마이그레이션 시 `DEFAULT 'html'`로 자동 설정됨.

**`to_dict()` 변경:** `content_format` 포함.

---

## API 변경

### GET `/api/posts/:id`
응답에 `content_format` 추가:
```json
{ "content_format": "html" }
```

### GET `/api/posts/mine`
응답에 `content_format` 추가 (PostEditor에서 편집 시 필요).

### POST `/api/posts`, PUT `/api/posts/:id`
요청 body에서 `content_format` 수신 및 저장. 누락 시 기본값 `'html'`.
허용 값: `'html'`, `'markdown'`. 그 외는 무시하고 `'html'` 적용 — 검증은 `posts.py` API 레이어에서 수행.

### GET `/api/posts` (목록)
`content_format` 포함 불필요 — 목록에서는 사용하지 않음.

---

## Frontend — PostEditor

### 탭 UI
에디터 영역 상단에 탭 2개:
```
[ WYSIWYG ]  [ Markdown ]
```

### 전환 정책 (구현 기준)

| 상황 | WYSIWYG 탭 | Markdown 탭 |
|------|-----------|------------|
| 새 포스트 (기본) | 활성·선택 | 활성 |
| 새 포스트 (Markdown 클릭 후) | **비활성** | 활성·선택 |
| 기존 HTML 포스트 | 활성·선택 | **비활성** |
| 기존 Markdown 포스트 | **비활성** | 활성·선택 |

- Markdown 탭 클릭 → `setForm` 즉시 `content_format: 'markdown'` 업데이트 → WYSIWYG 탭 `disabled` 처리
- 비활성 탭: 클릭 불가 + 시각적으로 회색 처리

### form state 변경
```js
const [form, setForm] = useState({
  title: '',
  content: '',
  excerpt: '',
  slug: '',
  post_type: 'post',
  content_format: 'html',  // 추가
});
```

### 에디터 렌더링
```
content_format === 'html'      → <ReactQuill> (기존 그대로)
content_format === 'markdown'  → <MDEditor> (@uiw/react-md-editor)
```

---

## Frontend — PostDetail

### 렌더링 분기

```jsx
{post.content_format === 'markdown' ? (
  <MDEditor.Markdown source={post.content || ''} />
) : (
  <div className="ql-snow">
    <div
      className="ql-editor"
      dangerouslySetInnerHTML={{ __html: post.content || '' }}
    />
  </div>
)}
```

**보안:** `MDEditor.Markdown`은 내부적으로 `rehype-sanitize`를 통한 XSS 방어를 적용함. HTML 포스트는 기존 `dangerouslySetInnerHTML` 유지 (기존 동작 변경 없음).

---

## 구현 순서

1. `backend/models/schema.py` — `content_format` 컬럼 추가, `to_dict()` 반영
2. `backend/migrations/` — `flask db migrate -m "add content_format to posts"` 실행, 마이그레이션 파일 커밋
3. `backend/api/posts.py` — `content_format` 읽기/쓰기 반영
4. `frontend/` — `npm install @uiw/react-md-editor`
5. `frontend/src/pages/PostEditor.jsx` — 탭 UI, 에디터 분기, 잠금 정책
6. `frontend/src/pages/PostDetail.jsx` — 포맷별 렌더링 분기

---

## 의존성

| 패키지 | 용도 |
|--------|------|
| `@uiw/react-md-editor` | Markdown 에디터 + 뷰어 (rehype-sanitize 내장) |

---

## 변경 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `backend/models/schema.py` | `content_format` 컬럼 추가, `to_dict()` 반영 |
| `backend/api/posts.py` | `content_format` 읽기/쓰기 |
| `backend/migrations/` | Flask-Migrate 자동 생성 |
| `frontend/src/pages/PostEditor.jsx` | 탭 UI, 에디터 분기, 잠금 정책 |
| `frontend/src/pages/PostDetail.jsx` | 포맷별 렌더링 분기 |

---

## 비고

- `@uiw/react-md-editor`는 내부적으로 `react-markdown`을 포함하므로 별도 설치 불필요.
- 기존 포스트 (`content_format` 없거나 `'html'`)는 모두 기존 렌더링 경로로 처리.
- 목록 API (`/api/posts`)에는 `content_format` 불포함 — 에디터 포맷 뱃지 등 목록 표시는 현재 범위 외.
