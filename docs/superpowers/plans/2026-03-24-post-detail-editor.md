# 포스트 상세 페이지 & WYSIWYG 에디터 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포스트 목록 클릭 시 상세 페이지로 이동하고, admin/editor 권한으로 Quill WYSIWYG 에디터에서 글을 작성·수정할 수 있도록 구현한다.

**Architecture:** PostList에 클릭 이벤트를 추가하고, PostDetail(읽기)과 PostEditor(쓰기) 두 페이지를 신규 생성한다. App.jsx에 라우트 3개를 추가한다. 에디터는 react-quill-new(React 19 호환)를 사용한다.

**Tech Stack:** React 19 + React Router v7 + react-quill-new + CSS Variables (no Tailwind)

---

## 파일 구조

| 파일 | 변경 |
|------|------|
| `frontend/src/pages/PostList.jsx` | 수정 — 클릭 이동 + "+ 새 글" 버튼 |
| `frontend/src/pages/PostDetail.jsx` | **신규** — 상세 보기 |
| `frontend/src/pages/PostEditor.jsx` | **신규** — 작성/수정 에디터 |
| `frontend/src/App.jsx` | 수정 — 라우트 3개 추가 |
| `frontend/package.json` | 수정 — react-quill-new 추가 |

---

## Chunk 1: 의존성 설치 + PostList 수정

### Task 1: react-quill-new 설치 + PostList 클릭 이동 + "+ 새 글" 버튼

**Files:**
- Modify: `frontend/src/pages/PostList.jsx`
- Modify: `frontend/package.json` (npm install 후 자동 반영)

- [ ] **Step 1: react-quill-new 설치**

Docker 컨테이너 안에서 설치하면 볼륨 마운트로 package.json이 갱신됩니다:

```bash
docker compose exec frontend npm install react-quill-new
```

Expected output: `added N packages`

- [ ] **Step 2: PostList.jsx 전체 교체**

`frontend/src/pages/PostList.jsx` 를 아래 내용으로 교체합니다:

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPosts } from '../api/posts';

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};
const isEditorOrAdmin = (user) =>
  user && (user.role === 'admin' || user.role === 'editor');

