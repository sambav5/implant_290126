import axios from 'axios';

export const teamApi = {
  addMember: (data) => 
    axios.post('/api/team/member', data),
  
  getMembers: () => 
    axios.get('/api/team/members'),
  
  removeMember: (memberId) => 
    axios.delete(`/api/team/member/${memberId}`),
};