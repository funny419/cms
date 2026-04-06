# Markdown 에디터 지원 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PostEditor에 포스트별 WYSIWYG/Markdown 에디터 선택 기능을 추가하고, PostDetail에서 포맷에 따라 렌더링한다.

**Architecture:** `posts` 테이블에 `content_format` 컬럼을 추가해 포스트별 포맷('html'|'markdown')을 저장한다. PostEditor는 탭 UI로 에디터를 전환하며, Markdown 선택 시 WYSIWYG 탭을 비활성화한다. PostDetail은 `content_format`에 따라 `dangerouslySetInnerHTML` 또는 `MDEditor.Markdown`으로 분기 렌더링한다.

**Tech Stack:** Flask-Migrate, SQLAlchemy 2.x, React 19, `@uiw/react-md-editor`, Docker (로컬 dev)

**Spec:** `docs/superpowers/specs/2026-03-26-markdown-editor-design.md`

---

## Chunk 1: Backend — content_format 컬럼 + API

### Task 1: schema.py — content_format 컬럼 추가

**Files:**
- Modify: `backend/models/schema.py`

- [ ] **Step 1: `Post` 모델에 `content_format` 컬럼 추가**

`backend/models/schema.py`의 `Post` 클래스에서 `view_count` 다음 줄에 추가:

```python
content_format: Mapped[str] = mapped_column(String(10), default='html', nullable=False)
```

- [ ] **Step 2: `to_dict()`에 `content_format` 추가**

`Post.to_dict()` 반환 딕셔너리에 추가:

```python
"content_format": self.content_format,
```

완성된 `to_dict()`:
```python
def to_dict(self) -> dict:
    return {
        "id": self.id,
        "title": self.title,
        "slug": self.slug,
        "content": self.content,
        "excerpt": self.excerpt,
        "status": self.status,
        "post_type": self.post_type,
        "content_format": self.content_format,
        "author_id": self.author_id,
        "view_count": self.view_count,
        "created_at": self.created_at.isoformat() if self.created_at else None,
        "updated_at": self.updated_at.isoformat() if self.updated_at else None,
    }
```

---

### Task 2: Flask-Migrate — 마이그레이션 생성 및 확인

**Files:**
- Create: `backend/migrations/versions/<auto>.py`

- [ ] **Step 1: 마이그레이션 생성**

```bash
docker compose exec backend flask db migrate -m "add content_format to posts"
```

Expected: `Generating .../migrations/versions/xxxx_add_content_format_to_posts.py`

- [ ] **Step 2: 생성된 마이그레이션 파일 확인**

`backend/migrations/versions/xxxx_add_content_format_to_posts.py`를 열어 upgrade/downgrade 확인:

```python
# upgrade에 이 내용이 있어야 함
op.add_column('posts', sa.Column('content_format', sa.String(length=10), nullable=False, server_default='html'))

# downgrade에 이 내용이 있어야 함
op.drop_column('posts', 'content_format')
```

- [ ] **Step 3: 앱 재시작 (자동 migrate 적용)**

```bash
docker compose restart backend
docker compose logs backend --tail=20
```

Expected: `Running upgrade ... -> xxxx` 로그 확인.

- [ ] **Step 4: DB에서 컬럼 확인**

```bash
docker compose exec db mariadb -u funnycms -pfunnycms cmsdb -e "DESCRIBE posts;"
```

Expected: `content_format` 컬럼이 `varchar(10)` 타입으로 보임.

- [ ] **Step 5: 마이그레이션 파일 커밋**

```bash
git add backend/migrations/versions/ backend/models/schema.py
git commit -m "feat: posts 테이블에 content_format 컬럼 추가"
```

---

### Task 3: posts.py — content_format 읽기/쓰기

**Files:**
- Modify: `backend/api/posts.py`

- [ ] **Step 1: `create_post` — content_format 저장**

`create_post` 함수의 `Post(...)` 생성자에 `content_format` 추가:

