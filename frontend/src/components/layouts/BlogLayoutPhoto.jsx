import { useNavigate } from 'react-router-dom';

function PhotoCard({ post, accentColor }) {
  const navigate = useNavigate();
  const bg = post.thumbnail_url
    ? `url(${post.thumbnail_url}) center/cover no-repeat`
    : `linear-gradient(135deg, ${accentColor}cc, ${accentColor}55)`;

  return (
    <div
      onClick={() => navigate(`/posts/${post.id}`)}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ height: 160, background: bg }} />
      <div style={{ padding: '14px 16px', flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, lineHeight: 1.4 }}>
          {post.title}
        </div>
        {post.excerpt && (
          <div style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5, marginBottom: 8 }}>
            {post.excerpt.length > 60 ? `${post.excerpt.slice(0, 60)}…` : post.excerpt}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-light)', display: 'flex', gap: 6 }}>
          <span>
            {new Date(post.created_at).toLocaleDateString('ko-KR', {
              month: 'short', day: 'numeric',
            })}
          </span>
          <span>·</span>
          <span>👁 {post.view_count ?? 0}</span>
          <span>·</span>
          <span>♥ {post.like_count ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

export default function BlogLayoutPhoto({ posts, loading, hasMore, sentinelRef, accentColor }) {
  if (posts.length === 0 && !loading) {
    return <div className="empty-state"><p>아직 포스트가 없습니다.</p></div>;
  }

  return (
    <>
      <div className="photo-grid">
        {posts.map((post) => (
          <PhotoCard key={post.id} post={post} accentColor={accentColor} />
        ))}
      </div>
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && (
        <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 글이 없습니다.
        </div>
      )}
    </>
  );
}
