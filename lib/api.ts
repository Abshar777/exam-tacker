import axios from 'axios';

const api = axios.create({
  baseURL: 'https://exam-api.deltadigitalacademy.com/api',
});

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  // adminToken takes priority; fall back to student token
  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
