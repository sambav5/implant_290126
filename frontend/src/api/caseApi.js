import axios from 'axios';

export const caseApi = {
  createCase: (data) => 
    axios.post('/api/cases', data),
  
  getMyCases: () => 
    axios.get('/api/cases/my'),
  
  getTeam: () => 
    axios.get('/api/team'),

  uploadCaseFile: (caseId, formData) =>
    axios.post(`/api/cases/${caseId}/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getCaseFiles: (caseId) =>
    axios.get(`/api/cases/${caseId}/files`),

  deleteCaseFile: (fileId) =>
    axios.delete(`/api/cases/files/${fileId}`),
};

export default caseApi;