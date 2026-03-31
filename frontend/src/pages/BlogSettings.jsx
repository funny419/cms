import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, updateUser } from '../api/auth';
import { uploadMedia } from '../api/media';

const SOCIAL_FIELDS = [
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://twitter.com/username' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
];

const TAB_BASIC = 'basic';
const TAB_DESIGN = 'design';

export default function BlogSettings() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(TAB_BASIC);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [form, setForm] = useState({
    blog_title: '',
    bio: '',
    avatar_url: '',
    website_url: '',
    social_links: { github: '', twitter: '', linkedin: '' },
    blog_color: '#7c3aed',
    blog_layout: 'default',
  });

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    getCurrentUser(token).then((res) => {
      if (!res.success) { navigate('/login'); return; }
      const u = res.data;
      setUser(u);
      setForm({
        blog_title: u.blog_title || '',
        bio: u.bio || '',
        avatar_url: u.avatar_url || '',
        website_url: u.website_url || '',
        social_links: u.social_links || { github: '', twitter: '', linkedin: '' },
        blog_color: u.blog_color || '#7c3aed',
        blog_layout: u.blog_layout || 'default',
      });
      setLoading(false);
    });
  }, [token, navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSocialChange = (key, value) => {
    setForm({ ...form, social_links: { ...form.social_links, [key]: value } });
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setAvatarUploading(true);
    setError('');
    const res = await uploadMedia(token, file);
    setAvatarUploading(false);
    if (res.success) {
      setForm((prev) => ({ ...prev, avatar_url: res.data.url }));
    } else {
      setError(res.error || '이미지 업로드에 실패했습니다.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    const res = await updateUser(token, {
      blog_title: form.blog_title || null,
      bio: form.bio || null,
      avatar_url: form.avatar_url || null,
      website_url: form.website_url || null,
      social_links: form.social_links,
      blog_color: form.blog_color,
      blog_layout: form.blog_layout,
    });
    setSaving(false);
    if (res.success) {
      setUser(res.data);
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, ...res.data }));
      } catch {} // eslint-disable-line no-empty
      setMessage('저장됐습니다.');
    } else {
      setError(res.error || '저장에 실패했습니다.');
    }
  };

  if (loading) return <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>;

  const tabStyle = (tab) => ({
    padding: '8px 20px',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? 'var(--accent)' : 'var(--text-light)',
    fontSize: 14,
  });

  return (
    <div className="page-content" style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>블로그 설정</h1>
        <button className="btn btn-ghost" onClick={() => navigate(`/blog/${user?.username}`)}>
          내 블로그 보기 →
        </button>
      </div>

      {/* 탭 */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 24, display: 'flex' }}>
        <button style={tabStyle(TAB_BASIC)} onClick={() => setActiveTab(TAB_BASIC)}>기본 정보</button>
        <button style={tabStyle(TAB_DESIGN)} onClick={() => setActiveTab(TAB_DESIGN)}>디자인</button>
      </div>

      {message && <div className="alert alert-success" style={{ marginBottom: 16 }}>{message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {activeTab === TAB_BASIC && (
        <div>
          {/* 프로필 사진 */}
          <div className="form-group">
            <label className="form-label">프로필 사진</label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {form.avatar_url && (
                <img
                  src={form.avatar_url}
                  alt="프로필"
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <label style={{ cursor: avatarUploading ? 'not-allowed' : 'pointer' }}>
                <span className="btn btn-ghost" style={{ fontSize: 13 }}>
                  {avatarUploading ? '업로드 중...' : '사진 업로드'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={avatarUploading}
                  onChange={handleAvatarUpload}
                />
              </label>
              {form.avatar_url && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 13, color: 'var(--danger)' }}
                  onClick={() => setForm((p) => ({ ...p, avatar_url: '' }))}
                >
                  제거
                </button>
              )}
            </div>
          </div>

          {/* 블로그 제목 */}
          <div className="form-group">
            <label className="form-label" htmlFor="blog_title">블로그 제목</label>
            <input
              className="form-input"
              id="blog_title"
              name="blog_title"
              value={form.blog_title}
              onChange={handleChange}
              placeholder={`${user?.username}의 블로그 (기본값)`}
              maxLength={200}
            />
          </div>

          {/* 자기소개 */}
          <div className="form-group">
            <label className="form-label" htmlFor="bio">자기소개</label>
            <textarea
              className="form-input"
              id="bio"
              name="bio"
              value={form.bio}
              onChange={handleChange}
              placeholder="블로그 소개글을 입력하세요"
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* 웹사이트 */}
          <div className="form-group">
            <label className="form-label" htmlFor="website_url">웹사이트</label>
            <input
              className="form-input"
              type="url"
              id="website_url"
              name="website_url"
              value={form.website_url}
              onChange={handleChange}
              placeholder="https://example.com"
            />
          </div>

          {/* SNS 링크 */}
          <div className="form-group">
            <label className="form-label">SNS 링크</label>
            {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 80, fontSize: 13, color: 'var(--text-light)', flexShrink: 0 }}>{label}</span>
                <input
                  className="form-input"
                  value={form.social_links[key] || ''}
                  onChange={(e) => handleSocialChange(key, e.target.value)}
                  placeholder={placeholder}
                  style={{ flex: 1 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === TAB_DESIGN && (
        <div>
          {/* 대표 색상 */}
          <div className="form-group">
            <label className="form-label">블로그 대표 색상</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="color"
                name="blog_color"
                value={form.blog_color}
                onChange={handleChange}
                style={{ width: 48, height: 48, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }}
              />
              <div>
                <div style={{ width: 160, height: 40, borderRadius: 8, background: form.blog_color, border: '1px solid var(--border)', marginBottom: 6 }} />
                <code style={{ fontSize: 12, color: 'var(--text-light)' }}>{form.blog_color}</code>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>
              블로그 홈 배너와 프로필 카드에 적용됩니다.
            </p>
          </div>

          {/* 색상 프리셋 */}
          <div className="form-group">
            <label className="form-label">프리셋</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { color: '#7c3aed', name: 'Notion 보라' },
                { color: '#16a34a', name: 'Forest 초록' },
                { color: '#2563eb', name: 'Ocean 파랑' },
                { color: '#db2777', name: 'Rose 분홍' },
                { color: '#ea580c', name: '오렌지' },
                { color: '#0891b2', name: '시안' },
              ].map(({ color, name }) => (
                <button
                  key={color}
                  onClick={() => setForm((p) => ({ ...p, blog_color: color }))}
                  title={name}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', background: color,
                    border: form.blog_color === color ? '3px solid var(--text)' : '2px solid var(--border)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* 레이아웃 선택 */}
          <div className="form-group">
            <label className="form-label">블로그 레이아웃</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { value: 'default', label: 'A. 기본', desc: '사이드바 + 포스트 목록' },
                { value: 'compact', label: 'B. 콤팩트', desc: '포스트 목록만 (사이드바 숨김)' },
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setForm((p) => ({ ...p, blog_layout: value }))}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 8, cursor: 'pointer',
                    border: form.blog_layout === value || (!form.blog_layout && value === 'default')
                      ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: 'var(--bg)', textAlign: 'center',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 미리보기 */}
          <div className="form-group">
            <label className="form-label">블로그 홈 미리보기</label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ height: 60, background: form.blog_color }} />
              <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid white' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-subtle)', border: '2px solid white' }} />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {form.blog_title || `${user?.username}의 블로그`}
                  </div>
                  {form.bio && (
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
                      {form.bio.slice(0, 50)}{form.bio.length > 50 ? '...' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 저장 버튼 */}
      <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || avatarUploading}>
          {saving ? '저장 중...' : '저장'}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate(`/blog/${user?.username}`)} disabled={saving}>
          취소
        </button>
      </div>
    </div>
  );
}
