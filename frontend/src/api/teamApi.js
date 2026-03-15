import axios from 'axios';

export const teamApi = {
  addMember: (data) => axios.post('/api/team/member', data),
  getTeam: () => axios.get('/api/team'),
  updateMember: (memberId, data) => axios.put(`/api/team/member/${memberId}`, data),
  deleteMember: (memberId) => axios.delete(`/api/team/member/${memberId}`),
};

export default teamApi;