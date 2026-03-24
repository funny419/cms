# 포스트 상세 페이지 & 에디터 설계

## 개요

현재 포스트 목록(`/posts`)만 존재하며 클릭 시 아무 반응이 없는 상태. 포스트 상세 보기와 WYSIWYG 기반 작성/수정 에디터를 추가한다.

## 결정 사항

| 항목 | 결정 |
|------|------|
| 상세 페이지 레이아웃 | 단일 컬럼 + 메타 정보 강조 (작성자·날짜·상태·이전/다음 글) |
| 에디터 레이아웃 | 풀페이지 (제목 크게, 상단 임시저장/발행 버튼) |
| WYSIWYG 라이브러리 | `react-quill-new` — React 19 호환 포크, 상단 고정 툴바 |

> **Why react-quill-new**: 원본 `react-quill`(최종 릴리즈 2022년)은 React 19와 호환되지 않아 런타임 오류 발생. `react-quill-new`는 React 19 지원 커뮤니티 포크로 API 동일.

---

## 1. 라우트 구조

```
/posts           → PostList     (기존, 목록)
/posts/new       → PostEditor   (신규, 신규 작성) ← /:id 보다 반드시 먼저 등록
/posts/:id/edit  → PostEditor   (신규, 수정)
/posts/:id       → PostDetail   (신규, 상세)    ← /new 다음에 등록
```

**App.jsx 라우트 등록 순서 (필수)**:
```jsx
<Route path="/posts/new" element={<PostEditor />} />
<Route path="/posts/:id/edit" element={<PostEditor />} />
<Route path="/posts/:id" element={<PostDetail />} />
```
React Router v6는 정적 세그먼트를 동적보다 우선하지만, 명시적 순서로 충돌 방지.

---

## 2. 공통 — 로그인 상태 및 권한 감지

```js
// 재사용 헬퍼 (각 컴포넌트 내에서 사용)
const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};
const isEditorOrAdmin = (user) =>
  user && (user.role === 'admin' || user.role === 'editor');
```

---

## 3. PostDetail 페이지 (`/posts/:id`)

### 기능
- `getPost(id)` API 호출로 포스트 데이터 로드
- 인증 불필요 (누구나 URL 직접 접근 가능)
- 로드 실패 또는 포스트 없음(404) 시 "포스트를 찾을 수 없습니다" + `← 목록으로` 링크 표시
- `draft` 상태 포스트를 비로그인 사용자가 접근할 경우: API가 반환하면 표시, 반환하지 않으면 404 처리와 동일하게 처리 (백엔드가 draft를 비공개 처리하는 경우 자동으로 404가 됨)

### 상태 뱃지

| status | 뱃지 텍스트 | 스타일 |
|--------|------------|--------|
| `published` | 발행됨 | `background: accent-bg, color: accent-text` |
| `draft` | 임시저장 | `background: bg-subtle, color: text-light` |
| `scheduled` | 예약됨 | `background: #fef3c7, color: #92400e` |

### UI 구성 (위 → 아래)

```
[ ← 포스트 목록 ]                    [ ✏️ 편집 ] ← isEditorOrAdmin(user) 인 경우만
                                               클릭 시 /posts/:id/edit 이동

제목 (큰 폰트, font-weight: 700)
by {작성자} · {날짜 한국어} · [상태뱃지]

────────────────────────────────────

본문 (react-quill-new view-only 렌더링, dangerouslySetInnerHTML 사용)

────────────────────────────────────
[ ← {이전글제목} ]          [ {다음글제목} → ]
  없으면 비표시                없으면 비표시
```

### 이전/다음 글 네비게이션

- `listPosts()` 로 전체 published 목록 로드 (현재 API는 전체 반환, 페이지네이션 없음)
- 정렬 기준: `created_at` **내림차순** (최신 글이 첫 번째)
- "이전 글" = 현재 포스트보다 **더 최근**에 작성된 글 (배열에서 index - 1)
- "다음 글" = 현재 포스트보다 **더 오래된** 글 (배열에서 index + 1)
- 해당 포스트가 목록에 없는 경우(draft 등) 네비게이션 버튼 숨김

