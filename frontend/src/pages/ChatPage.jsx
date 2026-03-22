import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Loader2,
  Menu,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { getDocument } from '../api/documents'
import { sendMessage, getChatHistory, getConversation, readChatStream } from '../api/chat'
import toast from 'react-hot-toast'
import AssistantMessage from '../components/chat/AssistantMessage'

const conversationDate = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
})

const promptIdeas = [
  'Give me the top three takeaways from this PDF.',
  'Summarize the important risks, dates, and next steps.',
]

const historyStorageKey = (documentId) => `pdf-gyan:last-chat:${documentId}`

export default function ChatPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [document, setDocument] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef(null)
  const restoredConversationRef = useRef(false)

  const loadDocument = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDocument(documentId)
      setDocument(res.data)
    } catch {
      toast.error('Document not found')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [documentId, navigate])

  const loadConversations = useCallback(async () => {
    try {
      const res = await getChatHistory(documentId)
      const nextConversations = res.data || []
      setConversations(nextConversations)
      return nextConversations
    } catch {
      setConversations([])
      return []
    }
  }, [documentId])

  useEffect(() => {
    setMessages([])
    setConversationId(null)
    restoredConversationRef.current = false
    loadDocument()
    loadConversations()
  }, [documentId, loadDocument, loadConversations])

  const loadConversation = useCallback(async (convId) => {
    try {
      const res = await getConversation(convId)
      setMessages(res.data.messages || [])
      setConversationId(convId)
      localStorage.setItem(historyStorageKey(documentId), convId)
      setSidebarOpen(false)
    } catch {
      toast.error('Failed to load conversation')
    }
  }, [documentId])

  const startNewChat = () => {
    setMessages([])
    setConversationId(null)
    localStorage.removeItem(historyStorageKey(documentId))
    setSidebarOpen(false)
  }

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/dashboard')} className="btn-ghost px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-500 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <button type="button" onClick={startNewChat} className="btn-primary mt-4 w-full justify-center">
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="px-4 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Conversation history</p>
      </div>

      <div className="chat-scroll flex-1 px-3 pb-3 pt-3">
        {conversations.length === 0 ? (
          <div className="soft-card p-4 text-sm leading-6 text-slate-500">
            Once you ask the first question, your threads will appear here for quick revisits.
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => loadConversation(conv.id)}
              className={`mb-2 w-full rounded-[22px] p-4 text-left transition ${
                conversationId === conv.id
                  ? 'bg-slate-950 text-white shadow-[0_18px_32px_rgba(15,23,42,0.18)]'
                  : 'bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${
                  conversationId === conv.id ? 'bg-white/10 text-teal-300' : 'bg-teal-50 text-teal-700'
                }`}>
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{conv.title}</p>
                  <p className={`mt-1 text-xs ${conversationId === conv.id ? 'text-slate-300' : 'text-slate-400'}`}>
                    {conversationDate.format(new Date(conv.created_at))}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )

  useEffect(() => {
    if (restoredConversationRef.current || conversations.length === 0) return

    const lastConversationId = localStorage.getItem(historyStorageKey(documentId))
    const conversationToRestore =
      conversations.find((conv) => conv.id === lastConversationId) || conversations[0]

    if (!conversationToRestore) {
      restoredConversationRef.current = true
      return
    }

    restoredConversationRef.current = true
    loadConversation(conversationToRestore.id)
  }, [conversations, documentId, loadConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (event) => {
    event.preventDefault()
    if (!input.trim() || streaming) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setStreaming(true)

    try {
      const response = await sendMessage(documentId, userMessage, conversationId)
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || 'Failed to get response')
      }
      let assistantContent = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      await readChatStream(response, (data) => {
        if (data === '[DONE]') return

        if (data.includes('<!--conv_id:')) {
          const match = data.match(/<!--conv_id:(.+?)-->/)
          if (match) {
            setConversationId(match[1])
            localStorage.setItem(historyStorageKey(documentId), match[1])
            loadConversations()
          }
        }

        const cleanData = data.replace(/<!--conv_id:.+?-->/g, '')
        if (!cleanData) return

        assistantContent += cleanData
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: assistantContent,
          }
          return updated
        })
      })
    } catch (err) {
      toast.error(err.message || 'Failed to get response')
      setMessages((prev) =>
        prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -1) : prev,
      )
    } finally {
      setStreaming(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell chat-page-shell max-w-[1520px] py-0">
        <div className="premium-card chat-workspace flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell chat-page-shell max-w-[1520px] py-0">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <div className="chat-workspace gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden h-full lg:block">
          <div className="premium-card chat-panel h-full">
            {renderSidebarContent()}
          </div>
        </aside>

        <aside
          className={`premium-card chat-panel fixed inset-y-[6.2rem] left-4 z-40 w-[calc(100%-2rem)] max-w-sm lg:hidden ${
            sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-[110%] opacity-0'
          } transition duration-300`}
        >
          {renderSidebarContent(true)}
        </aside>

        <section className="premium-card chat-panel h-full flex flex-col">
          <header className="border-b border-slate-200/80 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-600 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="icon-shell h-12 w-12 shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Document chat</p>
                  <h1 className="truncate text-lg font-semibold text-slate-950 sm:text-xl">{document?.original_filename}</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {document?.page_count ? `${document.page_count} pages` : 'Page count pending'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`status-pill ${document?.status === 'ready' ? 'status-ready' : 'status-processing'}`}>
                  {document?.status === 'ready' ? 'Ready' : document?.status}
                </span>
              </div>
            </div>
          </header>

          <div className="chat-scroll flex-1 px-4 py-5 sm:px-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="icon-shell h-16 w-16">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="mt-6 font-display text-3xl text-slate-950">Ask about this document</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Start with a summary, key risks, next steps, or any detail you want surfaced from the PDF.
                </p>

                <div className="mt-8 grid w-full max-w-2xl gap-3">
                  {promptIdeas.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setInput(idea)}
                      className="soft-card px-5 py-4 text-left text-sm font-medium leading-6 text-slate-700 hover:-translate-y-0.5 hover:text-slate-950"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' ? (
                      <AssistantMessage
                        icon={FileText}
                        content={msg.content}
                        isStreaming={streaming && index === messages.length - 1}
                        pendingLabel="Reading the document"
                      />
                    ) : (
                      <div className="max-w-[88%] rounded-[24px] bg-[linear-gradient(135deg,#0f172a,#1f2937)] px-5 py-4 text-sm leading-7 text-white shadow-[0_22px_38px_rgba(15,23,42,0.18)] sm:max-w-[72%]">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-200/80 bg-white/55 px-4 py-4 sm:px-6">
            <form onSubmit={handleSend} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about findings, dates, risks, actions, or summaries..."
                className="field-input"
                disabled={streaming}
              />
              <button type="submit" disabled={!input.trim() || streaming} className="btn-primary shrink-0 px-4 sm:px-5">
                {streaming ? (
                  <span className="chat-button-status">
                    <span className="chat-thinking-dots chat-thinking-dots-compact" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="hidden sm:inline">Answering</span>
                  </span>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
