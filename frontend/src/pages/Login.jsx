import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../api/auth';

export default function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await loginUser(formData.username, formData.password);
    if (result.success) {
      localStorage.setItem('token', result.data.access_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
      const role = result.data.user.role;
      navigate(role === 'admin' ? '/admin/posts' : '/my-posts');
    } else {
      setError(result.error || '로그인에 실패했습니다.');
    }
  };

  return (
    <div className="page-center">
      <div className="card">
        <h1 className="card-title">로그인</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">아이디</label>
            <input
              className="form-input"
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="아이디를 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">비밀번호</label>
            <input
              className="form-input"
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full">
            로그인
          </button>
        </form>

        <div className="form-footer" style={{ marginTop: 20 }}>
          <span className="text-muted">계정이 없으신가요?</span>
          <Link to="/register" className="text-link">회원가입</Link>
        </div>
      </div>
    </div>
  );
}