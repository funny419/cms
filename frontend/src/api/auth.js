// .gemini.md 규칙 준수: 응답 포맷 { "success": bool, "data": {}, "error": str }
// backend/app.py의 url_prefix='/api/auth'와 매칭

const BASE_URL = '/api/auth';

/**
 * 로그인 요청
 */
export const loginUser = async (username, password) => {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'Network error occurred during login.' };
  }
};

/**
 * 회원가입 요청
 */
export const registerUser = async (username, email, password) => {
  try {
    const response = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'Network error occurred during registration.' };
  }
};

/**
 * 현재 사용자 정보 조회 (Protected)
 */
export const getCurrentUser = async (token) => {
  try {
    const response = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'Failed to fetch user info.' };
  }
};

/**
 * 사용자 정보 수정 (Protected)
 */
export const updateUser = async (token, data) => {
  try {
    const response = await fetch(`${BASE_URL}/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: 'Failed to update profile.' };
  }
};