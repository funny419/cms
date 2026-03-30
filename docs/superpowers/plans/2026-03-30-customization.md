# 블로그 커스터마이제이션 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 각 블로그 소유자가 `/my-blog/settings`에서 블로그 제목·대표색·SNS 링크·웹사이트 URL을 설정하고, `/blog/:username` 블로그 홈에 즉시 반영되게 한다.

**Architecture:** User 모델에 `blog_title`, `blog_color`, `website_url`, `social_links`(JSON) 4개 컬럼 추가. 기존 `PUT /api/auth/me` API에 필드만 추가(신규 엔드포인트 불필요). FE는 `/my-blog/settings` 신규 페이지(기본정보+디자인 탭)와 ProfileCard 컴포넌트 업데이트로 구성.

**Tech Stack:** Python 3.11 + Flask + SQLAlchemy 3.x + Flask-Migrate + pytest(MariaDB) / React 19 + Vite + axios + input[type=color]

---

## 파일 변경 맵

### 신규 생성
| 파일 | 역할 |
|------|------|
| `backend/tests/test_customization.py` | blog_title/blog_color/social_links 업데이트 테스트 |
| `frontend/src/pages/BlogSettings.jsx` | `/my-blog/settings` 설정 페이지 |
| `backend/migrations/versions/xxxx_add_blog_customization.py` | 마이그레이션 |

### 수정
| 파일 | 변경 내용 |
|------|---------|
| `backend/models/schema.py` | User에 blog_title, blog_color, website_url, social_links 추가 |
| `backend/api/auth.py` | update_me()에 4개 필드 처리 추가 |
| `frontend/src/components/ProfileCard.jsx` | 블로그 제목·색상·SNS·웹사이트 표시 |
| `frontend/src/pages/BlogHome.jsx` | ProfileCard에 커스텀 색상 배너 적용 |
| `frontend/src/App.jsx` | `/my-blog/settings` 라우트 추가 |
| `frontend/src/components/Nav.jsx` | editor에 "⚙️" 설정 링크 추가 |

---

## Chunk 1: BE — DB 마이그레이션 + API 확장

### Task 1: User 모델 확장 + 마이그레이션 + update_me() 확장

**Files:**
- Modify: `backend/models/schema.py`
- Modify: `backend/api/auth.py`
- Create: `backend/tests/test_customization.py`
- Auto-create: `backend/migrations/versions/xxxx_add_blog_customization.py`

- [ ] **Step 1: 테스트 먼저 작성**

```python
# backend/tests/test_customization.py
def test_update_blog_title(client, app, editor_headers):
    res = client.put(
        "/api/auth/me",
        json={"blog_title": "나의 개발 블로그"},
        headers=editor_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["blog_title"] == "나의 개발 블로그"


def test_update_blog_color(client, app, editor_headers):
    res = client.put(
        "/api/auth/me",
        json={"blog_color": "#3b82f6"},
        headers=editor_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["blog_color"] == "#3b82f6"


def test_update_website_url(client, app, editor_headers):
    res = client.put(
        "/api/auth/me",
        json={"website_url": "https://example.com"},
        headers=editor_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["website_url"] == "https://example.com"


def test_update_social_links(client, app, editor_headers):
    links = {"github": "https://github.com/testuser", "twitter": "", "linkedin": ""}
    res = client.put(
        "/api/auth/me",
        json={"social_links": links},
        headers=editor_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["social_links"]["github"] == "https://github.com/testuser"


def test_me_response_includes_customization_fields(client, app, editor_headers):
    res = client.get("/api/auth/me", headers=editor_headers)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "blog_title" in data
    assert "blog_color" in data
    assert "website_url" in data
    assert "social_links" in data
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker compose exec backend pytest tests/test_customization.py -v
```
예상: 5개 FAILED

- [ ] **Step 3: schema.py User 모델에 4개 컬럼 추가**

`backend/models/schema.py`의 User 클래스, `avatar_url` 컬럼 아래에 추가:

```python
blog_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
blog_color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)  # HEX (#rrggbb)
website_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
social_links: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
```

> ⚠️ `JSON` 타입은 이미 `backend/models/schema.py` 상단에 import 돼있음 (Media 모델에서 사용 중) — 확인 후 생략.

