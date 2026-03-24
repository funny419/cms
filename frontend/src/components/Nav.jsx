import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function Nav() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="nav">
      <Link to={token ? '/posts' : '/login'} className="nav-brand">
        ✦ CMS
      </Link>

      <div className="nav-links">
        {token ? (
          <>
            <Link to="/posts" className="nav-link">포스트</Link>
            <Link to="/profile" className="nav-link">프로필</Link>
            <button onClick={handleLogout} className="nav-link btn-danger" style={{ border: 'none', cursor: 'pointer', background: 'none' }}>
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">로그인</Link>
            <Link to="/register" className="nav-link">회원가입</Link>
          </>
        )}
        <button className="nav-theme-btn" onClick={toggleTheme} title="테마 전환">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  );
}
