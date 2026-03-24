import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import PostList from './pages/PostList';

function App() {
  return (
    <Router>
      <Routes>
        {/* 기본 경로 접속 시 로그인 페이지로 리다이렉트 (추후 홈 화면으로 변경 가능) */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* 인증 페이지 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/posts" element={<PostList />} />

        {/* 404 처리 */}
        <Route path="*" element={<div className="p-10 text-center">404 - Not Found</div>} />
      </Routes>
    </Router>
  );
}

export default App;