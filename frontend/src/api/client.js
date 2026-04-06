import axios from 'axios';
export const api = axios.create();
export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
