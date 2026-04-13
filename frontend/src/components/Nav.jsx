import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

export default function Nav() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const close = () => setIsOpen(false);

  return (
    <nav className="nav" ref={navRef}>
      <Link
        to={token ? (user?.role === 'admin' ? '/admin/posts' : '/my-posts') : '/login'}
        className="nav-brand"
      >
        ✦ CMS
      </Link>

      <button
        className="nav-hamburger"
        onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
        aria-label="메뉴 열기/닫기"
        aria-expanded={isOpen}
      >
        ☰
      </button>

      <div className={`nav-links${isOpen ? ' nav-links-open' : ''}`}>
        {token ? (
          user?.role === 'admin' ? (
            <>
              <Link to="/admin/posts" className="nav-link" onClick={close}>포스트 관리</Link>
              <Link to="/admin/users" className="nav-link" onClick={close}>회원 관리</Link>
              <Link to="/admin/comments" className="nav-link" onClick={close}>댓글 관리</Link>
              <Link to="/admin/settings" className="nav-link" onClick={close}>사이트 설정</Link>
              <Link to="/search" className="nav-link" title="검색" onClick={close}>🔍</Link>
              <button onClick={handleLogout} className="nav-link" style={{ border: 'none', cursor: 'pointer', background: 'none', color: 'var(--danger)' }}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/feed" className="nav-link" onClick={close}>피드</Link>
              <Link to="/my-posts" className="nav-link" onClick={close}>내 글</Link>
              <Link to={`/blog/${user?.username}`} className="nav-link" onClick={close}>내 블로그</Link>
              <Link to="/my-blog/settings" className="nav-link" title="블로그 설정" onClick={close}>⚙️</Link>
              <Link to="/my-blog/statistics" className="nav-link" title="통계" onClick={close}>📊</Link>
              <Link to="/posts" className="nav-link" onClick={close}>전체 글</Link>
              <Link to="/profile" className="nav-link" onClick={close}>프로필</Link>
              <Link to="/search" className="nav-link" title="검색" onClick={close}>🔍</Link>
              <button onClick={handleLogout} className="nav-link" style={{ border: 'none', cursor: 'pointer', background: 'none', color: 'var(--danger)' }}>
                로그아웃
              </button>
            </>
          )
        ) : (
          <>
            <Link to="/login" className="nav-link" onClick={close}>로그인</Link>
            <Link to="/register" className="nav-link" onClick={close}>회원가입</Link>
            <Link to="/search" className="nav-link" title="검색" onClick={close}>🔍</Link>
          </>
        )}
        <button className="nav-theme-btn" onClick={toggleTheme} title="테마 전환">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  );
}
