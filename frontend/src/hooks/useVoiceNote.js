import { useCallback, useRef, useState } from 'react'
import client from '../api/client'

const AUDIO_MIME = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : 'audio/webm'

function arrayBufferToBase64(buffer) {
  const uint8 = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function useVoiceNote({ onTranscribed } = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream, { mimeType: AUDIO_MIME })
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        const blob = new Blob(chunksRef.current, { type: AUDIO_MIME })
        const arrayBuffer = await blob.arrayBuffer()
        const base64 = arrayBufferToBase64(arrayBuffer)

        setIsRecording(false)
        setIsTranscribing(true)

        try {
          const res = await client.post('/api/chat/voice-note', { audio: base64, format: 'webm' })
          onTranscribed?.(res.data.text || '')
        } catch (e) {
          console.error('Transcription failed:', e)
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start(100)
      setIsRecording(true)
    } catch (e) {
      console.error('Mic access failed:', e)
    }
  }, [onTranscribed])

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, startRecording, stopRecording])

  return { isRecording, isTranscribing, toggleRecording }
}
