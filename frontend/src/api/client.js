import axios from 'axios';

export const api = axios.create();
export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

let _toastFn = null;
export const setGlobalToast = (fn) => { _toastFn = fn; };

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 429) {
      _toastFn?.('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 'error');
    } else if (status === 413) {
      _toastFn?.('파일 크기가 너무 큽니다 (최대 10MB).', 'error');
    }
    return Promise.reject(error);
  }
);
