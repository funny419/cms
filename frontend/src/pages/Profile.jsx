import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, updateUser } from '../api/auth';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchUser = async () => {
      const result = await getCurrentUser(token);
      if (result.success) {
        setUser(result.data);
        setFormData({ ...formData, email: result.data.email });
      } else {
        // 토큰 만료 등의 이유로 실패 시 로그아웃 처리
        handleLogout();
      }
      setLoading(false);
    };

    fetchUser();
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const updateData = {};
    if (formData.email !== user.email) updateData.email = formData.email;
    if (formData.password) updateData.password = formData.password;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const result = await updateUser(token, updateData);
    if (result.success) {
      setMessage('Profile updated successfully.');
      // 비밀번호 변경 시 다시 로그인하도록 유도할 수도 있음
      if (updateData.password) {
        setFormData({ ...formData, password: '' });
      }
      // 사용자 정보 갱신
      if (updateData.email) {
        setUser({ ...user, email: updateData.email });
      }
    } else {
      setError(result.error || 'Failed to update profile');
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">My Profile</h2>
          <button 
            onClick={handleLogout}
            className="text-sm font-semibold text-red-500 hover:text-red-700"
          >
            Logout
          </button>
        </div>

        {message && (
          <div className="mb-4 rounded bg-green-100 p-3 text-sm text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm text-gray-600">Username: <span className="font-bold">{user?.username}</span></p>
          <p className="text-sm text-gray-600">Role: <span className="font-bold">{user?.role}</span></p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
              required
            />
          </div>
          <div className="mb-6">
            <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="password">
              New Password <span className="text-xs font-normal text-gray-500">(Leave blank to keep current)</span>
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
              placeholder="Enter new password"
            />
          </div>
          <div className="flex items-center justify-end">
            <button type="submit" className="focus:shadow-outline rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700 focus:outline-none">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}