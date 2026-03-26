import { useCallback, useEffect, useRef, useState } from 'react'
import { createCallWebSocket } from '../api/voiceCall'

/**
 * Voice Call hook — manages the full WebSocket lifecycle, mic recording
 * with VAD (Voice Activity Detection), audio playback, and state for
 * the Call with Document feature.
 *
 * Supports two modes:
 *  - Push-to-talk: user manually taps mic to record
 *  - Hands-free (VAD): auto-detects speech start/end like a real phone call
 */

// Audio recording config
const AUDIO_MIME = (() => {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  return MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'
})()

// VAD config
const VAD_SILENCE_THRESHOLD = 0.012
const VAD_SPEECH_THRESHOLD = 0.02
const VAD_SILENCE_DURATION_MS = 1500
const VAD_MIN_SPEECH_DURATION_MS = 500
const VAD_CHECK_INTERVAL_MS = 60

// Safe base64 encode for large buffers
function arrayBufferToBase64(buffer) {
  const uint8 = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function useVoiceCall() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [callStatus, setCallStatus] = useState('idle') // idle | connecting | active | ended | error
  const [sessionId, setSessionId] = useState(null)
  const [documentName, setDocumentName] = useState('')

  // Audio state
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState('')
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  // VAD state
  const [vadEnabled, setVadEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Conversation state
  const [messages, setMessages] = useState([])
  const [latency, setLatency] = useState({ stt_ms: 0, llm_ms: 0, tts_ms: 0, total_ms: 0 })
  const [callDuration, setCallDuration] = useState(0)

  // Refs
  const wsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const vadIntervalRef = useRef(null)
  const speechStartRef = useRef(null)
  const silenceStartRef = useRef(null)
  const callTimerRef = useRef(null)
  const callStartRef = useRef(null)
  const vadActiveRef = useRef(false)
  const isProcessingRef = useRef(false)
  const isPlayingRef = useRef(false)
  const vadSpeakingRef = useRef(false)

  // Keep refs in sync
  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])
  useEffect(() => { isPlayingRef.current = isPlayingAudio }, [isPlayingAudio])

  // ─── Call Duration Timer ─────────────────────────
  const startCallTimer = useCallback(() => {
    callStartRef.current = Date.now()
    callTimerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000))
    }, 1000)
  }, [])

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
  }, [])

  // ─── Audio Cleanup ───────────────────────────────
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setIsPlayingAudio(false)
  }, [])

  // ─── Play Audio from Base64 ──────────────────────
  const playAudio = useCallback((base64Audio) => {
    return new Promise((resolve, reject) => {
      try {
        cleanupAudio()
        const binaryStr = atob(base64Audio)
        const len = binaryStr.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i)
        const blob = new Blob([bytes], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        audioUrlRef.current = url
        setIsPlayingAudio(true)
        audio.onended = () => { setIsPlayingAudio(false); cleanupAudio(); resolve() }
        audio.onerror = (e) => { setIsPlayingAudio(false); cleanupAudio(); reject(e) }
        audio.play().catch((err) => { setIsPlayingAudio(false); cleanupAudio(); reject(err) })
      } catch (e) { reject(e) }
    })
  }, [cleanupAudio])

  // ─── Get RMS Audio Level ─────────────────────────
  const getAudioLevel = useCallback(() => {
    if (!analyserRef.current) return 0
    const data = new Uint8Array(analyserRef.current.fftSize)
    analyserRef.current.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    return Math.sqrt(sum / data.length)
  }, [])

  // ─── Send currently recorded audio to server ─────
  const flushAudioToServer = useCallback(async () => {
    const chunks = audioChunksRef.current
    audioChunksRef.current = []
    if (chunks.length === 0) return

    const blob = new Blob(chunks, { type: AUDIO_MIME })
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = arrayBufferToBase64(arrayBuffer)

    if (base64 && wsRef.current?.readyState === WebSocket.OPEN) {
      setIsProcessing(true)
      setProcessingStage('stt')
      wsRef.current.send(JSON.stringify({
        type: 'audio_chunk',
        audio: base64,
        format: 'webm',
      }))
    }
  }, [])

  // ─── VAD: Start Mic for Listening ────────────────
  const startVADListening = useCallback(async () => {
    if (vadActiveRef.current) return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      })

      streamRef.current = stream
      vadActiveRef.current = true

      // Audio analysis for VAD
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.3
      source.connect(analyser)
      analyserRef.current = analyser

      // VAD polling - uses a fresh MediaRecorder per utterance
      speechStartRef.current = null
      silenceStartRef.current = null
      vadSpeakingRef.current = false

      const createRecorder = () => {
        audioChunksRef.current = []
        const rec = new MediaRecorder(stream, { mimeType: AUDIO_MIME })
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        mediaRecorderRef.current = rec
        return rec
      }

      // Create initial recorder (but don't start it)
      createRecorder()

      vadIntervalRef.current = setInterval(() => {
        if (isProcessingRef.current || isPlayingRef.current) {
          setAudioLevel(0)
          // If we were speaking, stop the recorder cleanly
          if (vadSpeakingRef.current) {
            vadSpeakingRef.current = false
            speechStartRef.current = null
            silenceStartRef.current = null
            setIsSpeaking(false)
            setIsRecording(false)
            if (mediaRecorderRef.current?.state === 'recording') {
              mediaRecorderRef.current.stop()
            }
            audioChunksRef.current = []
            createRecorder()
          }
          return
        }

        const level = getAudioLevel()
        setAudioLevel(level)
        const now = Date.now()

        if (!vadSpeakingRef.current) {
          // Waiting for speech
          if (level > VAD_SPEECH_THRESHOLD) {
            speechStartRef.current = now
            silenceStartRef.current = null
            vadSpeakingRef.current = true
            setIsSpeaking(true)

            // Start recording with a fresh recorder
            const rec = mediaRecorderRef.current
            if (rec && rec.state === 'inactive') {
              audioChunksRef.current = []
              rec.start(100)
              setIsRecording(true)
            }
          }
        } else {
          // Currently speaking — check for silence
          if (level < VAD_SILENCE_THRESHOLD) {
            if (!silenceStartRef.current) {
              silenceStartRef.current = now
            } else if (now - silenceStartRef.current > VAD_SILENCE_DURATION_MS) {
              const speechDuration = now - (speechStartRef.current || now)

              // Stop the current recorder
              const rec = mediaRecorderRef.current
              if (rec && rec.state === 'recording') {
                // Set up onstop to flush audio, then create a new recorder
                rec.onstop = async () => {
                  if (speechDuration > VAD_MIN_SPEECH_DURATION_MS) {
                    await flushAudioToServer()
                  } else {
                    audioChunksRef.current = []
                  }
                  // Create a fresh recorder for the next utterance
                  if (vadActiveRef.current && streamRef.current?.active) {
                    createRecorder()
                  }
                }
                rec.stop()
              }

              vadSpeakingRef.current = false
              speechStartRef.current = null
              silenceStartRef.current = null
              setIsSpeaking(false)
              setIsRecording(false)
            }
          } else {
            silenceStartRef.current = null
          }
        }
      }, VAD_CHECK_INTERVAL_MS)
    } catch (e) {
      console.error('VAD mic access failed:', e)
      vadActiveRef.current = false
    }
  }, [getAudioLevel, flushAudioToServer])

  // ─── Stop VAD ────────────────────────────────────
  const stopVADListening = useCallback(() => {
    vadActiveRef.current = false
    vadSpeakingRef.current = false

    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current)
      vadIntervalRef.current = null
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    mediaRecorderRef.current = null

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    analyserRef.current = null
    setAudioLevel(0)
    setIsRecording(false)
    setIsSpeaking(false)
  }, [])

  // ─── Auto-restart VAD after AI finishes ──────────
  useEffect(() => {
    if (vadEnabled && callStatus === 'active' && !isProcessing && !isPlayingAudio && !vadActiveRef.current) {
      const timer = setTimeout(() => startVADListening(), 400)
      return () => clearTimeout(timer)
    }
  }, [vadEnabled, callStatus, isProcessing, isPlayingAudio, startVADListening])

  // Stop VAD while processing/playing
  useEffect(() => {
    if ((isProcessing || isPlayingAudio) && vadActiveRef.current) {
      stopVADListening()
    }
  }, [isProcessing, isPlayingAudio, stopVADListening])

  // ─── Handle WS Messages ──────────────────────────
  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'call_started':
          setCallStatus('active')
          setSessionId(msg.session_id)
          setDocumentName(msg.document_name || '')
          setMessages(prev => [...prev, { role: 'assistant', text: msg.intro_text, isIntro: true, timestamp: Date.now() }])
          startCallTimer()
          if (msg.intro_audio) playAudio(msg.intro_audio).catch(() => {})
          break
        case 'processing':
          setIsProcessing(true)
          setProcessingStage(msg.stage || 'thinking')
          break
        case 'transcript':
          setMessages(prev => [...prev, { role: 'user', text: msg.text, timestamp: Date.now() }])
          break
        case 'response':
          setIsProcessing(false)
          setProcessingStage('')
          setMessages(prev => [...prev, { role: 'assistant', text: msg.text, timestamp: Date.now() }])
          if (msg.audio) playAudio(msg.audio).catch(() => {})
          break
        case 'response_text':
          setIsProcessing(false)
          setProcessingStage('')
          setMessages(prev => [...prev, { role: 'assistant', text: msg.text, timestamp: Date.now() }])
          break
        case 'latency':
          setLatency({ stt_ms: msg.stt_ms || 0, llm_ms: msg.llm_ms || 0, tts_ms: msg.tts_ms || 0, total_ms: msg.total_ms || 0 })
          break
        case 'error':
          console.error('Voice call error:', msg.message)
          setIsProcessing(false)
          setProcessingStage('')
          setMessages(prev => [...prev, { role: 'system', text: msg.message || 'An error occurred', timestamp: Date.now() }])
          break
        case 'call_ended':
          setCallStatus('ended')
          setIsProcessing(false)
          stopCallTimer()
          cleanupAudio()
          stopVADListening()
          break
        default:
          break
      }
    } catch (e) { console.error('Failed to parse WS message:', e) }
  }, [playAudio, cleanupAudio, startCallTimer, stopCallTimer, stopVADListening])

  // ─── Connect ─────────────────────────────────────
  const connect = useCallback((documentId, introMessage = '') => {
    const token = localStorage.getItem('token')
    if (!token) return
    setCallStatus('connecting')
    setMessages([])
    setCallDuration(0)

    const ws = createCallWebSocket(token)
    wsRef.current = ws
    ws.onopen = () => {
      setIsConnected(true)
      ws.send(JSON.stringify({ type: 'start_call', document_id: documentId, intro_message: introMessage }))
    }
    ws.onmessage = handleMessage
    ws.onclose = () => {
      setIsConnected(false)
      setCallStatus(prev => prev === 'ended' ? prev : 'ended')
      stopCallTimer()
      stopVADListening()
    }
    ws.onerror = () => {
      setCallStatus('error')
      setIsConnected(false)
      stopCallTimer()
      stopVADListening()
    }
  }, [handleMessage, stopCallTimer, stopVADListening])

  // ─── Disconnect ──────────────────────────────────
  const disconnect = useCallback(() => {
    stopVADListening()
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop() } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_call' }))
      wsRef.current.close()
    }
    setIsRecording(false)
    setCallStatus('ended')
    stopCallTimer()
    cleanupAudio()
  }, [cleanupAudio, stopCallTimer, stopVADListening])

  // ─── Push-to-Talk ────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    if (isPlayingAudio) cleanupAudio()
    stopVADListening()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000 },
      })
      streamRef.current = stream
      audioChunksRef.current = []

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser

      vadIntervalRef.current = setInterval(() => setAudioLevel(getAudioLevel()), 50)

      const recorder = new MediaRecorder(stream, { mimeType: AUDIO_MIME })
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null }
        if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null }
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        analyserRef.current = null
        setAudioLevel(0)
        await flushAudioToServer()
        setIsRecording(false)
      }
      recorder.start(100)
      setIsRecording(true)
      setIsSpeaking(true)
    } catch (e) {
      console.error('Mic access failed:', e)
      setIsRecording(false)
    }
  }, [isPlayingAudio, cleanupAudio, stopVADListening, getAudioLevel, flushAudioToServer])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    setIsSpeaking(false)
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, startRecording, stopRecording])

  const toggleVAD = useCallback(() => {
    if (vadEnabled) { stopVADListening(); setVadEnabled(false) }
    else setVadEnabled(true)
  }, [vadEnabled, stopVADListening])

  const sendTextMessage = useCallback((text) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !text.trim()) return
    setMessages(prev => [...prev, { role: 'user', text, timestamp: Date.now() }])
    setIsProcessing(true)
    setProcessingStage('thinking')
    wsRef.current.send(JSON.stringify({ type: 'text_input', text: text.trim() }))
  }, [])

  const interruptPlayback = useCallback(() => {
    if (isPlayingAudio) cleanupAudio()
  }, [isPlayingAudio, cleanupAudio])

  // ─── Cleanup on Unmount ──────────────────────────
  useEffect(() => {
    return () => {
      stopVADListening()
      stopCallTimer()
      if (wsRef.current) wsRef.current.close()
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      cleanupAudio()
    }
  }, [cleanupAudio, stopCallTimer, stopVADListening])

  return {
    isConnected, callStatus, sessionId, documentName,
    isRecording, isProcessing, processingStage, isPlayingAudio,
    isSpeaking, audioLevel, vadEnabled,
    messages, latency, callDuration,
    connect, disconnect, startRecording, stopRecording,
    toggleRecording, toggleVAD, sendTextMessage, interruptPlayback,
  }
}