---

## 4. PostEditor 페이지 (`/posts/new`, `/posts/:id/edit`)

### 접근 제어
1. `token` 없으면 → `/login` 리다이렉트
2. `isEditorOrAdmin(user)` 가 false 이면 → `/posts` 리다이렉트
3. useEffect 에서 마운트 시 체크

### 신규 vs 수정 분기

```js
const { id } = useParams(); // undefined 이면 신규 모드
const isEdit = Boolean(id);
```

- 수정 모드: `getPost(id)` 로 기존 데이터 로드 → 폼 초기값 설정
- 신규 모드: 모든 필드 빈 값으로 시작, `status` 기본값 `"draft"`

### 취소 버튼 동작
- 수정 모드: `/posts/:id` 로 이동
- 신규 모드: `/posts` 로 이동

### 저장 동작

| 버튼 | `status` 값 | API 호출 |
|------|------------|---------|
| 임시저장 | `"draft"` | 신규: `createPost`, 수정: `updatePost` |
| 발행 | `"published"` | 신규: `createPost`, 수정: `updatePost` |

- 성공 시: 응답의 `result.data.id` 를 사용해 `/posts/${result.data.id}` 로 이동
- 실패 시: 상단에 `.alert.alert-error` 표시, 페이지 이동 없음

### UI 구성

```
[ ← 취소 ]           [ 임시저장 ] [ 발행 ]

제목 _________________________________________________ (큰 텍스트, border-bottom)

┌─────────────────────────────────────────────────────┐
│  B  I  U  │  H1  H2  │  ≡ 목록  1. 번호  │  🔗  🖼  │  ← Quill 툴바
├─────────────────────────────────────────────────────┤
│                                                     │
│   WYSIWYG 본문 (react-quill-new)  min-height 400px │
│                                                     │
└─────────────────────────────────────────────────────┘

요약 (excerpt) _______________________________________ (선택 입력)
슬러그 ________________________________________________ (선택 입력, 자동생성 없음)
포스트 타입 [ post ▼ ]  (post / page)
```

### Quill 설정 (react-quill-new, v2 기준)

```js
const QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ header: 1 }, { header: 2 }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'bold', 'italic', 'underline',
  'header',
  'list',       // 'ordered'와 'bullet' 모두 포함 (Quill v2 기준)
  'link', 'image',
];
```

CSS import:
```js
import 'react-quill-new/dist/quill.snow.css';
```

---

## 5. PostList 변경 사항

- 각 `.post-item` 클릭 시 `navigate('/posts/${post.id}')` 추가 (cursor: pointer 이미 적용)
- 상단 우측에 `isEditorOrAdmin(getUser())` 인 경우 `+ 새 글` 버튼 표시
  - 클릭 시 `/posts/new` 이동
  - `localStorage.getItem('user')` 가 없거나 파싱 실패 시 버튼 숨김

---

## 6. 신규/수정 파일

### 신규 생성

| 파일 | 역할 |
|------|------|
| `frontend/src/pages/PostDetail.jsx` | 포스트 상세 페이지 |
| `frontend/src/pages/PostEditor.jsx` | 신규/수정 에디터 |

### 수정

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/App.jsx` | 라우트 3개 추가 (순서 중요) |
| `frontend/src/pages/PostList.jsx` | 클릭 이동 + `+ 새 글` 버튼 |
| `frontend/package.json` | `react-quill-new` 추가 |
| `frontend/Dockerfile` | `npm install` 에 `react-quill-new` 자동 포함 |

---

## 7. 의존성

```bash
npm install react-quill-new
```

---

## 8. 범위 외 (Out of Scope)

- 댓글 UI
- 이미지 서버 업로드 (Quill 이미지는 base64 삽입)
- 포스트 삭제 UI
- 포스트 검색/필터
- 포스트 목록 페이지네이션
