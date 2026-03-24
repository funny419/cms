// .gemini.md 규칙 준수: 응답 포맷 { "success": bool, "data": {}, "error": str }
import axios from 'axios';

const BASE_URL = '/api/auth';

/**
 * 로그인 요청
 */
export const loginUser = async (username, password) => {
  try {
    const response = await axios.post(`${BASE_URL}/login`, { username, password });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Network error occurred during login.' };
  }
};

/**
 * 회원가입 요청
 */
export const registerUser = async (username, email, password) => {
  try {
    const response = await axios.post(`${BASE_URL}/register`, { username, email, password });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Network error occurred during registration.' };
  }
};

/**
 * 현재 사용자 정보 조회 (Protected)
 */
export const getCurrentUser = async (token) => {
  try {
    const response = await axios.get(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch user info.' };
  }
};

/**
 * 사용자 정보 수정 (Protected)
 */
export const updateUser = async (token, data) => {
  try {
    const response = await axios.put(`${BASE_URL}/me`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to update profile.' };
  }
};