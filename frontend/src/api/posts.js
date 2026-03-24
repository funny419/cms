import axios from 'axios';

const BASE_URL = '/api/posts';
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const listPosts = async () => {
  try {
    const response = await axios.get(BASE_URL);
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch posts.' };
  }
};

export const getPost = async (id) => {
  try {
    const response = await axios.get(`${BASE_URL}/${id}`);
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
