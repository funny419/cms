// frontend/src/pages/admin/AdminComments.jsx
import { useCallback, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listAllComments, deleteComment } from '../../api/comments';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';

const STATUS_LABEL = { approved: '공개', pending: '승인 대기', spam: '스팸' };
const STATUS_COLOR = {
  approved: { background: 'var(--accent-bg)', color: 'var(--accent-text)' },
  pending:  { background: '#fef3c7', color: '#92400e' },
  spam:     { background: '#fee2e2', color: '#991b1b' },
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function AdminComments() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [deletedIds, setDeletedIds] = useState(new Set());

  const fetchFn = useCallback(
    (page) => {
      if (!token) { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user?.role !== 'admin') { navigate('/my-posts'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      } catch { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      return listAllComments(token, '', page);
    },
    [token]
  );
  const { items, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token]);
  const comments = items.filter((c) => !deletedIds.has(c.id));

  const handleDelete = async (commentId) => {
    if (!window.confirm('이 댓글을 삭제할까요? 답글도 함께 삭제됩니다.')) return;
    const res = await deleteComment(token, commentId);
    if (res.success) setDeletedIds((prev) => new Set([...prev, commentId]));
    else alert(res.error);
  };

  return (
    <div className="page-content" style={{ maxWidth: 960 }}>
      <h1 className="page-heading" style={{ marginBottom: 24 }}>댓글 관리</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {comments.length === 0 && !loading && !error ? (
        <div className="empty-state"><p>등록된 댓글이 없습니다.</p></div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
              {['포스트', '작성자', '내용', '상태', '작성일', ''].map((h) => (
                <th key={h} style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comments.map((comment) => (
              <tr key={comment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Link to={`/posts/${comment.post_id}`} style={{ color: 'var(--accent)' }}>
                    {comment.post_title || `#${comment.post_id}`}
                  </Link>
                  {comment.parent_id && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-light)' }}>(답글)</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {comment.author_name}
                  {comment.author_id === null && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-light)' }}>(게스트)</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {comment.content.slice(0, 60)}{comment.content.length > 60 ? '...' : ''}
                </td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                    ...(STATUS_COLOR[comment.status] || {}) }}>
                    {STATUS_LABEL[comment.status] || comment.status}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                  {formatDate(comment.created_at)}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button className="btn btn-danger" style={{ fontSize: 12, padding: '3px 10px' }}
                    onClick={() => handleDelete(comment.id)}>
                    삭제
                  </button>
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
      {!hasMore && comments.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 댓글이 없습니다.
        </div>
      )}
    </div>
  );
}
