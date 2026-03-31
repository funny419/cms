import axios from 'axios';

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const getMyStats = async (token, username, period = '7d') => {
  try {
    const res = await axios.get(`/api/blog/${username}/stats`, {
      headers: authHeader(token), params: { period },
    });
    return res.data;
  } catch (e) {
    return { success: false, error: e.response?.data?.error || '통계를 불러오지 못했습니다.' };
  }
};
