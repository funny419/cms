import axios from 'axios';

const BASE_URL = '/api/posts';
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// listPosts: token이 있으면 Authorization 헤더 포함 (user_liked 반영)
export const listPosts = async (token, page = 1, perPage = 20, q = '', categoryId = null) => {
  try {
    const headers = token ? authHeader(token) : {};
    const params = { page, per_page: perPage };
    if (q) params.q = q;
    if (categoryId) params.category_id = categoryId;
    const response = await axios.get(BASE_URL, { headers, params });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch posts.' };
  }
};

// getPost: token optional (user_liked 반영), skipCount=true 시 view_count 미증가 (편집 페이지용)
export const getPost = async (id, token, skipCount = false) => {
  try {
    const headers = token ? authHeader(token) : {};
    const params = skipCount ? { skip_count: 1 } : {};
    const response = await axios.get(`${BASE_URL}/${id}`, { headers, params });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch post.' };
  }
};

export const createPost = async (token, data) => {
  try {
    const response = await axios.post(BASE_URL, data, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to create post.' };
  }
};

export const updatePost = async (token, id, data) => {
  try {
    const response = await axios.put(`${BASE_URL}/${id}`, data, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to update post.' };
  }
};

export const deletePost = async (token, id) => {
  try {
    const response = await axios.delete(`${BASE_URL}/${id}`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to delete post.' };
  }
};

export const getMyPosts = async (token, page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`${BASE_URL}/mine`, {
      headers: authHeader(token),
      params: { page, per_page: perPage },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch my posts.' };
  }
};

// likePost: POST /api/posts/:id/like
export const likePost = async (token, id) => {
  try {
    const response = await axios.post(`${BASE_URL}/${id}/like`, {}, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to like post.' };
  }
};
