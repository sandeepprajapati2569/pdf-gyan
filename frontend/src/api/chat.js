import client from './client';

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const EVENT_DELIMITER = /\r?\n\r?\n/;

function extractNextEvent(buffer) {
  const match = EVENT_DELIMITER.exec(buffer);
  if (!match) return null;

  const boundaryIndex = match.index;
  const separatorLength = match[0].length;

  return {
    event: buffer.slice(0, boundaryIndex),
    rest: buffer.slice(boundaryIndex + separatorLength),
  };
}

function parseEventData(eventBlock) {
  const lines = eventBlock.split(/\r?\n/);
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
      continue;
    }

    if (!line || line.startsWith(':') || /^(event|id|retry):/i.test(line)) {
      continue;
    }

    // The backend currently streams raw markdown chunks, which can contain
    // unprefixed newlines inside the SSE payload. Treat them as data so lists,
    // headings, and paragraph spacing stay intact while streaming.
    dataLines.push(line);
  }

  return dataLines.join('\n');
}

export const readChatStream = async (response, onData) => {
  if (!response.body) {
    throw new Error('Streaming response unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    while (true) {
      const parsed = extractNextEvent(buffer);
      if (!parsed) break;

      buffer = parsed.rest;
      const data = parseEventData(parsed.event);
      if (data) {
        onData(data);
      }
    }

    if (done) break;
  }

  const finalData = parseEventData(buffer);
  if (finalData) {
    onData(finalData);
  }
};

export const sendMessage = async (documentId, message, conversationId = null) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/api/chat/${documentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });
  return response;
};

export const sendMultiMessage = async (documentIds, message, conversationId = null) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/api/chat/multi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      document_ids: documentIds,
      message,
      conversation_id: conversationId,
    }),
  });
  return response;
};

export const getChatHistory = (documentId) =>
  client.get(`/api/chat/history/${documentId}`);

export const getMultiChatHistory = () =>
  client.get('/api/chat/multi/history');

export const getConversation = (conversationId) =>
  client.get(`/api/chat/conversation/${conversationId}`);
