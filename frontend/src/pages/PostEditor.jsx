import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import MDEditor from '@uiw/react-md-editor';
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
    content_format: 'html',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (!isEditorOrAdmin(user)) { navigate('/posts'); return; }

    if (isEdit) {
      getPost(id, token, true).then((res) => {   // skipCount=true → view_count 미증가
        if (res.success) {
          setForm({
            title: res.data.title || '',
            content: res.data.content || '',
            excerpt: res.data.excerpt || '',
            slug: res.data.slug || '',
            post_type: res.data.post_type || 'post',
            content_format: res.data.content_format || 'html',
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
          onClick={() => setForm({ ...form, content_format: 'markdown' })}
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
