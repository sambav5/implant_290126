import axios from 'axios';

export const userApi = {
  setupProfile: (data) => 
    axios.post('/api/user/profile', data),
  
  skipTeamSetup: () => 
    axios.post('/api/user/skip-team'),
  
  getCurrentUser: () => 
    axios.get('/api/user/me'),
};