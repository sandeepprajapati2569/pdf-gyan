import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Phone, PhoneOff, Mic, MicOff, Send, ArrowLeft, Clock,
  Loader2, Volume2, VolumeX, Radio, MessageSquare, FileText,
} from 'lucide-react'
import { useVoiceCall } from '../hooks/useVoiceCall'
import client from '../api/client'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatLatency(ms) {
  if (!ms) return '0ms'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

/* ─── Pulsing rings that react to audio level ────────── */
function AudioVisualizer({ level = 0, isActive = false, color = 'teal' }) {
  const scale = 1 + level * 1.8
  const colors = {
    teal: 'rgba(15,118,110,VAL)',
    rose: 'rgba(225,29,72,VAL)',
    amber: 'rgba(217,119,6,VAL)',
    indigo: 'rgba(79,70,229,VAL)',
  }
  const c = colors[color] || colors.teal

  if (!isActive) return null
  return (
    <>
      <div className="absolute inset-0 rounded-full transition-all duration-150"
        style={{ transform: `scale(${scale})`, background: c.replace('VAL', 0.06) }} />
      <div className="absolute inset-2 rounded-full transition-all duration-200"
        style={{ transform: `scale(${1 + level * 1.3})`, background: c.replace('VAL', 0.1) }} />
      <div className="absolute inset-4 rounded-full transition-all duration-100"
        style={{ transform: `scale(${1 + level * 0.9})`, background: c.replace('VAL', 0.15) }} />
    </>
  )
}

/* ─── Waveform bars for visual feedback ──────────────── */
function WaveBars({ level = 0, active = false, count = 5, className = '' }) {
  return (
    <div className={`flex items-center gap-[3px] h-6 ${className}`}>
      {Array.from({ length: count }, (_, i) => {
        const offset = Math.sin(Date.now() / 180 + i * 0.9) * 0.35 + 0.5
        const h = active ? Math.max(4, level * 36 * offset) : 4
        return <div key={i} className="w-[3px] rounded-full bg-current transition-all duration-75" style={{ height: `${h}px` }} />
      })}
    </div>
  )
}

export default function CallPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [document, setDocument] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const messagesEndRef = useRef(null)
  const [, forceUpdate] = useState(0)

  const {
    callStatus, documentName,
    isRecording, isProcessing, processingStage, isPlayingAudio,
    isSpeaking, audioLevel, vadEnabled,
    messages, latency, callDuration,
    connect, disconnect, toggleRecording, toggleVAD,
    sendTextMessage, interruptPlayback,
  } = useVoiceCall()

  // Animate waveform
  useEffect(() => {
    if (callStatus === 'active' && (isRecording || isPlayingAudio)) {
      const id = setInterval(() => forceUpdate(n => n + 1), 80)
      return () => clearInterval(id)
    }
  }, [callStatus, isRecording, isPlayingAudio])

  // Load document
  useEffect(() => {
    client.get(`/api/documents/${documentId}`).then(r => setDocument(r.data)).catch(() => navigate('/documents'))
  }, [documentId, navigate])

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleStartCall = () => connect(documentId)
  const handleEndCall = () => disconnect()
  const handleSendText = (e) => { e.preventDefault(); if (!textInput.trim()) return; sendTextMessage(textInput); setTextInput('') }
  const handleBack = () => { if (callStatus === 'active') disconnect(); navigate(`/chat/${documentId}`) }

  const getStatusText = () => {
    if (isPlayingAudio) return 'AI is speaking...'
    if (isProcessing) {
      const stages = { stt: 'Listening...', thinking: 'Thinking...', rag: 'Searching document...', llm: 'Generating response...', tts: 'Preparing speech...' }
      return stages[processingStage] || 'Processing...'
    }
    if (isSpeaking || isRecording) return 'Listening to you...'
    if (vadEnabled) return 'Speak anytime — I\'m listening'
    return 'Tap the mic to speak'
  }

  const vizColor = isPlayingAudio ? 'indigo' : isRecording || isSpeaking ? 'teal' : isProcessing ? 'amber' : 'teal'

  const docTitle = documentName || document?.original_filename || 'Document'

  return (
    <div className="page-shell chat-page-shell max-w-[1520px] py-0">
      <div className="premium-card h-full flex flex-col overflow-hidden">

        {/* ─── Header ────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 sm:px-6">
          <button onClick={handleBack} className="btn-ghost px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Chat</span>
          </button>

          <div className="text-center min-w-0">
            <div className="flex items-center justify-center gap-2">
              <div className="icon-shell h-8 w-8 shrink-0"><FileText className="h-3.5 w-3.5" /></div>
              <p className="truncate text-sm font-semibold text-slate-950 max-w-[180px] sm:max-w-xs">{docTitle}</p>
            </div>
            {callStatus === 'active' && (
              <p className="text-xs font-mono font-semibold text-teal-700 mt-0.5">{formatTime(callDuration)}</p>
            )}
          </div>

          <div className="w-20 flex justify-end">
            {callStatus === 'active' && (
              <span className="status-pill status-ready">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </header>

        {/* ─── IDLE ──────────────────────────────────────── */}
        {callStatus === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
            <div className="text-center space-y-7 max-w-md">
              <div className="relative mx-auto w-28 h-28">
                <div className="absolute inset-0 rounded-full bg-teal-100/60 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-2 rounded-full bg-teal-50/80 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="relative icon-shell w-28 h-28">
                  <Phone className="h-10 w-10" />
                </div>
              </div>
              <div>
                <h2 className="font-display text-3xl text-slate-950">Voice Call</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Have a natural voice conversation about your document. Speak freely — the AI will listen and respond automatically.
                </p>
              </div>
              <button onClick={handleStartCall} className="btn-primary mx-auto">
                <Phone className="h-4 w-4" />
                Start Call
              </button>
            </div>
          </div>
        )}

        {/* ─── CONNECTING ────────────────────────────────── */}
        {callStatus === 'connecting' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="text-center space-y-5">
              <div className="icon-shell-warm mx-auto w-28 h-28 animate-pulse">
                <Phone className="h-10 w-10 animate-bounce" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-950">Connecting...</p>
                <p className="text-sm text-slate-500 mt-1">Setting up your call</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── ACTIVE + ENDED ────────────────────────────── */}
        {(callStatus === 'active' || callStatus === 'ended') && (
          <div className="flex-1 flex flex-col min-h-0">

            {/* Center visualizer (active only) */}
            {callStatus === 'active' && (
              <div className="flex-shrink-0 flex flex-col items-center py-6 sm:py-8">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <AudioVisualizer
                    level={isPlayingAudio ? 0.35 + Math.sin(Date.now() / 200) * 0.2 : audioLevel}
                    isActive={isRecording || isPlayingAudio || isSpeaking}
                    color={vizColor}
                  />
                  {/* Center orb */}
                  <div className={`
                    relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
                    ${isPlayingAudio
                      ? 'bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200/60 text-indigo-600 shadow-[0_16px_40px_rgba(79,70,229,0.15)]'
                      : isRecording || isSpeaking
                      ? 'bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200/60 text-teal-700 shadow-[0_16px_40px_rgba(15,118,110,0.15)]'
                      : isProcessing
                      ? 'bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200/60 text-amber-700 shadow-[0_16px_40px_rgba(217,119,6,0.15)]'
                      : 'bg-white border border-slate-200/80 text-slate-400 shadow-[0_16px_40px_rgba(15,23,42,0.06)]'
                    }
                  `}>
                    {isPlayingAudio ? (
                      <WaveBars level={0.5 + Math.sin(Date.now() / 150) * 0.3} active count={5} />
                    ) : isProcessing ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : isRecording || isSpeaking ? (
                      <WaveBars level={audioLevel} active={audioLevel > 0.01} count={5} />
                    ) : (
                      <Mic className="h-6 w-6" />
                    )}
                  </div>
                </div>

                <p className="mt-3 text-sm font-medium text-slate-600">{getStatusText()}</p>

                {vadEnabled && !isProcessing && !isPlayingAudio && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Hands-free
                  </div>
                )}
              </div>
            )}

            {/* Transcript (toggleable) */}
            {showTranscript && (
              <div className="flex-1 chat-scroll px-4 pb-2 sm:px-6">
                <div className="max-w-2xl mx-auto space-y-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-[20px] px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[linear-gradient(135deg,#0f172a,#1f2937)] text-white shadow-[0_14px_28px_rgba(15,23,42,0.12)]'
                          : msg.role === 'system'
                          ? 'border border-red-100 bg-red-50/80 text-red-700'
                          : msg.isIntro
                          ? 'soft-card text-slate-600'
                          : 'bg-white/80 border border-slate-200/60 text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.04)]'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex justify-start">
                      <div className="soft-card px-4 py-2.5 text-sm text-slate-500 flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {getStatusText()}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}

            {/* Latency */}
            {latency.total_ms > 0 && (
              <div className="flex items-center justify-center gap-3 py-1 text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {formatLatency(latency.total_ms)}</span>
                {latency.stt_ms > 0 && <span>STT {formatLatency(latency.stt_ms)}</span>}
                {latency.llm_ms > 0 && <span>LLM {formatLatency(latency.llm_ms)}</span>}
                {latency.tts_ms > 0 && <span>TTS {formatLatency(latency.tts_ms)}</span>}
              </div>
            )}

            {/* ─── Controls ──────────────────────────────── */}
            {callStatus === 'active' && (
              <div className="flex-shrink-0 border-t border-slate-200/80 bg-white/60 backdrop-blur-sm px-4 py-4 sm:px-6">
                {/* Text input */}
                {showTextInput && (
                  <form onSubmit={handleSendText} className="flex gap-2 mb-4 max-w-lg mx-auto">
                    <input
                      type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type a message..."
                      className="field-input flex-1 !rounded-full !py-2.5 !px-4 text-sm"
                      disabled={isProcessing} autoFocus
                    />
                    <button type="submit" disabled={!textInput.trim() || isProcessing}
                      className="btn-primary !rounded-full !p-2.5 disabled:opacity-40">
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                )}

                <div className="flex items-center justify-center gap-4">
                  {/* Transcript toggle */}
                  <button onClick={() => setShowTranscript(!showTranscript)}
                    className={`talk-mode-icon-btn ${showTranscript ? 'talk-mode-icon-btn-active' : ''}`}
                    title="Show transcript">
                    <MessageSquare className="h-4 w-4" />
                  </button>

                  {/* VAD toggle */}
                  <button onClick={toggleVAD}
                    className={`talk-mode-icon-btn ${vadEnabled ? 'talk-mode-icon-btn-live' : ''}`}
                    title={vadEnabled ? 'Switch to push-to-talk' : 'Switch to hands-free'}>
                    <Radio className="h-4 w-4" />
                    <span className={`talk-mode-dot ${vadEnabled ? 'talk-mode-dot-active' : ''}`} />
                  </button>

                  {/* Mic button (push-to-talk only) */}
                  {!vadEnabled && (
                    <button onClick={toggleRecording} disabled={isProcessing || isPlayingAudio}
                      className={`grid h-16 w-16 place-items-center rounded-full transition-all ${
                        isRecording
                          ? 'bg-rose-500 text-white shadow-[0_18px_34px_rgba(225,29,72,0.24)] scale-105'
                          : 'bg-gradient-to-br from-teal-600 to-teal-700 text-white shadow-[0_18px_34px_rgba(15,118,110,0.24)] hover:scale-105'
                      } disabled:opacity-40 disabled:scale-100`}
                      title={isRecording ? 'Stop recording' : 'Start recording'}>
                      {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </button>
                  )}

                  {/* Interrupt */}
                  {isPlayingAudio && (
                    <button onClick={interruptPlayback}
                      className="talk-mode-icon-btn" title="Interrupt AI">
                      <VolumeX className="h-4 w-4" />
                    </button>
                  )}

                  {/* Text input toggle */}
                  <button onClick={() => setShowTextInput(!showTextInput)}
                    className={`talk-mode-icon-btn ${showTextInput ? 'talk-mode-icon-btn-active' : ''}`}
                    title="Type message">
                    <Send className="h-4 w-4" />
                  </button>

                  {/* End call */}
                  <button onClick={handleEndCall}
                    className="btn-danger !rounded-full !px-4 !py-3"
                    title="End call">
                    <PhoneOff className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-center text-xs font-medium text-slate-400 mt-3">
                  {vadEnabled ? 'Hands-free — just speak naturally' : isRecording ? 'Recording... tap mic to send' : 'Tap mic to ask a question'}
                </p>
              </div>
            )}

            {/* ─── Ended ─────────────────────────────────── */}
            {callStatus === 'ended' && (
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="text-center space-y-5">
                  <div className="mx-auto w-20 h-20 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center">
                    <PhoneOff className="h-8 w-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-slate-950">Call Ended</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {callDuration > 0 ? `Duration: ${formatTime(callDuration)}` : ''}
                      {messages.filter(m => m.role === 'user').length > 0 ? ` · ${messages.filter(m => m.role === 'user').length} questions` : ''}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={handleStartCall} className="btn-primary">
                      <Phone className="h-4 w-4" /> New Call
                    </button>
                    <button onClick={handleBack} className="btn-secondary">
                      Back to Chat
                    </button>
                  </div>

                  {messages.length > 0 && (
                    <div className="mt-4 max-w-lg mx-auto">
                      <button onClick={() => setShowTranscript(!showTranscript)}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                        {showTranscript ? 'Hide' : 'Show'} transcript ({messages.length} messages)
                      </button>
                      {showTranscript && (
                        <div className="mt-3 max-h-56 overflow-y-auto space-y-2 text-left">
                          {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] rounded-[16px] px-3 py-1.5 text-xs leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {msg.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ERROR ──────────────────────────────────────── */}
        {callStatus === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="text-center space-y-5">
              <div className="mx-auto w-20 h-20 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                <PhoneOff className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-red-700">Connection Failed</p>
                <p className="text-sm text-slate-500 mt-1">Could not establish a voice connection</p>
              </div>
              <button onClick={handleStartCall} className="btn-primary">Try Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
