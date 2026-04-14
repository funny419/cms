import axios from 'axios';
import { authHeader } from './client';

export const getSettings = async () => {
  try {
    const response = await axios.get('/api/settings');
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '설정을 불러오지 못했습니다.' };
  }
};

export const updateSettings = async (token, data) => {
  try {
    const response = await axios.put('/api/settings', data, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '설정 저장에 실패했습니다.' };
  }
};