export default function PostList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    listPosts().then((res) => {
      if (res.success) setPosts(res.data);
      else setError(res.error);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>
  );

  if (error) return (
    <div className="page-content">
      <div className="alert alert-error">{error}</div>
    </div>
  );

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>포스트</h1>
        {isEditorOrAdmin(user) && (
          <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>
            + 새 글
          </button>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
          <p>게시된 포스트가 없습니다.</p>
        </div>
      ) : (
        <ul className="post-list">
          {posts.map((post) => (
            <li
              key={post.id}
              className="post-item"
              onClick={() => navigate(`/posts/${post.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="post-title">{post.title}</div>
              {post.excerpt && (
                <div className="post-excerpt">{post.excerpt}</div>
              )}
              <div className="post-meta">
                {post.created_at
                  ? new Date(post.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })
                  : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 브라우저에서 확인**

`http://localhost:5173/posts` 접속:
- 포스트 클릭 시 `/posts/1` 로 이동 시도 (PostDetail 없으면 404 표시 — 정상)
- admin/editor 로 로그인한 경우 우상단에 `+ 새 글` 버튼 표시
- 비로그인 또는 subscriber 로그인 시 `+ 새 글` 버튼 없음

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PostList.jsx frontend/package.json frontend/package-lock.json
git commit -m "feat: PostList 클릭 이동 + 새 글 버튼 + react-quill-new 설치"
```

---

## Chunk 2: PostDetail 페이지

### Task 2: PostDetail.jsx 생성 + App.jsx 라우트 등록

**Files:**
- Create: `frontend/src/pages/PostDetail.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: PostDetail.jsx 생성**

`frontend/src/pages/PostDetail.jsx` 를 아래 내용으로 생성합니다:

```jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPost, listPosts } from '../api/posts';
import 'react-quill-new/dist/quill.snow.css';

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};
const isEditorOrAdmin = (user) =>
  user && (user.role === 'admin' || user.role === 'editor');

const STATUS_BADGE = {
  published: {
    label: '발행됨',
    style: { background: 'var(--accent-bg)', color: 'var(--accent-text)' },
  },
  draft: {
    label: '임시저장',
    style: { background: 'var(--bg-subtle)', color: 'var(--text-light)' },
  },
  scheduled: {
    label: '예약됨',
    style: { background: '#fef3c7', color: '#92400e' },
  },
};

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [prev, setPrev] = useState(null);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getUser();

  useEffect(() => {
    const load = async () => {
      const [postRes, listRes] = await Promise.all([
        getPost(id),
        listPosts(),
      ]);

      if (!postRes.success) {
        setError('포스트를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      setPost(postRes.data);

      if (listRes.success) {
        // created_at 내림차순 (최신 글이 앞)
        const sorted = [...listRes.data].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        const idx = sorted.findIndex((p) => p.id === postRes.data.id);
        if (idx > 0) setPrev(sorted[idx - 1]);           // 더 최근 글
        if (idx < sorted.length - 1) setNext(sorted[idx + 1]); // 더 오래된 글
      }

      setLoading(false);
    };

    load();
  }, [id]);

  if (loading) return (
    <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>
  );

  if (error) return (
    <div className="page-content">
      <div className="alert alert-error">{error}</div>
      <Link to="/posts" className="text-link">← 목록으로</Link>
    </div>
  );

  const badge = STATUS_BADGE[post.status] || STATUS_BADGE.draft;
  const dateStr = post.created_at
    ? new Date(post.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '';

  return (
    <div className="page-content">
      {/* 상단 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Link to="/posts" className="text-link">← 포스트 목록</Link>
        {isEditorOrAdmin(user) && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
            onClick={() => navigate(`/posts/${id}/edit`)}
          >
            ✏️ 편집
          </button>
        )}
      </div>

      {/* 제목 */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-h)', marginBottom: 8, lineHeight: 1.3 }}>
        {post.title}
      </h1>

      {/* 메타 — API가 author_id(숫자)만 반환하고 이름 없음, 작성자 표시 생략 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-light)' }}>
        {dateStr && <span>{dateStr}</span>}
        {dateStr && <span>·</span>}
        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...badge.style }}>
          {badge.label}
        </span>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 28 }} />

      {/* 본문 — Quill 렌더링 */}
      <div className="ql-snow">
        <div
          className="ql-editor"
          style={{ padding: 0, fontSize: 15, lineHeight: 1.8, color: 'var(--text-h)' }}
          dangerouslySetInnerHTML={{ __html: post.content || '' }}
        />
      </div>

      {/* 이전/다음 */}
      {(prev || next) && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0 20px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              {prev && (
                <button className="btn btn-ghost" onClick={() => navigate(`/posts/${prev.id}`)}>
                  ← {prev.title}
                </button>
              )}
            </div>
            <div>
              {next && (
                <button className="btn btn-ghost" onClick={() => navigate(`/posts/${next.id}`)}>
                  {next.title} →
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: App.jsx에 PostDetail 라우트 등록**

`frontend/src/App.jsx` 를 수정합니다. import에 PostDetail 추가, `/posts/new` → `/posts/:id/edit` → `/posts/:id` 순서로 라우트 등록:

```jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Nav from './components/Nav';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import PostList from './pages/PostList';
import PostDetail from './pages/PostDetail';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Nav />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/posts" element={<PostList />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="*" element={
            <div className="empty-state" style={{ marginTop: 80 }}>
              404 — 페이지를 찾을 수 없습니다.
            </div>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
```

> `/posts/new` 와 `/posts/:id/edit` 라우트는 Task 3에서 추가합니다.

- [ ] **Step 3: 브라우저에서 확인**

> ⚠️ Task 2 완료 시점에는 `/posts/new`, `/posts/:id/edit` 라우트가 아직 없음.
> `+ 새 글` 버튼과 `✏️ 편집` 버튼은 **클릭하지 말 것** — 클릭 시 `/posts/:id`에 매칭되어 에러 화면이 표시됨. Task 3에서 해결됨.

1. `http://localhost:5173/posts` 에서 포스트 클릭
2. `/posts/1` 로 이동, 제목·날짜·상태 뱃지·본문 렌더링 확인
3. admin/editor 로그인 상태 → `✏️ 편집` 버튼 **표시** 확인 (클릭은 Task 3 이후)
4. subscriber 또는 비로그인 → `✏️ 편집` 버튼 없음 확인
5. 없는 ID(`/posts/9999`) → "포스트를 찾을 수 없습니다." 에러 메시지 확인

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PostDetail.jsx frontend/src/App.jsx
git commit -m "feat: 포스트 상세 페이지 + 라우트 등록"
```

---

## Chunk 3: PostEditor 페이지

### Task 3: PostEditor.jsx 생성 + App.jsx 에디터 라우트 등록

**Files:**
- Create: `frontend/src/pages/PostEditor.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: PostEditor.jsx 생성**

`frontend/src/pages/PostEditor.jsx` 를 아래 내용으로 생성합니다:

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { getPost, createPost, updatePost } from '../api/posts';

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};
const isEditorOrAdmin = (user) =>
  user && (user.role === 'admin' || user.role === 'editor');

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
  'list',
  'link', 'image',
];

export default function PostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const token = localStorage.getItem('token');
  const user = getUser();

  const [form, setForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    slug: '',
    post_type: 'post',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (!isEditorOrAdmin(user)) { navigate('/posts'); return; }

    if (isEdit) {
      getPost(id).then((res) => {
        if (res.success) {
          setForm({
            title: res.data.title || '',
            content: res.data.content || '',
            excerpt: res.data.excerpt || '',
            slug: res.data.slug || '',
            post_type: res.data.post_type || 'post',
          });
        }
        setLoading(false);
      });
    }
  }, [id]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (status) => {
    if (!form.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = { ...form, status };
    const result = isEdit
      ? await updatePost(token, id, payload)
      : await createPost(token, payload);

    setSaving(false);

    if (result.success) {
      navigate(`/posts/${result.data.id}`);
    } else {
      setError(result.error || '저장에 실패했습니다.');
    }
  };

  const handleCancel = () => {
    navigate(isEdit ? `/posts/${id}` : '/posts');
  };

  if (loading) return (
    <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>
  );

  return (
    <div className="page-content" style={{ maxWidth: 760 }}>
      {/* 상단 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={handleCancel} disabled={saving}>
          ← 취소
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => handleSave('draft')} disabled={saving}>
            임시저장
          </button>
          <button className="btn btn-primary" onClick={() => handleSave('published')} disabled={saving}>
            발행
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* 제목 */}
      <input
        name="title"
        value={form.title}
        onChange={handleChange}
        placeholder="제목을 입력하세요"
        style={{
          display: 'block',
          width: '100%',
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text-h)',
          border: 'none',
          borderBottom: '2px solid var(--border)',
          padding: '0 0 12px',
          marginBottom: 20,
          background: 'transparent',
          outline: 'none',
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
        }}
      />

      {/* WYSIWYG 에디터 */}
      <ReactQuill
        theme="snow"
        value={form.content}
        onChange={(val) => setForm({ ...form, content: val })}
        modules={QUILL_MODULES}
        formats={QUILL_FORMATS}
        style={{ marginBottom: 24 }}
      />

      {/* 하단 옵션 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 120px',
        gap: 12,
        paddingTop: 16,
        borderTop: '1px solid var(--border)',
      }}>
        <div>
          <label className="form-label">요약 (선택)</label>
          <input
            className="form-input"
            name="excerpt"
            value={form.excerpt}
            onChange={handleChange}
            placeholder="포스트 요약"
          />
        </div>
        <div>
          <label className="form-label">슬러그 (선택)</label>
          <input
            className="form-input"
            name="slug"
            value={form.slug}
            onChange={handleChange}
            placeholder="url-slug"
          />
        </div>
        <div>
          <label className="form-label">타입</label>
          <select className="form-input" name="post_type" value={form.post_type} onChange={handleChange}>
            <option value="post">post</option>
            <option value="page">page</option>
          </select>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: App.jsx에 에디터 라우트 추가**

`frontend/src/App.jsx` 를 수정합니다. PostEditor import 추가, `/posts/new` 와 `/posts/:id/edit` 라우트를 `/posts/:id` **앞에** 삽입합니다:

```jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Nav from './components/Nav';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import PostList from './pages/PostList';
import PostDetail from './pages/PostDetail';
import PostEditor from './pages/PostEditor';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Nav />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/posts" element={<PostList />} />
          {/* /posts/new 는 /posts/:id 보다 반드시 먼저 */}
          <Route path="/posts/new" element={<PostEditor />} />
          <Route path="/posts/:id/edit" element={<PostEditor />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="*" element={
            <div className="empty-state" style={{ marginTop: 80 }}>
              404 — 페이지를 찾을 수 없습니다.
            </div>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
```

- [ ] **Step 3: 브라우저에서 전체 흐름 확인**

admin 또는 editor 계정으로 로그인 후:

1. `/posts` 에서 `+ 새 글` 클릭 → `/posts/new` 이동
2. 제목 입력, Quill로 내용 작성 (굵게, 링크 등 서식 테스트)
3. `임시저장` 클릭 → `/posts/:id` 로 이동, 상태 뱃지 "임시저장" 확인
4. `✏️ 편집` 버튼 클릭 → `/posts/:id/edit` 이동, 기존 내용 로드 확인
5. 내용 수정 후 `발행` 클릭 → "발행됨" 뱃지 확인
6. 포스트 2개 이상 있을 경우 이전/다음 글 버튼 동작 확인
7. subscriber 계정으로 로그인 → `+ 새 글` 버튼 없음, `✏️ 편집` 버튼 없음 확인
8. `/posts/new` 직접 접근 시 `/posts` 로 리다이렉트 확인

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PostEditor.jsx frontend/src/App.jsx
git commit -m "feat: 포스트 WYSIWYG 에디터 (신규/수정) + 라우트 등록"
```
