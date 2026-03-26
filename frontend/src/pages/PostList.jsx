import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPosts } from '../api/posts';
import useInfiniteScroll from '../hooks/useInfiniteScroll';

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
};
const isEditorOrAdmin = (user) =>
  user && (user.role === 'admin' || user.role === 'editor');

export default function PostList() {
  const navigate = useNavigate();
  const user = getUser();
  const token = localStorage.getItem('token');

  const fetchFn = useCallback(
    (page) => listPosts(token, page),
    [token]
  );
  const { items: posts, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token]);

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>포스트</h1>
        {isEditorOrAdmin(user) && (
          <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>
            + 새 글
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
          <p>게시된 포스트가 없습니다.</p>
        </div>
      ) : (
        <ul className="post-list">
          {posts.map((post) => (
            <li
              key={post.id}
              className="post-item"
              onClick={() => navigate(`/posts/${post.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="post-title">{post.title}</div>
              {post.excerpt && (
                <div className="post-excerpt">{post.excerpt}</div>
              )}
              <div className="post-meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{post.author_username || '알 수 없음'}</span>
                <span>·</span>
                {post.created_at && (
                  <span>
                    {new Date(post.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </span>
                )}
                <span>·</span>
                <span>👁 {post.view_count ?? 0}</span>
                <span>·</span>
                <span>💬 {post.comment_count ?? 0}</span>
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
    </div>
  );
}
