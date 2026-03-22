import client from './client';

export const getSettings = () => client.get('/api/settings/keys');
export const updateSettings = (data) => client.put('/api/settings/keys', data);
export const getUsage = () => client.get('/api/settings/usage');
export const testConnection = (url, dbName) =>
  client.post('/api/settings/test-connection', { url, db_name: dbName });

export const getApiKeys = () => client.get('/api/api-keys');
export const createApiKey = (name) => client.post('/api/api-keys', { name });
export const deleteApiKey = (id) => client.delete(`/api/api-keys/${id}`);
