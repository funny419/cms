import { useNavigate } from 'react-router-dom';
import TagCloud from '../widgets/TagCloud';

function FeaturedPost({ post, accentColor }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/posts/${post.id}`)}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 24,
        cursor: 'pointer',
      }}
    >
      <div style={{ height: 8, background: accentColor || 'var(--accent)' }} />
      <div style={{ padding: '24px 28px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
          Featured
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4, marginBottom: 10 }}>
          {post.title}
        </div>
        {post.excerpt && (
          <div style={{ color: 'var(--text-light)', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
            {post.excerpt}
          </div>
        )}
        {post.tags && post.tags.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <TagCloud tags={post.tags} />
          </div>
        )}
        <div className="post-meta">
          <span>
            {new Date(post.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric',
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

export default function BlogLayoutMagazine({ posts, loading, hasMore, sentinelRef, accentColor }) {
  const navigate = useNavigate();
  const [featured, ...rest] = posts;

  if (posts.length === 0 && !loading) {
    return <div className="empty-state"><p>게시된 글이 없습니다.</p></div>;
  }

  return (
    <>
      {featured && <FeaturedPost post={featured} accentColor={accentColor} />}
      {rest.length > 0 && (
        <ul className="post-list">
          {rest.map((post) => (
            <li
              key={post.id}
              className="post-item"
              onClick={() => navigate(`/posts/${post.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="post-title">{post.title}</div>
              {post.excerpt && <div className="post-excerpt">{post.excerpt}</div>}
              {post.tags && post.tags.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <TagCloud tags={post.tags} />
                </div>
              )}
              <div className="post-meta">
                <span>
                  {new Date(post.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </span>
                <span>·</span>
                <span>👁 {post.view_count ?? 0}</span>
                <span>·</span>
                <span>♥ {post.like_count ?? 0}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
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
