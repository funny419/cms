import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SkinProvider, useSkin } from './context/SkinContext';
import { CategoryProvider } from './context/CategoryContext';
import Nav from './components/Nav';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import PostList from './pages/PostList';
import PostDetail from './pages/PostDetail';
import PostEditor from './pages/PostEditor';
import MyPosts from './pages/MyPosts';
import BlogHome from './pages/BlogHome';
import AdminPosts from './pages/admin/AdminPosts';
import AdminUsers from './pages/admin/AdminUsers';
import AdminComments from './pages/admin/AdminComments';
import AdminSettings from './pages/admin/AdminSettings';
import { getSettings } from './api/settings';

// SkinProvider 내부에서 설정 로드 (useSkin 사용 가능)
function AppContent() {
  const { setSkin } = useSkin();

  useEffect(() => {
    getSettings().then((res) => {
      if (res.success && res.data.site_skin) {
        setSkin(res.data.site_skin);
      }
    });
  }, []);

  return (
    <Router>
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
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
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SkinProvider>
        <CategoryProvider>
          <AppContent />
        </CategoryProvider>
      </SkinProvider>
    </ThemeProvider>
  );
}

export default App;
