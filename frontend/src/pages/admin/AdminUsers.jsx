import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminListUsers, adminChangeRole,
  adminDeactivateUser, adminDeleteUser, adminGetUserPosts,
} from '../../api/admin';
import { useAuth } from '../../hooks/useAuth';

const ROLE_STYLE = {
  admin:       { background: 'var(--accent-bg)',  color: 'var(--accent-text)' },
  editor:      { background: '#dbeafe',           color: '#1d4ed8' },
  deactivated: { background: 'var(--bg-subtle)',  color: 'var(--text-light)' },
};
const ROLE_LABEL = { admin: 'admin', editor: 'editor', deactivated: '비활성화' };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [userPosts, setUserPosts] = useState({});
  const [selectedUser, setSelectedUser] = useState(null); // 정보 모달용
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user?.role !== 'admin') { navigate('/my-posts'); return; }
    } catch { navigate('/login'); return; }

    adminListUsers(token).then((res) => {
      if (res.success) setUsers(res.data);
      else setError(res.error);
      setLoading(false);
    });
  }, []);

  const handleRoleChange = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'editor' : 'admin';
    const res = await adminChangeRole(token, userId, newRole);
    if (res.success) setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: res.data.role } : u));
    else alert(res.error);
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('이 회원을 비활성화할까요?')) return;
    const res = await adminDeactivateUser(token, userId);
    if (res.success) setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: 'deactivated' } : u));
    else alert(res.error);
  };

  const handleActivate = async (userId) => {
    const res = await adminChangeRole(token, userId, 'editor');
    if (res.success) setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: 'editor' } : u));
    else alert(res.error);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('이 회원을 삭제할까요? 해당 회원의 글은 유지됩니다.')) return;
    const res = await adminDeleteUser(token, userId);
    if (res.success) setUsers((prev) => prev.filter((u) => u.id !== userId));
    else alert(res.error);
  };

  const handleTogglePosts = async (userId) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    if (!userPosts[userId]) {
      const res = await adminGetUserPosts(token, userId);
      if (res.success) setUserPosts((prev) => ({ ...prev, [userId]: res.data }));
    }
  };

  if (loading) return <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>;

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <h1 className="page-heading" style={{ marginBottom: 24 }}>회원 관리</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {/* 사용자 정보 모달 */}
      {selectedUser && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelectedUser(null)}
        >
          <div
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 28, minWidth: 320, boxShadow: 'var(--shadow)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-h)', margin: 0 }}>사용자 정보</h2>
              <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-light)' }}>✕</button>
            </div>
            <div className="info-row"><span className="info-label">아이디</span><span className="info-value">{selectedUser.username}</span></div>
            <div className="info-row"><span className="info-label">이메일</span><span className="info-value">{selectedUser.email}</span></div>
            <div className="info-row">
              <span className="info-label">권한</span>
              <span className="badge" style={{ ...(ROLE_STYLE[selectedUser.role] || ROLE_STYLE.editor) }}>
                {ROLE_LABEL[selectedUser.role] || selectedUser.role}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">가입일</span>
              <span className="info-value">
                {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
              </span>
            </div>
          </div>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
            {['아이디', '이메일', '권한', '가입일', '액션'].map((h) => (
              <th key={h} style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const isDeactivated = user.role === 'deactivated';
            return (
              <React.Fragment key={user.id}>
                <tr style={{ borderBottom: expandedUser === user.id ? 'none' : '1px solid var(--border)' }}>
                  <td
                    style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 500, cursor: 'pointer' }}
                    onClick={() => setSelectedUser(user)}
                  >
                    {user.username}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-light)' }}>{user.email}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...(ROLE_STYLE[user.role] || ROLE_STYLE.editor) }}>
                      {ROLE_LABEL[user.role] || user.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-light)', fontSize: 13 }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : ''}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {!isDeactivated && (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                          disabled={isSelf}
                          onClick={() => !isSelf && handleRoleChange(user.id, user.role)}>
                          {user.role === 'admin' ? '→editor' : '→admin'}
                        </button>
                      )}
                      {isDeactivated ? (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: 'var(--success)' }}
                          disabled={isSelf}
                          onClick={() => !isSelf && handleActivate(user.id)}>
                          활성화
                        </button>
                      ) : (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                          disabled={isSelf}
                          onClick={() => !isSelf && handleDeactivate(user.id)}>
                          비활성화
                        </button>
                      )}
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => handleTogglePosts(user.id)}>
                        글 보기
                      </button>
                      <button className="btn btn-danger" style={{ fontSize: 11, padding: '3px 8px' }}
                        disabled={isSelf}
                        onClick={() => !isSelf && handleDelete(user.id)}>
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedUser === user.id && (
                  <tr>
                    <td colSpan={5} style={{ padding: '0 12px 12px', background: 'var(--bg-subtle)' }}>
                      {(userPosts[user.id] || []).length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-light)', padding: '8px 0' }}>작성한 글이 없습니다.</p>
                      ) : (
                        <ul style={{ listStyle: 'none', padding: '8px 0', margin: 0 }}>
                          {(userPosts[user.id] || []).map((post) => (
                            <li key={post.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                              <span style={{ color: 'var(--text-h)' }}>{post.title}</span>
                              <span style={{ color: 'var(--text-light)' }}>{post.status}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
