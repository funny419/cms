// frontend/src/api/comments.js
import axios from 'axios';

const BASE_URL = '/api/comments';
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const listComments = async (postId) => {
  try {
    const response = await axios.get(`${BASE_URL}/post/${postId}`);
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '댓글을 불러오지 못했습니다.' };
  }
};

// data: { content, parent_id?, author_name?, author_email?, author_password? }
export const createComment = async (token, postId, data) => {
  try {
    const headers = token ? authHeader(token) : {};
    const response = await axios.post(BASE_URL, { post_id: postId, ...data }, { headers });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '댓글 작성에 실패했습니다.' };
  }
};

// data: { content, author_email?, author_password? }
export const updateComment = async (token, commentId, data) => {
  try {
    const headers = token ? authHeader(token) : {};
    const response = await axios.put(`${BASE_URL}/${commentId}`, data, { headers });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '댓글 수정에 실패했습니다.' };
  }
};

// data: { author_email?, author_password? } — 게스트 삭제 시 필요
export const deleteComment = async (token, commentId, data = {}) => {
  try {
    const headers = token ? authHeader(token) : {};
    const response = await axios.delete(`${BASE_URL}/${commentId}`, { headers, data });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '삭제에 실패했습니다.' };
  }
};

export const listAllComments = async (token, status = '', page = 1, perPage = 20) => {
  try {
    const params = { page, per_page: perPage };
    if (status) params.status = status;
    const response = await axios.get('/api/admin/comments', { headers: authHeader(token), params });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '댓글 목록을 불러오지 못했습니다.' };
  }
};
