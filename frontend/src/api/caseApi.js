import axios from 'axios';

export const caseApi = {
  createCase: (data) => 
    axios.post('/api/cases', data),
  
  getMyCases: () => 
    axios.get('/api/cases/my'),
  
  getTeam: () => 
    axios.get('/api/team'),
};

export default caseApi;