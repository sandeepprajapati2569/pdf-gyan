const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export const createSpeechAudio = async (text, signal) => {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/api/chat/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
    signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || 'Failed to generate speech audio')
  }

  return response.blob()
}
