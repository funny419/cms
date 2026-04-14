import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminListUsers, adminChangeRole,
  adminDeactivateUser, adminDeleteUser, adminGetUserPosts,
} from '../../api/admin';
import { useAuth } from '../../hooks/useAuth';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast from '../../components/Toast';
import useToast from '../../hooks/useToast';

const ROLE_STYLE = {
  admin:       { background: 'var(--accent-bg)',  color: 'var(--accent-text)' },
  editor:      { background: 'var(--info-bg)',     color: 'var(--info-text)' },
  deactivated: { background: 'var(--bg-subtle)',  color: 'var(--text-light)' },
};
const ROLE_LABEL = { admin: 'admin', editor: 'editor', deactivated: '비활성화' };

export default function AdminUsers() {
  const [deletedIds, setDeletedIds] = useState(new Set());
  const [overrides, setOverrides] = useState({});
  const [confirm, setConfirm] = useState(null); // { message, onConfirm }
  const { toast, showToast, dismissToast } = useToast();
  const [expandedUser, setExpandedUser] = useState(null);
  const [userPosts, setUserPosts] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const currentUserId = user?.id ?? null;

  const fetchFn = useCallback(
    (page) => {
      if (!token) { navigate('/login'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      if (user?.role !== 'admin') { navigate('/my-posts'); return Promise.resolve({ success: false, data: { items: [], has_more: false } }); }
      return adminListUsers(token, page, 20);
    },
    [token, user?.role, navigate]
  );

  const { items, loading, hasMore, error, sentinelRef } = useInfiniteScroll(fetchFn, [token]);

  const users = items
    .filter((u) => !deletedIds.has(u.id))
    .map((u) => ({ ...u, ...(overrides[u.id] || {}) }));

  const handleRoleChange = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'editor' : 'admin';
    const res = await adminChangeRole(token, userId, newRole);
    if (res.success) {
      setOverrides((prev) => ({ ...prev, [userId]: { role: res.data.role } }));
      showToast(`권한이 ${res.data.role}로 변경되었습니다.`);
    } else {
      showToast(res.error, 'error');
    }
  };

  const handleDeactivate = (userId) => {
    setConfirm({
      message: '이 회원을 비활성화할까요?',
      onConfirm: async () => {
        const res = await adminDeactivateUser(token, userId);
        if (res.success) {
          setOverrides((prev) => ({ ...prev, [userId]: { role: 'deactivated' } }));
          showToast('회원이 비활성화되었습니다.');
        } else {
          showToast(res.error, 'error');
        }
      },
    });
  };

  const handleActivate = async (userId) => {
    const res = await adminChangeRole(token, userId, 'editor');
    if (res.success) {
      setOverrides((prev) => ({ ...prev, [userId]: { role: 'editor' } }));
      showToast('회원이 활성화되었습니다.');
    } else {
      showToast(res.error, 'error');
    }
  };

  const handleDelete = (userId) => {
    setConfirm({
      message: '이 회원을 삭제할까요? 해당 회원의 글은 유지됩니다.',
      onConfirm: async () => {
        const res = await adminDeleteUser(token, userId);
        if (res.success) {
          setDeletedIds((prev) => new Set([...prev, userId]));
          showToast('회원이 삭제되었습니다.');
        } else {
          showToast(res.error, 'error');
        }
      },
    });
  };

  const handleTogglePosts = async (userId) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    if (!userPosts[userId]) {
      const res = await adminGetUserPosts(token, userId);
      if (res.success) setUserPosts((prev) => ({ ...prev, [userId]: res.data }));
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
      <ConfirmDialog
        isOpen={!!confirm}
        message={confirm?.message ?? ''}
        onConfirm={() => { const cb = confirm?.onConfirm; setConfirm(null); cb?.(); }}
        onCancel={() => setConfirm(null)}
      />
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
              <button aria-label="닫기" onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-light)' }}>✕</button>
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

      <div className="table-wrapper">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
            {['아이디', '이메일', '권한', '가입일', '액션'].map((h) => (
              <th key={h} style={{ padding: '10px 12px', color: 'var(--text-light)', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const isDeactivated = u.role === 'deactivated';
            return (
              <React.Fragment key={u.id}>
                <tr style={{ borderBottom: expandedUser === u.id ? 'none' : '1px solid var(--border)' }}>
                  <td
                    style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 500, cursor: 'pointer' }}
                    onClick={() => setSelectedUser(u)}
                  >
                    {u.username}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-light)' }}>{u.email}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, ...(ROLE_STYLE[u.role] || ROLE_STYLE.editor) }}>
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-light)', fontSize: 13 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : ''}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {!isDeactivated && (
                        <button className="btn btn-ghost btn-sm"
                          disabled={isSelf}
                          onClick={() => !isSelf && handleRoleChange(u.id, u.role)}>
                          {u.role === 'admin' ? '→editor' : '→admin'}
                        </button>
                      )}
                      {isDeactivated ? (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }}
                          disabled={isSelf}
                          onClick={() => !isSelf && handleActivate(u.id)}>
                          활성화
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm"
                          disabled={isSelf}
                          onClick={() => !isSelf && handleDeactivate(u.id)}>
                          비활성화
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => handleTogglePosts(u.id)}>
                        글 보기
                      </button>
                      <button className="btn btn-danger btn-sm"
                        disabled={isSelf}
                        onClick={() => !isSelf && handleDelete(u.id)}>
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedUser === u.id && (
                  <tr>
                    <td colSpan={5} style={{ padding: '0 12px 12px', background: 'var(--bg-subtle)' }}>
                      {(userPosts[u.id] || []).length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-light)', padding: '8px 0' }}>작성한 글이 없습니다.</p>
                      ) : (
                        <ul style={{ listStyle: 'none', padding: '8px 0', margin: 0 }}>
                          {(userPosts[u.id] || []).map((post) => (
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

      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && <div className="empty-state" style={{ marginTop: 24 }}>불러오는 중...</div>}
      {!hasMore && users.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 13, padding: '24px 0' }}>
          더 이상 회원이 없습니다.
        </div>
      )}
    </div>
  );
}
