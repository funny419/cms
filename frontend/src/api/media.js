import axios from 'axios';
import { authHeader } from './client';

export const uploadMedia = async (token, file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post('/api/media', formData, {
      headers: authHeader(token),
      // Content-Type은 axios가 multipart/form-data로 자동 설정
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '이미지 업로드에 실패했습니다.' };
  }
};
