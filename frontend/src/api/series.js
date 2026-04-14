import axios from 'axios';
import { authHeader } from './client';

export const getUserSeries = async (username) => {
  try {
    const res = await axios.get(`/api/users/${username}/series`);
    return res.data;
  } catch (e) {
    return { success: false, error: e.response?.data?.error || '시리즈 목록을 불러오지 못했습니다.' };
  }
};

export const createSeries = async (token, data) => {
  try {
    const res = await axios.post('/api/series', data, { headers: authHeader(token) });
    return res.data;
  } catch (e) {
    return { success: false, error: e.response?.data?.error || '시리즈 생성에 실패했습니다.' };
  }
};

export const updateSeries = async (token, id, data) => {
  try {
    const res = await axios.put(`/api/series/${id}`, data, { headers: authHeader(token) });
    return res.data;
  } catch (e) {
    return { success: false, error: e.response?.data?.error || '시리즈 수정에 실패했습니다.' };
  }
};

export const deleteSeries = async (token, id) => {
  try {
    const res = await axios.delete(`/api/series/${id}`, { headers: authHeader(token) });
    return res.data;
  } catch (e) {
    return { success: false, error: e.response?.data?.error || '시리즈 삭제에 실패했습니다.' };
  }
};

export const getSeriesDetail = async (id) => {
  try {
    const res = await axios.get(`/api/series/${id}`);
    return res.data;
  } catch (e) {
    return { success: false, error: e.response?.data?.error || '시리즈를 불러오지 못했습니다.' };
  }
};
