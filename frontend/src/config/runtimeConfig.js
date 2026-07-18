const runtimeConfig = typeof window !== 'undefined' ? window.__APP_CONFIG__ || {} : {};

function getRuntimeValue(name, fallback = '') {
  return runtimeConfig[name] || process.env[name] || fallback;
}

export const BACKEND_URL = getRuntimeValue('REACT_APP_BACKEND_URL').replace(/\/$/, '');

export const API_BASE_URL = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

export const POSTHOG_KEY = getRuntimeValue('REACT_APP_POSTHOG_KEY');
export const POSTHOG_HOST = getRuntimeValue('REACT_APP_POSTHOG_HOST', 'https://us.i.posthog.com');
export const DEMO_MODE = getRuntimeValue('REACT_APP_DEMO_MODE', 'false');
