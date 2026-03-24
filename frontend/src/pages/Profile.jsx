import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, updateUser } from '../api/auth';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    getCurrentUser(token).then((result) => {
      if (result.success) {
        setUser(result.data);
        setFormData({ email: result.data.email, password: '' });
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
      setLoading(false);
    });
  }, [token, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    const updateData = {};
    if (formData.email !== user.email) updateData.email = formData.email;
    if (formData.password) updateData.password = formData.password;
    if (Object.keys(updateData).length === 0) return;

    const result = await updateUser(token, updateData);
    if (result.success) {
      setMessage('프로필이 저장됐습니다.');
      if (updateData.email) setUser({ ...user, email: updateData.email });
      if (updateData.password) setFormData({ ...formData, password: '' });
    } else {
      setError(result.error || '저장에 실패했습니다.');
    }
  };

  if (loading) return (
    <div className="empty-state" style={{ marginTop: 80 }}>불러오는 중...</div>
  );

  return (
    <div className="page-center" style={{ alignItems: 'flex-start', paddingTop: 48 }}>
      <div className="card" style={{ maxWidth: 480 }}>
        <h1 className="card-title" style={{ textAlign: 'left', marginBottom: 16 }}>
          내 프로필
        </h1>

        {/* 사용자 정보 */}
        <div style={{ marginBottom: 24 }}>
          <div className="info-row">
            <span className="info-label">아이디</span>
            <span className="info-value">{user?.username}</span>
          </div>
          <div className="info-row">
            <span className="info-label">권한</span>
            <span className="badge">{user?.role}</span>
          </div>
          <div className="info-row">
            <span className="info-label">가입일</span>
            <span className="info-value text-muted">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
            </span>
          </div>
        </div>

        <hr className="divider" />

        {message && <div className="alert alert-success">{message}</div>}
        {error   && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">이메일</label>
            <input
              className="form-input"
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              새 비밀번호
              <span className="text-muted" style={{ marginLeft: 6 }}>
                (변경하지 않으면 비워두세요)
              </span>
            </label>
            <input
              className="form-input"
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="새 비밀번호 입력"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full">
            저장
          </button>
        </form>
      </div>
    </div>
  );
}
