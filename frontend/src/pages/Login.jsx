import React, { useState } from 'react';
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
      // JWT 토큰 저장
      localStorage.setItem('token', result.data.access_token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
      // 대시보드 또는 홈으로 이동
      navigate('/');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">Sign In</h2>
        
        {error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="username">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
              required
            />
          </div>
          <div className="mb-6">
            <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <button type="submit" className="focus:shadow-outline rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700 focus:outline-none">
              Sign In
            </button>
            <Link to="/register" className="inline-block align-baseline text-sm font-bold text-blue-500 hover:text-blue-800">
              Create Account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}