```python
# 유효성 검사
raw_format = data.get("content_format", "html")
content_format = raw_format if raw_format in ("html", "markdown") else "html"

post = Post(
    title=data["title"],
    slug=data.get("slug", ""),
    content=data.get("content", ""),
    excerpt=data.get("excerpt", ""),
    status=data.get("status", "draft"),
    post_type=data.get("post_type", "post"),
    content_format=content_format,
    author_id=author_id,
)
```

- [ ] **Step 2: `update_post` — content_format 업데이트 허용**

`update_post`의 `for field in (...)` 리스트에 `"content_format"` 추가:

```python
for field in ("title", "slug", "content", "excerpt", "status", "post_type", "content_format"):
    if field in data:
        if field == "content_format" and data[field] not in ("html", "markdown"):
            continue  # 유효하지 않은 값 무시
        setattr(post, field, data[field])
```

- [ ] **Step 3: 동작 확인 (curl)**

```bash
# 1. 포스트 생성 (Markdown 포맷)
curl -s -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"MD Test","content":"# Hello","content_format":"markdown","status":"draft"}' \
  | python3 -m json.tool
```

Expected: 응답에 `"content_format": "markdown"` 포함.

```bash
# 2. 포스트 조회
curl -s http://localhost:5000/api/posts/<ID> | python3 -m json.tool
```

Expected: `"content_format": "markdown"` 포함.

- [ ] **Step 4: 커밋**

```bash
git add backend/api/posts.py
git commit -m "feat: posts API에 content_format 읽기/쓰기 추가"
```

---

## Chunk 2: Frontend — 패키지 설치 + PostEditor

### Task 4: @uiw/react-md-editor 설치

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: 컨테이너에 패키지 설치**

```bash
docker compose exec frontend sh -c "npm install @uiw/react-md-editor"
```

Expected: `added X packages` 메시지.

- [ ] **Step 2: package.json에 반영 확인**

`frontend/package.json`의 `dependencies`에 `"@uiw/react-md-editor"` 항목이 추가되었는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: @uiw/react-md-editor 패키지 추가"
```

---

### Task 5: PostEditor — 탭 UI + 에디터 분기 + 잠금 정책

**Files:**
- Modify: `frontend/src/pages/PostEditor.jsx`

- [ ] **Step 1: import 추가**

파일 상단에 추가:

```jsx
import MDEditor from '@uiw/react-md-editor';
```

- [ ] **Step 2: form state에 content_format 추가**

`useState` 초기값에 추가:

```jsx
const [form, setForm] = useState({
  title: '',
  content: '',
  excerpt: '',
  slug: '',
  post_type: 'post',
  content_format: 'html',   // 추가
});
```

- [ ] **Step 3: 기존 포스트 로드 시 content_format 읽기**

`getPost` 응답 처리 부분에 `content_format` 추가:

```jsx
setForm({
  title: res.data.title || '',
  content: res.data.content || '',
  excerpt: res.data.excerpt || '',
  slug: res.data.slug || '',
  post_type: res.data.post_type || 'post',
  content_format: res.data.content_format || 'html',  // 추가
});
```

- [ ] **Step 4: 탭 UI + 에디터 분기 JSX 작성**

`{/* WYSIWYG 에디터 */}` 블록 전체를 아래 코드로 교체:

```jsx
{/* 에디터 탭 */}
<div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
  <button
    type="button"
    onClick={() => setForm({ ...form, content_format: 'html' })}
    disabled={form.content_format === 'markdown'}
    style={{
      padding: '4px 14px',
      borderRadius: 6,
      border: '1px solid var(--border)',
      background: form.content_format === 'html' ? 'var(--accent-bg)' : 'transparent',
      color: form.content_format === 'markdown' ? 'var(--text-light)' : 'var(--text)',
      cursor: form.content_format === 'markdown' ? 'not-allowed' : 'pointer',
      fontSize: 13,
      fontWeight: form.content_format === 'html' ? 600 : 400,
    }}
  >
    WYSIWYG
  </button>
  <button
    type="button"
    onClick={() => !isEdit && setForm({ ...form, content_format: 'markdown' })}
    disabled={isEdit && form.content_format === 'html'}
    style={{
      padding: '4px 14px',
      borderRadius: 6,
      border: '1px solid var(--border)',
      background: form.content_format === 'markdown' ? 'var(--accent-bg)' : 'transparent',
      color: (isEdit && form.content_format === 'html') ? 'var(--text-light)' : 'var(--text)',
      cursor: (isEdit && form.content_format === 'html') ? 'not-allowed' : 'pointer',
      fontSize: 13,
      fontWeight: form.content_format === 'markdown' ? 600 : 400,
    }}
  >
    Markdown
  </button>
