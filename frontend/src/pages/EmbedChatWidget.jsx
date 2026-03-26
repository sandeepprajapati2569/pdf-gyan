import { useEffect, useState, useRef, useCallback } from 'react'
import { MessageSquare, Send, Loader2, X } from 'lucide-react'

/**
 * EmbedChatWidget — Embeddable chat component for third-party websites.
 *
 * Runs inside an iframe, receives embed token via URL params.
 * Connects to POST /api/embed/chat for streaming chat responses.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function EmbedChatWidget() {
  const params = new URLSearchParams(window.location.search)
  const embedToken = params.get('token') || ''
  const theme = params.get('theme') || 'dark'
  const position = params.get('position') || 'bottom-right'

  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !embedToken || streaming) return

    const userMsg = text.trim()
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setInput('')
    setStreaming(true)
    setError(null)

    try {
      const resp = await fetch(`${API_BASE}/api/embed/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: embedToken,
          message: userMsg,
          conversation_id: conversationId,
        }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to get response')
      }

      let assistantContent = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          // Extract conversation ID
          if (data.includes('<!--conv_id:')) {
            const match = data.match(/<!--conv_id:(.+?)-->/)
            if (match) setConversationId(match[1])
          }

          const clean = data.replace(/<!--conv_id:.+?-->/g, '')
          if (!clean) continue

          assistantContent += clean
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
            return updated
          })
        }
      }

      // Notify parent
      window.parent?.postMessage({ type: 'pgyan_chat_message', message: userMsg }, '*')
    } catch (e) {
      setError(e.message)
      setMessages(prev => prev[prev.length - 1]?.role === 'assistant' && !prev[prev.length - 1].content
        ? prev.slice(0, -1)
        : prev
      )
    } finally {
      setStreaming(false)
    }
  }, [embedToken, conversationId, streaming])

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const isDark = theme === 'dark'
  const bg = isDark ? 'bg-gray-900' : 'bg-white'
  const text = isDark ? 'text-white' : 'text-gray-900'
  const border = isDark ? 'border-gray-700' : 'border-gray-200'
  const inputBg = isDark ? 'bg-gray-800 text-white placeholder-gray-500' : 'bg-gray-50 text-gray-900 placeholder-gray-400'
  const userBubble = isDark ? 'bg-teal-600/80 text-white' : 'bg-teal-500 text-white'
  const aiBubble = isDark ? 'bg-gray-700/80 text-gray-100' : 'bg-gray-100 text-gray-900'

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`fixed ${position === 'bottom-left' ? 'left-6' : 'right-6'} bottom-6 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-500 text-white shadow-xl flex items-center justify-center transition-all hover:scale-105`}
        style={{ zIndex: 99999 }}
      >
        <MessageSquare size={24} />
      </button>
    )
  }

  return (
    <div
      className={`fixed ${position === 'bottom-left' ? 'left-6' : 'right-6'} bottom-6 w-96 h-[550px] ${bg} ${text} rounded-2xl shadow-2xl border ${border} flex flex-col overflow-hidden`}
      style={{ zIndex: 99999 }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${border}`}>
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-teal-500" />
          <span className="text-sm font-semibold">Chat with Document</span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className={`w-7 h-7 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Ask anything about this document
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === 'user' ? userBubble : aiBubble
            }`}>
              <p className="whitespace-pre-wrap">{msg.content || (streaming && i === messages.length - 1 ? '...' : '')}</p>
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className={`rounded-xl px-3 py-2 text-sm flex items-center gap-2 ${isDark ? 'bg-gray-700/60 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              <Loader2 size={12} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        {error && (
          <div className="text-center">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className={`border-t ${border} p-3`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={streaming}
            className={`flex-1 rounded-full px-3.5 py-2 text-sm border ${border} ${inputBg} focus:outline-none focus:border-teal-500`}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-teal-500 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>

      {/* Footer */}
      <div className={`text-center py-1 text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
        Powered by PDF Gyan
      </div>
    </div>
  )
}
