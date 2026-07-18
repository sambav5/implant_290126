const runtimeConfig = typeof window !== 'undefined' ? window.__APP_CONFIG__ || {} : {};

export const BACKEND_URL = (
  runtimeConfig.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  ''
).replace(/\/$/, '');

export const API_BASE_URL = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';
