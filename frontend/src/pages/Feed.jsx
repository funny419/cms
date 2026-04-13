import { useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getFeed } from '../api/users';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import TagCloud from '../components/widgets/TagCloud';
import { useAuth } from '../hooks/useAuth';

export default function Feed() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const fetchFn = useCallback(
    (page) => {
      if (!token) return Promise.resolve({ success: false, data: { items: [], has_more: false } });
      return getFeed(token, page, 20);
    },
    [token]
  );
  const { items: posts, loading, hasMore, error, sentinelRef } = useInfiniteScroll(
    fetchFn,
    [token]
  );

  if (!token) {
    return (
      <div className="page-content">
        <div className="empty-state" style={{ marginTop: 80 }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🏠</p>
          <p>로그인 후 이웃의 새 글을 모아볼 수 있습니다.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>
            로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ maxWidth: 720 }}>
      <h1 className="page-heading" style={{ marginBottom: 20 }}>🏠 이웃 피드</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, marginBottom: 12 }}>📭</p>
          <p>팔로우하는 사람이 없습니다. 이웃을 찾아보세요.</p>
          <Link to="/posts" className="btn btn-ghost" style={{ marginTop: 12, display: 'inline-block' }}>
            블로그 탐색하기
          </Link>
        </div>
      ) : (
        <ul className="post-list">
          {posts.map((post) => (
            <li
              key={post.id}
              className="post-item"
              onClick={() => navigate(`/posts/${post.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/posts/${post.id}`)}
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>
                <span
                  onClick={(e) => { e.stopPropagation(); navigate(`/blog/${post.author_username}`); }}
                  style={{ cursor: 'pointer', color: 'var(--accent)' }}
                >
                  {post.author_username}
                </span>
              </div>
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
      {loading && <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 새 글이 없습니다.
        </div>
      )}
    </div>
  );
}
