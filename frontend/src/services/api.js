import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

// Axios interceptor for JWT authentication
axios.interceptors.request.use(
  (config) => {
    const sessionData = localStorage.getItem('clinician_auth_session');
    if (sessionData) {
      try {
        const { token } = JSON.parse(sessionData);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Failed to parse auth session:', error);
        localStorage.removeItem('clinician_auth_session');
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('clinician_auth_session');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  requestWhatsappOtp: (phoneNumber) => 
    axios.post(`${API}/auth/whatsapp/request-otp`, { phoneNumber }),
  verifyWhatsappOtp: (phoneNumber, otp) => 
    axios.post(`${API}/auth/whatsapp/verify-otp`, { phoneNumber, otp }),
};

// Case API
export const caseApi = {
  getAll: () => axios.get(`${API}/cases`),
  getMy: () => axios.get(`${API}/cases`),
  getById: (id) => axios.get(`${API}/cases/${id}`),
  create: (data) => axios.post(`${API}/cases`, data),
  update: (id, data) => axios.put(`${API}/cases/${id}`, data),
  delete: (id) => axios.delete(`${API}/cases/${id}`),
  analyze: (id) => axios.post(`${API}/cases/${id}/analyze`),
  updateStatus: (id, status) => axios.put(`${API}/cases/${id}/status?status=${status}`),
  updateStageAssignments: (id, data) => axios.put(`${API}/cases/${id}/stage-assignments`, data),
};


export const caseFilesApi = {
  upload: (caseId, formData) => axios.post(`${API}/cases/${caseId}/files`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }),
  getByCase: (caseId) => axios.get(`${API}/cases/${caseId}/files`),
  delete: (fileId) => axios.delete(`${API}/cases/files/${fileId}`),
};


export const discussionApi = {
  getMessages: (caseId, params = {}) => axios.get(`${API}/cases/${caseId}/messages`, { params }),
  sendMessage: (caseId, payload) => axios.post(`${API}/cases/${caseId}/messages`, payload),
  addReaction: (messageId, reactionType) => axios.post(`${API}/messages/${messageId}/reaction`, { reaction_type: reactionType }),
  deleteMessage: (messageId) => axios.delete(`${API}/messages/${messageId}`),
  getEvents: (caseId, since = '') => axios.get(`${API}/cases/${caseId}/discussion-events`, { params: { since } }),
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
  auth: authApi,
  case: caseApi,
  checklist: checklistApi,
  feedback: feedbackApi,
  attachment: attachmentApi,
  caseFiles: caseFilesApi,
  discussion: discussionApi,
};
