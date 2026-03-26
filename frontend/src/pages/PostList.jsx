import { useCallback, useEffect, useState } from 'react';
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

  const [inputQ, setInputQ] = useState('');
  const [q, setQ] = useState('');

  // 300ms 디바운스
  useEffect(() => {
    const timer = setTimeout(() => setQ(inputQ.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputQ]);

  const fetchFn = useCallback(
    (page) => listPosts(token, page, 20, q),
    [token, q]
  );
  const { items: posts, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token, q]);

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>포스트</h1>
        {isEditorOrAdmin(user) && (
          <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>
            + 새 글
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          className="form-input"
          placeholder="제목으로 검색..."
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          style={{ width: '100%', maxWidth: 400 }}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
          <p>{q ? `"${q}"에 대한 검색 결과가 없습니다.` : '게시된 포스트가 없습니다.'}</p>
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