`User.to_dict()` 반환 dict에 추가:
```python
"blog_title": self.blog_title,
"blog_color": self.blog_color,
"website_url": self.website_url,
"social_links": self.social_links,
```

- [ ] **Step 4: auth.py update_me()에 4개 필드 처리 추가**

`backend/api/auth.py`의 `update_me()` 함수, `if "avatar_url" in data:` 블록 아래에 추가:

```python
if "blog_title" in data:
    user.blog_title = data["blog_title"] or None
if "blog_color" in data:
    # HEX 형식 검증 (#rrggbb)
    color = data["blog_color"]
    if color and (len(color) != 7 or not color.startswith("#")):
        return jsonify({"success": False, "data": {}, "error": "blog_color는 #rrggbb 형식이어야 합니다."}), 400
    user.blog_color = color or None
if "website_url" in data:
    user.website_url = data["website_url"] or None
if "social_links" in data:
    user.social_links = data["social_links"] or None
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
docker compose exec backend pytest tests/test_customization.py -v
```
예상: 5개 PASSED

- [ ] **Step 6: 전체 회귀 확인**

```bash
docker compose exec backend pytest tests/ -v
```
예상: 전체 통과

- [ ] **Step 7: Flask-Migrate 마이그레이션 생성**

```bash
docker compose exec backend flask db migrate -m "add blog customization to users"
```

생성된 파일 확인 — 4개 컬럼 추가 확인:
- `blog_title VARCHAR(200) NULL`
- `blog_color VARCHAR(7) NULL`
- `website_url VARCHAR(500) NULL`
- `social_links JSON NULL`

- [ ] **Step 8: 백엔드 재시작**

```bash
docker compose restart backend
sleep 5
docker compose logs backend --tail=10
```

- [ ] **Step 9: ruff + mypy**

```bash
docker compose exec backend ruff check .
docker compose exec backend mypy api/auth.py models/schema.py
```

- [ ] **Step 10: 커밋**

```bash
git add backend/models/schema.py backend/api/auth.py \
        backend/tests/test_customization.py \
        backend/migrations/versions/
git commit -m "feat: 블로그 커스터마이제이션 DB 컬럼 추가 + API 확장 (blog_title/color/website/social)"
```

---

## Chunk 2: FE — 설정 페이지 + ProfileCard 업데이트

### Task 2: /my-blog/settings 페이지

**Files:**
- Create: `frontend/src/pages/BlogSettings.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Nav.jsx`

- [ ] **Step 1: BlogSettings.jsx 생성**

```jsx
// frontend/src/pages/BlogSettings.jsx
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
    });
    setSaving(false);
    if (res.success) {
      setUser(res.data);
      // localStorage user 업데이트
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, ...res.data }));
      } catch {}
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
        <button
          className="btn btn-ghost"
          onClick={() => navigate(`/blog/${user?.username}`)}
        >
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

      {/* 기본 정보 탭 */}
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

          {/* 웹사이트 URL */}
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

      {/* 디자인 탭 */}
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
                <div style={{
                  width: 160, height: 40, borderRadius: 8,
                  background: form.blog_color,
                  border: '1px solid var(--border)',
                  marginBottom: 6,
                }} />
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
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || avatarUploading}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => navigate(`/blog/${user?.username}`)}
          disabled={saving}
        >
          취소
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: App.jsx에 /my-blog/settings 라우트 추가**

`frontend/src/App.jsx`를 읽고:

import 추가:
```jsx
import BlogSettings from './pages/BlogSettings';
```

Routes에 `/search` 라우트 아래 추가:
```jsx
<Route path="/my-blog/settings" element={<BlogSettings />} />
```

- [ ] **Step 3: Nav.jsx에 ⚙️ 설정 링크 추가**

editor 링크 목록에서 "내 블로그" 링크 아래에 추가:
```jsx
<Link to="/my-blog/settings" className="nav-link" title="블로그 설정">⚙️</Link>
```

- [ ] **Step 4: ESLint 확인**

```bash
docker compose exec -T frontend npx eslint \
  src/pages/BlogSettings.jsx src/App.jsx src/components/Nav.jsx 2>&1
```

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/pages/BlogSettings.jsx \
        frontend/src/App.jsx frontend/src/components/Nav.jsx
git commit -m "feat: /my-blog/settings 블로그 설정 페이지 (기본정보 + 디자인 탭)"
```

