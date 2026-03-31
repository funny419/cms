import { useNavigate } from 'react-router-dom';
import CategorySidebar from '../widgets/CategorySidebar';
import TagCloud from '../widgets/TagCloud';

function PostList({ posts, loading, hasMore, sentinelRef }) {
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

export default function BlogLayoutDefault({
  posts, categories, categoryId, setCategoryId, loading, hasMore, sentinelRef,
}) {
  return (
    <div style={{ display: 'flex', gap: 32 }}>
      <aside style={{ width: 160, flexShrink: 0 }}>
        <CategorySidebar
          categories={categories}
          selectedId={categoryId}
          onSelect={setCategoryId}
        />
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {categoryId
            ? `${categories.find((c) => c.id === categoryId)?.name || '카테고리'} 글`
            : '최근 글'}
        </h2>
        <PostList posts={posts} loading={loading} hasMore={hasMore} sentinelRef={sentinelRef} />
      </div>
    </div>
  );
}
