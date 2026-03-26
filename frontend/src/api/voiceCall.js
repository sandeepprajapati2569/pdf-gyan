import client from './client';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const WS_BASE = API_BASE.replace(/^http/, 'ws');

/**
 * Create a WebSocket connection for voice calls.
 * @param {string} token - JWT auth token
 * @returns {WebSocket}
 */
export const createCallWebSocket = (token) => {
  return new WebSocket(`${WS_BASE}/api/voice-call/ws?token=${encodeURIComponent(token)}`);
};

/**
 * Create a WebSocket connection for embedded voice calls.
 * @param {string} embedToken - Embed token
 * @param {string} origin - Current origin
 * @returns {WebSocket}
 */
export const createEmbedCallWebSocket = (embedToken, origin = '') => {
  const params = new URLSearchParams({ embed_token: embedToken });
  if (origin) params.set('origin', origin);
  return new WebSocket(`${WS_BASE}/api/voice-call/embed/ws?${params}`);
};

/**
 * Get voice call history.
 */
export const getCallHistory = (documentId = null) => {
  const params = documentId ? `?document_id=${documentId}` : '';
  return client.get(`/api/voice-call/history${params}`);
};

/**
 * Get a specific call session.
 */
export const getCallSession = (sessionId) =>
  client.get(`/api/voice-call/session/${sessionId}`);

/**
 * Create an embed token.
 */
export const createEmbedToken = (data) =>
  client.post('/api/voice-call/embed/tokens', data);

/**
 * List embed tokens.
 */
export const listEmbedTokens = () =>
  client.get('/api/voice-call/embed/tokens');

/**
 * Revoke an embed token.
 */
export const revokeEmbedToken = (tokenId) =>
  client.delete(`/api/voice-call/embed/tokens/${tokenId}`);
