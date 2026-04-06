import axios from 'axios';

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const getTags = async () => {
  try {
    const response = await axios.get('/api/tags', { params: { per_page: 100 } });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '태그를 불러오지 못했습니다.' };
  }
};

export const createTag = async (token, name) => {
  try {
    const response = await axios.post('/api/tags', { name }, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '태그 생성에 실패했습니다.' };
  }
};
