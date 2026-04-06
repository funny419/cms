import { useNavigate } from 'react-router-dom';
import TagCloud from '../widgets/TagCloud';

export default function BlogLayoutCompact({ posts, loading, hasMore, sentinelRef }) {
  const navigate = useNavigate();
  if (posts.length === 0 && !loading) {
    return <div className="empty-state"><p>게시된 글이 없습니다.</p></div>;
  }
  return (
    <>
      <ul className="post-list">
        {posts.map((post) => (
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
