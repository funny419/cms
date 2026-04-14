import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/auth';

export default function Register() {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    const result = await registerUser(formData.username, formData.email, formData.password);
    if (result.success) {
      setSuccess('가입이 완료됐습니다. 로그인 페이지로 이동합니다...');
      setTimeout(() => navigate('/login'), 1500);
    } else {
      setError(result.error || '회원가입에 실패했습니다.');
    }
  };

  return (
    <div className="page-center">
      <div className="card">
        <h1 className="card-title">회원가입</h1>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

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
              placeholder="사용할 아이디"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">이메일</label>
            <input
              className="form-input"
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@email.com"
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
              placeholder="8자 이상 권장"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full">
            가입하기
          </button>
        </form>

        <div className="form-footer" style={{ marginTop: 20 }}>
          <span className="text-muted">이미 계정이 있으신가요?</span>
          <Link to="/login" className="text-link">로그인</Link>
        </div>
      </div>
    </div>
  );
}
