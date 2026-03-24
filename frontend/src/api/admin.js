import axios from 'axios';

const BASE_URL = '/api/admin';
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const adminListPosts = async (token) => {
  try {
    const response = await axios.get(`${BASE_URL}/posts`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch posts.' };
  }
};

export const adminListUsers = async (token) => {
  try {
    const response = await axios.get(`${BASE_URL}/users`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch users.' };
  }
};

export const adminChangeRole = async (token, userId, role) => {
  try {
    const response = await axios.put(`${BASE_URL}/users/${userId}/role`, { role }, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to change role.' };
  }
};

export const adminDeactivateUser = async (token, userId) => {
  try {
    const response = await axios.put(`${BASE_URL}/users/${userId}/deactivate`, {}, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to deactivate user.' };
  }
};

export const adminDeleteUser = async (token, userId) => {
  try {
    const response = await axios.delete(`${BASE_URL}/users/${userId}`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to delete user.' };
  }
};

export const adminGetUserPosts = async (token, userId) => {
  try {
    const response = await axios.get(`${BASE_URL}/users/${userId}/posts`, { headers: authHeader(token) });
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch user posts.' };
  }
};
