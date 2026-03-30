import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import MDEditor from '@uiw/react-md-editor';
import { getPost, createPost, updatePost } from '../api/posts';
import { uploadMedia } from '../api/media';
import { getTags } from '../api/tags';
import { useTheme } from '../context/ThemeContext';
import TagInput from '../components/inputs/TagInput';

const DRAFT_KEY = 'cms_post_draft';

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};
const isEditorOrAdmin = (user) =>
  user && (user.role === 'admin' || user.role === 'editor');

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
  const { theme } = useTheme();
  const quillRef = useRef(null);

  const [form, setForm] = useState(() => {
    const base = { title: '', content: '', excerpt: '', slug: '', post_type: 'post', content_format: 'html', visibility: 'public', tags: [] };
    if (id) return base; // 편집 모드: draft 무시
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...base, ...JSON.parse(saved) } : base;
    } catch {
      return base;
    }
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState('');
  const [availableTags, setAvailableTags] = useState([]);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (!isEditorOrAdmin(user)) { navigate('/posts'); return; }

    if (isEdit) {
      getPost(id, token, true).then((res) => {
        if (res.success) {
          setForm({
            title: res.data.title || '',
            content: res.data.content || '',
            excerpt: res.data.excerpt || '',
            slug: res.data.slug || '',
            post_type: res.data.post_type || 'post',
            content_format: res.data.content_format || 'html',
            visibility: res.data.visibility || 'public',
            tags: res.data.tags || [],
          });
        }
        setLoading(false);
      });
    }
  }, [id]);

  useEffect(() => {
    getTags().then((res) => {
      if (res.success) setAvailableTags(res.data.items || []);
    });
  }, []);

  // 신규 작성 시: 10초마다 자동저장
  useEffect(() => {
    if (isEdit) return;
    const timer = setInterval(() => {
      if (form.title || form.content) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2000);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [form, isEdit]);

  // WYSIWYG 이미지 핸들러: 파일 선택 → API 업로드 → Quill에 삽입
  const quillImageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      setImageUploading(true);
      setError('');
      const res = await uploadMedia(token, file);
      setImageUploading(false);
      if (res.success) {
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, 'image', res.data.url);
          quill.setSelection(range.index + 1);
        }
      } else {
        setError(res.error || '이미지 업로드에 실패했습니다.');
      }
    };
    input.click();
  }, [token]);

  // QUILL_MODULES: quillImageHandler 의존성 때문에 useMemo로 컴포넌트 내부에 선언
  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline'],
        [{ header: 1 }, { header: 2 }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image'],
        ['clean'],
      ],
      handlers: { image: quillImageHandler },
    },
  }), [quillImageHandler]);

  // Markdown 이미지 삽입: 업로드 후 ![이미지](url) 커서 위치에 추가
  const handleMarkdownImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // 같은 파일 재선택 허용
    setImageUploading(true);
    setError('');
    const res = await uploadMedia(token, file);
    setImageUploading(false);
    if (res.success) {
      const mdSyntax = `\n![이미지](${res.data.url})\n`;
      setForm((prev) => ({ ...prev, content: prev.content + mdSyntax }));
    } else {
      setError(res.error || '이미지 업로드에 실패했습니다.');
    }
  };

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

    const payload = { ...form, status, tags: form.tags.map((t) => t.id) };
    const result = isEdit
      ? await updatePost(token, id, payload)
      : await createPost(token, payload);

    setSaving(false);

    if (result.success) {
      localStorage.removeItem(DRAFT_KEY);
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
          <button className="btn btn-ghost" onClick={() => handleSave('draft')} disabled={saving || imageUploading}>
            임시저장
          </button>
          <button className="btn btn-primary" onClick={() => handleSave('published')} disabled={saving || imageUploading}>
            발행
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {draftSaved && !isEdit && (
        <div style={{ fontSize: 12, color: 'var(--text-light)', textAlign: 'right', marginBottom: 8 }}>
          ✓ 임시저장됨
        </div>
      )}
      {imageUploading && (
        <div className="alert" style={{ marginBottom: 16, background: 'var(--accent-bg)', color: 'var(--accent-text)', border: '1px solid var(--accent)' }}>
          이미지 업로드 중...
        </div>
      )}

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
        <div style={{ marginBottom: 24 }}>
          {/* Markdown 이미지 업로드 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--text)',
              cursor: imageUploading ? 'not-allowed' : 'pointer',
              background: 'var(--bg)',
              opacity: imageUploading ? 0.5 : 1,
            }}>
              🖼 이미지 삽입
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                disabled={imageUploading}
                onChange={handleMarkdownImageUpload}
              />
            </label>
          </div>
          <div data-color-mode={theme === 'dark' ? 'dark' : 'light'}>
            <MDEditor
              value={form.content}
              onChange={(val) => setForm({ ...form, content: val || '' })}
              height={400}
            />
          </div>
        </div>
      ) : (
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={form.content}
          onChange={(val) => setForm({ ...form, content: val })}
          modules={quillModules}
          formats={QUILL_FORMATS}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 하단 옵션 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
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
        <div>
          <label className="form-label">공개 범위</label>
          <select
            className="form-input"
            name="visibility"
            value={form.visibility}
            onChange={handleChange}
          >
            <option value="public">전체 공개</option>
            <option value="members_only">회원만</option>
            <option value="private">나만 보기</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label className="form-label">태그</label>
        <TagInput
          selectedTags={form.tags}
          availableTags={availableTags}
          onChange={(tags) => setForm((prev) => ({ ...prev, tags }))}
        />
      </div>
    </div>
  );
}
