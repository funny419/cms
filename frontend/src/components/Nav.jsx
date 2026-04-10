import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

export default function Nav() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="nav">
      <Link
        to={token ? (user?.role === 'admin' ? '/admin/posts' : '/my-posts') : '/login'}
        className="nav-brand"
      >
        ✦ CMS
      </Link>

      <div className="nav-links">
        {token ? (
          user?.role === 'admin' ? (
            <>
              <Link to="/admin/posts" className="nav-link">포스트 관리</Link>
              <Link to="/admin/users" className="nav-link">회원 관리</Link>
              <Link to="/admin/comments" className="nav-link">댓글 관리</Link>
              <Link to="/admin/settings" className="nav-link">사이트 설정</Link>
              <Link to="/search" className="nav-link" title="검색">🔍</Link>
              <button onClick={handleLogout} className="nav-link" style={{ border: 'none', cursor: 'pointer', background: 'none', color: 'var(--danger)' }}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/feed" className="nav-link">피드</Link>
              <Link to="/my-posts" className="nav-link">내 글</Link>
              <Link to={`/blog/${user?.username}`} className="nav-link">내 블로그</Link>
              <Link to="/my-blog/settings" className="nav-link" title="블로그 설정">⚙️</Link>
              <Link to="/my-blog/statistics" className="nav-link" title="통계">📊</Link>
              <Link to="/posts" className="nav-link">전체 글</Link>
              <Link to="/profile" className="nav-link">프로필</Link>
              <Link to="/search" className="nav-link" title="검색">🔍</Link>
              <button onClick={handleLogout} className="nav-link" style={{ border: 'none', cursor: 'pointer', background: 'none', color: 'var(--danger)' }}>
                로그아웃
              </button>
            </>
          )
        ) : (
          <>
            <Link to="/login" className="nav-link">로그인</Link>
            <Link to="/register" className="nav-link">회원가입</Link>
            <Link to="/search" className="nav-link" title="검색">🔍</Link>
          </>
        )}
        <button className="nav-theme-btn" onClick={toggleTheme} title="테마 전환">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  );
}
