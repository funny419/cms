import { useState, useCallback, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import MDEditor from '@uiw/react-md-editor';
import { uploadMedia } from '../api/media';
import { useTheme } from '../context/ThemeContext';
import { useCategories } from '../context/CategoryContext';
import TagInput from '../components/inputs/TagInput';
import CategoryDropdown from '../components/inputs/CategoryDropdown';
import SeriesDropdown from '../components/inputs/SeriesDropdown';
import { usePostEditor } from '../hooks/usePostEditor';

const QUILL_FORMATS = [
  'bold', 'italic', 'underline',
  'header',
  'list',
  'link', 'image',
];

export default function PostEditor() {
  const { theme } = useTheme();
  const { categories } = useCategories();
  const quillRef = useRef(null);
  const [imageUploading, setImageUploading] = useState(false);

  const {
    isEdit, form, setForm,
    loading, saving, draftSaved, error, setError, slugError,
    availableTags, token, user,
    handleChange, handleSave, handleCancel,
  } = usePostEditor();

  const quillImageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        setError('이미지 크기가 10MB를 초과합니다.');
        return;
      }
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
      } else if (res.error) {
        setError(res.error);
      }
    };
    input.click();
  }, [token, setError]);

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

  const handleMarkdownImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 10 * 1024 * 1024) {
      setError('이미지 크기가 10MB를 초과합니다.');
      return;
    }
    setImageUploading(true);
    setError('');
    const res = await uploadMedia(token, file);
    setImageUploading(false);
    if (res.success) {
      const mdSyntax = `\n![이미지](${res.data.url})\n`;
      setForm((prev) => ({ ...prev, content: prev.content + mdSyntax }));
    } else if (res.error) {
      setError(res.error);
    }
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
          onClick={() => setForm((prev) => ({ ...prev, content_format: 'html' }))}
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
          onClick={() => setForm((prev) => ({ ...prev, content_format: 'markdown' }))}
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
            <label
              aria-label="이미지 삽입"
              style={{
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
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: 'none' }}
                disabled={imageUploading}
                onChange={handleMarkdownImageUpload}
              />
            </label>
          </div>
          <div data-color-mode={theme === 'dark' ? 'dark' : 'light'}>
            <MDEditor
              value={form.content}
              onChange={(val) => setForm((prev) => ({ ...prev, content: val || '' }))}
              height={400}
            />
          </div>
        </div>
      ) : (
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={form.content}
          onChange={(val) => setForm((prev) => ({ ...prev, content: val }))}
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
            style={slugError ? { borderColor: 'var(--danger)' } : undefined}
          />
          {slugError && (
            <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{slugError}</p>
          )}
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
        <div>
          <label className="form-label">카테고리</label>
          <CategoryDropdown
            value={form.category_id}
            onChange={(catId) => setForm((prev) => ({ ...prev, category_id: catId }))}
            categories={categories}
          />
        </div>
        <div>
          <label className="form-label">시리즈</label>
          <SeriesDropdown
            value={form.series_id}
            onChange={(sid) => setForm((prev) => ({ ...prev, series_id: sid }))}
            username={user?.username}
          />
        </div>
        <div>
          <label className="form-label">썸네일 URL (선택)</label>
          <input
            className="form-input"
            name="thumbnail_url"
            value={form.thumbnail_url}
            onChange={handleChange}
            placeholder="https://example.com/image.jpg"
          />
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
