// Vite의 프록시 설정이 되어있다고 가정하고 상대 경로 사용
// 설정이 없다면 'http://localhost:5000/api/auth' 로 변경 필요
const API_BASE_URL = '/api/auth';

/**
 * 로그인 요청
 * @param {string} username 
 * @param {string} password 
 */
export const loginUser = async (username, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Network error occurred' };
  }
};

/**
 * 회원가입 요청
 * @param {string} username 
 * @param {string} email 
 * @param {string} password 
 */
export const registerUser = async (username, email, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, error: 'Network error occurred' };
  }
};

/**
 * 현재 사용자 정보 조회
 * @param {string} token 
 */
export const getCurrentUser = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Get user error:', error);
    return { success: false, error: 'Network error occurred' };
  }
};

/**
 * 사용자 정보 수정
 * @param {string} token 
 * @param {Object} updateData { email, password }
 */
export const updateUser = async (token, updateData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, error: 'Network error occurred' };
  }
};