import client from './client';

export const register = (data) => client.post('/api/auth/register', data);
export const login = (data) => client.post('/api/auth/login', data);
export const getMe = () => client.get('/api/auth/me');
