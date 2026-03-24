import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Nav from './components/Nav';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import PostList from './pages/PostList';
import PostDetail from './pages/PostDetail';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Nav />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/posts" element={<PostList />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="*" element={
            <div className="empty-state" style={{ marginTop: 80 }}>
              404 — 페이지를 찾을 수 없습니다.
            </div>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
