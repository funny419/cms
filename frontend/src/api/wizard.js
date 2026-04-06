import axios from 'axios';

export const getWizardStatus = async () => {
  try {
    const response = await axios.get('/api/wizard/status');
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Failed to fetch wizard status.' };
  }
};

export const submitWizardSetup = async (data) => {
  try {
    const response = await axios.post('/api/wizard/setup', data);
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || 'Setup failed.' };
  }
};

export const testDbConnection = async (data) => {
  try {
    const response = await axios.post('/api/wizard/db-test', data);
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '연결 테스트 실패.' };
  }
};

export const saveEnvFile = async (data) => {
  try {
    const response = await axios.post('/api/wizard/env', data);
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '.env 파일 생성 실패.' };
  }
};

export const runMigration = async () => {
  try {
    const response = await axios.post('/api/wizard/migrate');
    return response.data;
  } catch (error) {
    return { success: false, error: error.response?.data?.error || '마이그레이션 실패.' };
  }
};
