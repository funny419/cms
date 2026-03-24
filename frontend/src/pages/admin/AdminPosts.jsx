import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminListPosts } from '../../api/admin';
import { deletePost } from '../../api/posts';

const STATUS_LABEL = { published: '발행됨', draft: '임시저장', scheduled: '예약됨' };
const STATUS_COLOR = {
  published: { background: 'var(--accent-bg)', color: 'var(--accent-text)' },
  draft:     { background: 'var(--bg-subtle)', color: 'var(--text-light)' },
  scheduled: { background: '#fef3c7', color: '#92400e' },
};

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user?.role !== 'admin') { navigate('/my-posts'); return; }
    } catch { navigate('/login'); return; }

    adminListPosts(token).then((res) => {
      if (res.success) setPosts(res.data);
      else setError(res.error);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('이 포스트를 삭제할까요?')) return;
    const res = await deletePost(token, id);
    if (res.success) setPosts((prev) => prev.filter((p) => p.id !== id));
    else alert(res.error);
  };

  if (loading) return <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>;

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <h1 className="page-heading" style={{ marginBottom: 24 }}>포스트 관리</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {posts.length === 0 ? (
        <div className="empty-state"><p>포스트가 없습니다.</p></div>
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
    </div>
  );
}