---

### Task 3: ProfileCard + BlogHome 커스터마이제이션 반영

**Files:**
- Modify: `frontend/src/components/ProfileCard.jsx`
- Modify: `frontend/src/pages/BlogHome.jsx`

- [ ] **Step 1: ProfileCard.jsx 업데이트**

파일을 읽고 전체 교체:

```jsx
// frontend/src/components/ProfileCard.jsx

const SOCIAL_ICONS = {
  github: '🐙',
  twitter: '🐦',
  linkedin: '💼',
};

export default function ProfileCard({ user, blogColor }) {
  if (!user) return null;

  const displayTitle = user.blog_title || `${user.username}의 블로그`;
  const accentColor = blogColor || user.blog_color || '#7c3aed';
  const hasSocial = user.social_links &&
    Object.values(user.social_links).some((v) => v);

  return (
    <div style={{ marginBottom: 32, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* 컬러 배너 */}
      <div style={{ height: 60, background: accentColor }} />

      {/* 프로필 영역 */}
      <div style={{ padding: '0 20px 20px', background: 'var(--bg-subtle)' }}>
        {/* 아바타 (배너 아래로 절반 걸침) */}
        <div style={{ marginTop: -24, marginBottom: 12 }}>
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.username}
              style={{
                width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                border: '3px solid var(--bg)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: accentColor, border: '3px solid var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: 'white',
            }}>
              {user.username[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* 이름 + 소개 */}
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{displayTitle}</h1>
        {user.bio && (
          <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
            {user.bio}
          </p>
        )}

        {/* 메타 정보 */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'var(--text-light)' }}>
          <span>포스트 {user.post_count}개</span>
          {user.created_at && (
            <span>· {new Date(user.created_at).getFullYear()}년 시작</span>
          )}
          {user.website_url && (
            <a
              href={user.website_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: accentColor, textDecoration: 'none' }}
            >
              🔗 웹사이트
            </a>
          )}
        </div>

        {/* SNS 링크 */}
        {hasSocial && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {Object.entries(user.social_links || {}).map(([key, url]) =>
              url ? (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    textDecoration: 'none', fontSize: 16,
                  }}
                >
                  {SOCIAL_ICONS[key] || '🔗'}
                </a>
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: BlogHome.jsx에서 ProfileCard에 blogColor prop 전달**

`frontend/src/pages/BlogHome.jsx`를 읽고:

ProfileCard 사용 부분을 수정:
```jsx
// 기존:
<ProfileCard user={profile} />

// 변경:
<ProfileCard user={profile} blogColor={profile?.blog_color} />
```

- [ ] **Step 3: ESLint 확인**

```bash
docker compose exec -T frontend npx eslint \
  src/components/ProfileCard.jsx src/pages/BlogHome.jsx 2>&1
```

- [ ] **Step 4: 동작 확인**

1. `/my-blog/settings` 접속 → 기본 정보 탭에서 blog_title, bio, avatar 업로드, SNS 링크 입력 → 저장
2. 디자인 탭에서 blog_color 선택 → 미리보기 즉시 반영 → 저장
3. `/blog/:username` 접속 → 색상 배너, 블로그 제목, SNS 아이콘, 웹사이트 링크 표시 확인
4. Nav에 ⚙️ 링크 클릭 → `/my-blog/settings` 이동 확인

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/ProfileCard.jsx frontend/src/pages/BlogHome.jsx
git commit -m "feat: ProfileCard 커스터마이제이션 반영 (배너색상, 블로그제목, SNS링크, 웹사이트)"
```

---

## 완료 체크리스트

- [ ] `docker compose exec backend pytest tests/ -v` — 전체 통과
- [ ] `/my-blog/settings` → 기본 정보 저장 → `/blog/:username`에 즉시 반영
- [ ] `/my-blog/settings` → 디자인 탭 색상 선택 → 미리보기 즉시 반영
- [ ] 배너 색상이 ProfileCard 상단에 표시됨
- [ ] SNS 링크 아이콘 클릭 시 새 탭으로 열림
- [ ] blog_color 미입력 시 기본값 #7c3aed 사용
- [ ] Nav ⚙️ 아이콘 → /my-blog/settings 이동
