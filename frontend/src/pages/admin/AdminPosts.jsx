import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminListPosts } from '../../api/admin';
import { deletePost } from '../../api/posts';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import { useAuth } from '../../hooks/useAuth';

const STATUS_LABEL = { published: '발행됨', draft: '임시저장', scheduled: '예약됨' };
const STATUS_COLOR = {
  published: { background: 'var(--accent-bg)', color: 'var(--accent-text)' },
  draft:     { background: 'var(--bg-subtle)', color: 'var(--text-light)' },
  scheduled: { background: '#fef3c7', color: '#92400e' },
};

export default function AdminPosts() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [deletedIds, setDeletedIds] = useState(new Set());
  const [inputQ, setInputQ] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  // 300ms 디바운스
  useEffect(() => {
    const timer = setTimeout(() => setQ(inputQ.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputQ]);

  const fetchFn = useCallback(
    (page) => {
      if (!token) { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      if (user?.role !== 'admin') { navigate('/my-posts'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      return adminListPosts(token, page, 20, q, status);
    },
    [token, q, status, user?.role, navigate]
  );
  const { items, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token, q, status]);
  const posts = items.filter((p) => !deletedIds.has(p.id));

  const handleDelete = async (id) => {
    if (!window.confirm('이 포스트를 삭제할까요?')) return;
    const res = await deletePost(token, id);
    if (res.success) setDeletedIds((prev) => new Set([...prev, id]));
    else alert(res.error);
  };

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <h1 className="page-heading" style={{ marginBottom: 16 }}>포스트 관리</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          className="form-input"
          placeholder="제목으로 검색..."
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          style={{ flex: 1, maxWidth: 300 }}
        />
        <select
          className="form-input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ width: 120 }}
        >
          <option value="">전체</option>
          <option value="published">발행됨</option>
          <option value="draft">임시저장</option>
          <option value="scheduled">예약됨</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <p>{q || status ? '검색 결과가 없습니다.' : '포스트가 없습니다.'}</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              {['제목', '작성자 ID', '상태', '작성일', ''].map((h) => (
                <th key={h} style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td
                  style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 500, cursor: 'pointer' }}
                  onClick={() => navigate(`/posts/${post.id}`)}
                >
                  {post.title}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-light)' }}>
                  {post.author_id ?? '(삭제된 회원)'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...(STATUS_COLOR[post.status] || STATUS_COLOR.draft) }}>
                    {STATUS_LABEL[post.status] || post.status}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-light)', fontSize: 13 }}>
                  {post.created_at ? new Date(post.created_at).toLocaleDateString('ko-KR') : ''}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={() => navigate(`/posts/${post.id}/edit`)}>
                      수정
                    </button>
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={() => handleDelete(post.id)}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && (
        <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 포스트가 없습니다.
        </div>
      )}
    </div>
  );
}
