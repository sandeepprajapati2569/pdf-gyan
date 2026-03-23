import client from './client';

export const register = (data) => client.post('/api/auth/register', data);
export const sendSignupOtp = (data) => client.post('/api/auth/register/send-otp', data);
export const verifySignupOtp = (data) => client.post('/api/auth/register/verify-otp', data);
export const login = (data) => client.post('/api/auth/login', data);
export const getMe = () => client.get('/api/auth/me');
export const forgotPassword = (data) => client.post('/api/auth/forgot-password', data);
export const resetPassword = (data) => client.post('/api/auth/reset-password', data);
