import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Case API
export const caseApi = {
  getAll: () => axios.get(`${API}/cases`),
  getById: (id) => axios.get(`${API}/cases/${id}`),
  create: (data) => axios.post(`${API}/cases`, data),
  update: (id, data) => axios.put(`${API}/cases/${id}`, data),
  delete: (id) => axios.delete(`${API}/cases/${id}`),
  analyze: (id) => axios.post(`${API}/cases/${id}/analyze`),
  updateStatus: (id, status) => axios.put(`${API}/cases/${id}/status?status=${status}`),
};

// Checklist API
export const checklistApi = {
  update: (caseId, phase, items) => 
    axios.put(`${API}/cases/${caseId}/checklists`, { phase, items }),
  addItem: (caseId, phase, item) => 
    axios.post(`${API}/cases/${caseId}/checklists/${phase}/item`, item),
};

// Feedback API
export const feedbackApi = {
  update: (caseId, data) => axios.put(`${API}/cases/${caseId}/feedback`, data),
  getSuggestions: () => axios.get(`${API}/learning/suggestions`),
};

// Attachment API
export const attachmentApi = {
  add: (caseId, type, url) => 
    axios.post(`${API}/cases/${caseId}/attachments`, { type, url }),
  remove: (caseId, type, url) => 
    axios.delete(`${API}/cases/${caseId}/attachments?type=${type}&url=${encodeURIComponent(url)}`),
};

export default {
  case: caseApi,
  checklist: checklistApi,
  feedback: feedbackApi,
  attachment: attachmentApi,
};
