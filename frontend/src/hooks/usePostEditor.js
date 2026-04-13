import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPost, createPost, updatePost } from '../api/posts';
import { getTags } from '../api/tags';
import { useAuth } from './useAuth';

const DRAFT_KEY = 'cms_post_draft';

const FORM_BASE = {
  title: '', content: '', excerpt: '', slug: '', post_type: 'post',
  content_format: 'html', visibility: 'public', category_id: null,
  series_id: null, tags: [], thumbnail_url: '',
};

const isEditorOrAdmin = (user) =>
  user && (user.role === 'admin' || user.role === 'editor');

export function usePostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(() => {
    if (id) return FORM_BASE;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...FORM_BASE, ...JSON.parse(saved) } : FORM_BASE;
    } catch {
      return FORM_BASE;
    }
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState('');
  const [slugError, setSlugError] = useState('');
  const [availableTags, setAvailableTags] = useState([]);

  // 권한 확인 + 편집 모드 포스트 로딩
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
            category_id: res.data.category_id ?? null,
            series_id: res.data.series_id ?? null,
            tags: res.data.tags || [],
            thumbnail_url: res.data.thumbnail_url || '',
          });
        }
        setLoading(false);
      });
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 태그 목록 로딩
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

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (status) => {
    if (!form.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    setSaving(true);
    setError('');
    setSlugError('');
    const payload = { ...form, status, tags: form.tags.map((t) => t.id) };
    const result = isEdit
      ? await updatePost(token, id, payload)
      : await createPost(token, payload);
    setSaving(false);
    if (result.success) {
      localStorage.removeItem(DRAFT_KEY);
      navigate(`/posts/${result.data.id}`);
    } else if (result.status === 409) {
      setSlugError('이미 사용 중인 URL 슬러그입니다.');
    } else {
      setError(result.error || '저장에 실패했습니다.');
    }
  };

  const handleCancel = () => {
    navigate(isEdit ? `/posts/${id}` : '/posts');
  };

  return {
    id, isEdit, form, setForm,
    loading, saving, draftSaved, error, setError, slugError,
    availableTags, token, user,
    handleChange, handleSave, handleCancel,
  };
}
