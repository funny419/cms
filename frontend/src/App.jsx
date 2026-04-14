import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SkinProvider, useSkin } from './context/SkinContext';
import { CategoryProvider } from './context/CategoryContext';
import Nav from './components/Nav';
import OnboardingModal from './components/OnboardingModal';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import PostList from './pages/PostList';
import PostDetail from './pages/PostDetail';
import PostEditor from './pages/PostEditor';
import MyPosts from './pages/MyPosts';
import BlogHome from './pages/BlogHome';
import Search from './pages/Search';
import Feed from './pages/Feed';
import BlogSettings from './pages/BlogSettings';
import SeriesDetail from './pages/SeriesDetail';
import Statistics from './pages/Statistics';
import SetupWizard from './pages/SetupWizard';
import AdminPosts from './pages/admin/AdminPosts';
import AdminUsers from './pages/admin/AdminUsers';
import AdminComments from './pages/admin/AdminComments';
import AdminSettings from './pages/admin/AdminSettings';
import { getSettings } from './api/settings';
import { getWizardStatus } from './api/wizard';
import { setGlobalToast } from './api/client';
import { useFetch } from './hooks/useFetch';
import useToast from './hooks/useToast';
import Toast from './components/Toast';

// Router 내부에서 wizard status 체크 + 라우팅 처리
function AppContent() {
  const { setSkin } = useSkin();
  const navigate = useNavigate();
  const location = useLocation();
  // /wizard 경로에서는 처음부터 checked=true (무한 리다이렉트 방지)
  const [wizardChecked, setWizardChecked] = useState(() => location.pathname === '/wizard');
  const [wizardDbConnected, setWizardDbConnected] = useState(true);
  const { toast, showToast, dismissToast } = useToast();

  useEffect(() => {
    setGlobalToast(showToast);
    return () => setGlobalToast(null);
  }, [showToast]);

  useFetch(
    getSettings,
    (res) => { if (res.success && res.data.site_skin) setSkin(res.data.site_skin); },
    [setSkin]
  );

  useFetch(
    () => wizardChecked ? null : getWizardStatus(),
    (res) => {
      if (res.success && res.data) {
        setWizardDbConnected(res.data.db_connected);
        if (!res.data.completed) navigate('/wizard', { replace: true });
      }
      setWizardChecked(true);
    },
    []
  );

  // wizard 확인 전에는 아무것도 렌더링하지 않음 (/wizard 페이지는 제외)
  if (!wizardChecked && location.pathname !== '/wizard') return null;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
      <Nav />
      <OnboardingModal />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/wizard" element={<SetupWizard dbConnected={wizardDbConnected} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/posts" element={<PostList />} />
        <Route path="/my-posts" element={<MyPosts />} />
        <Route path="/admin/posts" element={<AdminPosts />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/comments" element={<AdminComments />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/blog/:username" element={<BlogHome />} />
        <Route path="/blog/:username/series/:slug" element={<SeriesDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/my-blog/settings" element={<BlogSettings />} />
        <Route path="/my-blog/statistics" element={<Statistics />} />
        {/* /posts/new 는 /posts/:id 보다 반드시 먼저 */}
        <Route path="/posts/new" element={<PostEditor />} />
        <Route path="/posts/:id/edit" element={<PostEditor />} />
        <Route path="/posts/:id" element={<PostDetail />} />
        <Route path="*" element={
          <div className="empty-state" style={{ marginTop: 80 }}>
            404 — 페이지를 찾을 수 없습니다.
          </div>
        } />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SkinProvider>
        <CategoryProvider>
          <Router>
            <AppContent />
          </Router>
        </CategoryProvider>
      </SkinProvider>
    </ThemeProvider>
  );
}

export default App;
