import axios from 'axios';

export const getCategories = async () => {
  try {
    const response = await axios.get('/api/categories');
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '카테고리를 불러오지 못했습니다.' };
  }
};
