import client from './client';

export const uploadDocument = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return client.post('/api/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getDocuments = () => client.get('/api/documents');
export const getDocument = (id) => client.get(`/api/documents/${id}`);
export const deleteDocument = (id) => client.delete(`/api/documents/${id}`);
