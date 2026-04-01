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
