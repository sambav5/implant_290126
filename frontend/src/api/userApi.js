import axios from 'axios';

export const userApi = {
  getProfile: () => axios.get('/api/user/me'),
  updateProfile: (data) => axios.put('/api/user/profile', data),
  setupProfile: (data) => axios.post('/api/user/profile', data),
  skipTeamSetup: () => axios.post('/api/user/skip-team'),
};

export default userApi;