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
        {/* 아바타 (배너와 겹침) */}
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
