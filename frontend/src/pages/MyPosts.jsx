import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPosts, deletePost } from '../api/posts';
import useInfiniteScroll from '../hooks/useInfiniteScroll';

const STATUS_BADGE = {
  published: { label: '발행됨', style: { background: 'var(--accent-bg)', color: 'var(--accent-text)' } },
  draft: { label: '임시저장', style: { background: 'var(--bg-subtle)', color: 'var(--text-light)' } },
  scheduled: { label: '예약됨', style: { background: '#fef3c7', color: '#92400e' } },
};

export default function MyPosts() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [deletedIds, setDeletedIds] = useState(new Set());

  const fetchFn = useCallback(
    (page) => {
      if (!token) { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      return getMyPosts(token, page);
    },
    [token]
  );
  const { items, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token]);
  const posts = items.filter((p) => !deletedIds.has(p.id));

  const handleDelete = async (id) => {
    const res = await deletePost(token, id);
    if (res.success) setDeletedIds((prev) => new Set([...prev, id]));
    else alert(res.error);
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>내 블로그</h1>
        <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>+ 새 글</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <p style={{ fontSize: 32, marginBottom: 12 }}>✍️</p>
          <p>아직 작성한 글이 없습니다.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/posts/new')}>
            첫 글 작성하기
          </button>
        </div>
      ) : (
        <ul className="post-list">
          {posts.map((post) => {
            const badge = STATUS_BADGE[post.status] || STATUS_BADGE.draft;
            const dateStr = post.created_at
              ? new Date(post.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
              : '';
            return (
              <li key={post.id} className="post-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    <div className="post-title">{post.title}</div>
                    <div className="post-meta" style={{ marginTop: 4 }}>{dateStr}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...badge.style }}>
                      {badge.label}
                    </span>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => navigate(`/posts/${post.id}/edit`)}
                    >
                      편집
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => handleDelete(post.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
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
