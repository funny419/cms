export default function ProfileCard({ user }) {
  if (!user) return null;

  return (
    <div style={{
      display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 32,
      padding: 24, background: 'var(--bg-subtle)', borderRadius: 12,
    }}>
      {user.avatar_url && (
        <img
          src={user.avatar_url}
          alt={user.username}
          style={{
            width: 64, height: 64, borderRadius: '50%', objectFit: 'cover',
            border: '2px solid var(--border)', flexShrink: 0,
          }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          {user.username}의 블로그
        </h1>
        {user.bio && (
          <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 8 }}>
            {user.bio}
          </p>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
          포스트 {user.post_count}개
          {user.created_at && ` · ${new Date(user.created_at).getFullYear()}년 시작`}
        </span>
      </div>
    </div>
  );
}
