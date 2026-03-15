import axios from 'axios';

export const clinicApi = {
  getClinic: () => axios.get('/api/clinic'),
  updateClinic: (data) => axios.put('/api/clinic', data),
};

export default clinicApi;