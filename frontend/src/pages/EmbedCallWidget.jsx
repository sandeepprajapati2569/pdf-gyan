import { useEffect, useState, useRef, useCallback } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Send, Loader2, MessageSquare, X } from 'lucide-react'

/**
 * EmbedCallWidget — Standalone embeddable voice call component.
 *
 * This page runs inside an iframe on third-party websites.
 * It receives the embed token via URL params and connects
 * directly to the embed WebSocket endpoint.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const WS_BASE = API_BASE.replace(/^http/, 'ws')

const AUDIO_MIME = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : 'audio/webm'

export default function EmbedCallWidget() {
  const params = new URLSearchParams(window.location.search)
  const embedToken = params.get('token') || ''
  const theme = params.get('theme') || 'dark'
  const position = params.get('position') || 'bottom-right'
  const autoStart = params.get('autostart') === 'true'

  const [callStatus, setCallStatus] = useState('idle')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState([])
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [documentName, setDocumentName] = useState('')

  const wsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioRef = useRef(null)
  const streamRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsPlayingAudio(false)
  }, [])

  const playAudio = useCallback((base64Audio) => {
    cleanupAudio()
    const binaryStr = atob(base64Audio)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioRef.current = audio
    setIsPlayingAudio(true)
    audio.onended = () => { setIsPlayingAudio(false); cleanupAudio() }
    audio.play().catch(() => setIsPlayingAudio(false))
  }, [cleanupAudio])

  const connectCall = useCallback(() => {
    if (!embedToken) return

    setCallStatus('connecting')
    setMessages([])
    const origin = window.location.origin

    const ws = new WebSocket(`${WS_BASE}/api/voice-call/embed/ws?embed_token=${encodeURIComponent(embedToken)}&origin=${encodeURIComponent(origin)}`)
    wsRef.current = ws

    ws.onopen = () => setCallStatus('active')

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'call_started':
            setCallStatus('active')
            setDocumentName(msg.document_name || '')
            setMessages(prev => [...prev, { role: 'assistant', text: msg.intro_text }])
            if (msg.intro_audio) playAudio(msg.intro_audio)
            // Notify parent frame
            window.parent?.postMessage({ type: 'pgyan_call_started', session_id: msg.session_id }, '*')
            break
          case 'processing':
            setIsProcessing(true)
            break
          case 'transcript':
            setMessages(prev => [...prev, { role: 'user', text: msg.text }])
            break
          case 'response':
            setIsProcessing(false)
            setMessages(prev => [...prev, { role: 'assistant', text: msg.text }])
            if (msg.audio) playAudio(msg.audio)
            break
          case 'response_text':
            setIsProcessing(false)
            setMessages(prev => [...prev, { role: 'assistant', text: msg.text }])
            break
          case 'call_ended':
            setCallStatus('ended')
            window.parent?.postMessage({ type: 'pgyan_call_ended' }, '*')
            break
          case 'error':
            setIsProcessing(false)
            break
          default: break
        }
      } catch (e) { console.error(e) }
    }

    ws.onclose = () => { if (callStatus !== 'ended') setCallStatus('ended') }
    ws.onerror = () => setCallStatus('error')
  }, [embedToken, playAudio, callStatus])

  const disconnectCall = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_call' }))
      wsRef.current.close()
    }
    setIsRecording(false)
    setCallStatus('ended')
    cleanupAudio()
  }, [cleanupAudio])

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      return
    }

    if (isPlayingAudio) cleanupAudio()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      streamRef.current = stream
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: AUDIO_MIME })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: AUDIO_MIME })
        const buf = await blob.arrayBuffer()
        const uint8 = new Uint8Array(buf)
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < uint8.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize))
        }
        const b64 = btoa(binary)
        if (b64 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'audio_chunk', audio: b64, format: 'webm' }))
        }
        setIsRecording(false)
      }
      recorder.start()
      setIsRecording(true)
    } catch { setIsRecording(false) }
  }, [isRecording, isPlayingAudio, cleanupAudio])

  const sendText = (e) => {
    e.preventDefault()
    if (!textInput.trim() || !wsRef.current) return
    setMessages(prev => [...prev, { role: 'user', text: textInput }])
    wsRef.current.send(JSON.stringify({ type: 'text_input', text: textInput.trim() }))
    setTextInput('')
  }

  // Auto-start if configured
  useEffect(() => {
    if (autoStart && embedToken) {
      setIsExpanded(true)
      connectCall()
    }
  }, [autoStart, embedToken, connectCall])

  // Cleanup
  useEffect(() => () => {
    wsRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    cleanupAudio()
  }, [cleanupAudio])

  const isDark = theme === 'dark'
  const bgColor = isDark ? 'bg-gray-900' : 'bg-white'
  const textColor = isDark ? 'text-white' : 'text-gray-900'
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200'
  const msgBgUser = isDark ? 'bg-emerald-600/80' : 'bg-emerald-500'
  const msgBgAssistant = isDark ? 'bg-gray-700/80' : 'bg-gray-100 text-gray-900'

  // Floating button when collapsed
  if (!isExpanded) {
    return (
      <button
        onClick={() => { setIsExpanded(true); if (callStatus === 'idle') connectCall() }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl flex items-center justify-center transition-all hover:scale-105"
        style={{ zIndex: 99999 }}
      >
        <Phone size={24} />
      </button>
    )
  }

  return (
    <div
      className={`fixed bottom-6 right-6 w-96 h-[600px] ${bgColor} ${textColor} rounded-2xl shadow-2xl border ${borderColor} flex flex-col overflow-hidden`}
      style={{ zIndex: 99999 }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor}`}>
        <div>
          <p className="text-sm font-medium">{documentName || 'Document Call'}</p>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {callStatus === 'active' ? 'Call Active' : callStatus === 'connecting' ? 'Connecting...' : callStatus === 'ended' ? 'Call Ended' : 'Ready'}
          </p>
        </div>
        <button
          onClick={() => { if (callStatus === 'active') disconnectCall(); setIsExpanded(false) }}
          className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? `${msgBgUser} text-white` : msgBgAssistant}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className={`rounded-xl px-3 py-2 text-sm flex items-center gap-2 ${isDark ? 'bg-gray-700/60 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              <Loader2 size={12} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className={`border-t ${borderColor} p-3`}>
        {callStatus === 'active' && (
          <>
            {showTextInput && (
              <form onSubmit={sendText} className="flex gap-2 mb-2">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a message..."
                  className={`flex-1 rounded-full px-3 py-1.5 text-sm border ${borderColor} ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-50'} focus:outline-none focus:border-emerald-500`}
                />
                <button type="submit" disabled={!textInput.trim()} className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50">
                  <Send size={14} />
                </button>
              </form>
            )}
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setShowTextInput(!showTextInput)} className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                <MessageSquare size={16} />
              </button>
              <button
                onClick={toggleRecording}
                disabled={isProcessing || isPlayingAudio}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  isRecording ? 'bg-red-500 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500'
                } text-white disabled:opacity-50`}
              >
                {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
              <button onClick={disconnectCall} className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center">
                <PhoneOff size={16} />
              </button>
            </div>
          </>
        )}
        {callStatus === 'ended' && (
          <div className="text-center space-y-2">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Call ended</p>
            <button onClick={() => { setCallStatus('idle'); connectCall() }} className="px-4 py-1.5 bg-emerald-600 text-white rounded-full text-sm">
              Call Again
            </button>
          </div>
        )}
        {callStatus === 'error' && (
          <div className="text-center">
            <p className="text-red-400 text-sm mb-2">Connection failed</p>
            <button onClick={connectCall} className="px-4 py-1.5 bg-emerald-600 text-white rounded-full text-sm">Retry</button>
          </div>
        )}
      </div>

      {/* Powered by */}
      <div className={`text-center py-1 text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
        Powered by PDF Gyan
      </div>
    </div>
  )
}
