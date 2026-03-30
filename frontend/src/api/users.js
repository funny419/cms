import axios from 'axios';

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const getUserProfile = async (username) => {
  try {
    const response = await axios.get(`/api/auth/users/${username}`);
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '프로필을 불러오지 못했습니다.' };
  }
};

export const getUserPosts = async (username, token, page = 1, perPage = 20) => {
  try {
    const headers = token ? authHeader(token) : {};
    const response = await axios.get('/api/posts', {
      headers,
      params: { page, per_page: perPage, author: username },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '포스트를 불러오지 못했습니다.' };
  }
};
