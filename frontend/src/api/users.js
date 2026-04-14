import axios from 'axios';
import { authHeader } from './client';

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

export const searchUsers = async (q) => {
  try {
    const response = await axios.get('/api/auth/users/search', { params: { q } });
    return response.data;
  } catch {
    return { success: false, error: '사용자 검색에 실패했습니다.' };
  }
};

export const followUser = async (token, username) => {
  try {
    const response = await axios.post(
      `/api/users/${username}/follow`,
      {},
      { headers: authHeader(token) }
    );
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '팔로우에 실패했습니다.' };
  }
};

export const unfollowUser = async (token, username) => {
  try {
    const response = await axios.delete(
      `/api/users/${username}/follow`,
      { headers: authHeader(token) }
    );
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '언팔로우에 실패했습니다.' };
  }
};

export const getFollowers = async (username, page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`/api/users/${username}/followers`, {
      params: { page, per_page: perPage },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '팔로워 목록을 불러오지 못했습니다.' };
  }
};

export const getFollowing = async (username, page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`/api/users/${username}/following`, {
      params: { page, per_page: perPage },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '팔로잉 목록을 불러오지 못했습니다.' };
  }
};

export const getFeed = async (token, page = 1, perPage = 20) => {
  try {
    const response = await axios.get('/api/feed', {
      headers: authHeader(token),
      params: { page, per_page: perPage },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '피드를 불러오지 못했습니다.' };
  }
};