</div>

{/* 에디터 본문 */}
{form.content_format === 'markdown' ? (
  <div data-color-mode="light" style={{ marginBottom: 24 }}>
    <MDEditor
      value={form.content}
      onChange={(val) => setForm({ ...form, content: val || '' })}
      height={400}
    />
  </div>
) : (
  <ReactQuill
    theme="snow"
    value={form.content}
    onChange={(val) => setForm({ ...form, content: val })}
    modules={QUILL_MODULES}
    formats={QUILL_FORMATS}
    style={{ marginBottom: 24 }}
  />
)}
```

- [ ] **Step 5: payload에 content_format 포함 확인**

`handleSave` 함수는 `{ ...form, status }` 로 payload를 만들므로 `content_format`이 자동 포함됨. 별도 변경 불필요.

- [ ] **Step 6: 브라우저에서 동작 확인**

1. `http://localhost:5173/posts/new` 진입
2. 기본값 WYSIWYG 에디터가 표시되는지 확인
3. Markdown 탭 클릭 → MDEditor로 전환되고, WYSIWYG 탭이 비활성화(회색+클릭불가)되는지 확인
4. Markdown으로 내용 입력 후 임시저장
5. 저장 후 편집 재진입 → Markdown 탭만 활성 상태인지 확인

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/pages/PostEditor.jsx
git commit -m "feat: PostEditor에 WYSIWYG/Markdown 탭 전환 추가"
```

---

## Chunk 3: Frontend — PostDetail 렌더링 분기

### Task 6: PostDetail — 포맷별 렌더링

**Files:**
- Modify: `frontend/src/pages/PostDetail.jsx`

- [ ] **Step 1: MDEditor import 추가**

파일 상단에 추가:

```jsx
import MDEditor from '@uiw/react-md-editor';
```

- [ ] **Step 2: 본문 렌더링 분기 교체**

`{/* 본문 — Quill 렌더링 */}` 블록을 아래로 교체:

```jsx
{/* 본문 */}
{post.content_format === 'markdown' ? (
  <div data-color-mode="light" style={{ fontSize: 15, lineHeight: 1.8 }}>
    <MDEditor.Markdown source={post.content || ''} />
  </div>
) : (
  <div className="ql-snow">
    <div
      className="ql-editor"
      style={{ padding: 0, fontSize: 15, lineHeight: 1.8, color: 'var(--text-h)' }}
      dangerouslySetInnerHTML={{ __html: post.content || '' }}
    />
  </div>
)}
```

- [ ] **Step 3: 동작 확인**

1. 기존 HTML 포스트 → 기존 렌더링 그대로인지 확인
2. Markdown 포스트 → `# 제목`, `**볼드**`, `- 목록` 등 올바르게 렌더링되는지 확인
3. 다크모드 전환 시 Markdown 렌더러도 정상인지 확인 (필요 시 `data-color-mode="dark"` 조건 추가)

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/PostDetail.jsx
git commit -m "feat: PostDetail에 Markdown 렌더링 분기 추가"
```

---

## 다크모드 대응 (선택적 후처리)

`@uiw/react-md-editor`는 `data-color-mode` 속성으로 테마를 제어한다.
현재 구현에서는 `data-color-mode="light"` 고정이므로, 다크모드 시 배경색이 맞지 않을 수 있다.

필요 시 `useTheme()` 훅으로 분기:

```jsx
import { useTheme } from '../context/ThemeContext';
const { theme } = useTheme();

// 사용처
<div data-color-mode={theme === 'dark' ? 'dark' : 'light'}>
  <MDEditor ... />
</div>
```

이 작업은 기능 구현 후 별도 커밋으로 처리한다.
