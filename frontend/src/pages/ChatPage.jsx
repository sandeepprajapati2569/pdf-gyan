import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bookmark,
  Download,
  FileText,
  Globe,
  Link2,
  Loader2,
  Menu,
  MessageSquareText,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  UserCog,
  X,
} from 'lucide-react'
import { getDocument } from '../api/documents'
import { sendMessage, getChatHistory, getConversation, readChatStream } from '../api/chat'
import client from '../api/client'
import toast from 'react-hot-toast'
import AssistantMessage from '../components/chat/AssistantMessage'
import ChatComposer from '../components/chat/ChatComposer'
import PageViewer from '../components/chat/PageViewer'
import PersonaModal from '../components/chat/PersonaModal'
import { useTalkMode } from '../hooks/useTalkMode'
import { useVoiceNote } from '../hooks/useVoiceNote'
import { useAuth } from '../context/useAuth'

const conversationDate = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
})

function ChatFavicon({ url, favicon }) {
  const [failed, setFailed] = useState(false)
  const src = !failed && (favicon || (url ? `https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(url).hostname } catch { return '' } })()}&sz=64` : null))
  if (!src || failed) return <Globe className="h-4 w-4" style={{ color: 'var(--teal)' }} />
  return <img src={src} alt="" className="h-4 w-4 shrink-0 rounded-sm object-contain" onError={() => setFailed(true)} />
}

const pdfPromptIdeas = [
  'Give me the top three takeaways from this PDF.',
  'Summarize the important risks, dates, and next steps.',
]

const websitePromptIdeas = [
  'What is this website about? Give me a quick summary.',
  'What are the key services or products mentioned on this site?',
]

const historyStorageKey = (documentId) => `pdf-gyan:last-chat:${documentId}`

export default function ChatPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [document, setDocument] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState('history') // history | bookmarks
  const [bookmarks, setBookmarks] = useState([])
  const [pageViewerState, setPageViewerState] = useState(null) // { pageNum } or null
  const [personaOpen, setPersonaOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const messagesEndRef = useRef(null)
  const restoredConversationRef = useRef(false)
  const submitMessageRef = useRef(null)

  const loadDocument = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDocument(documentId)
      setDocument(res.data)
    } catch {
      toast.error('Document not found')
      navigate('/documents')
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

  const {
    talkModeEnabled,
    recognitionSupported,
    speechSupported,
    isListening,
    isSpeaking,
    voiceEngine,
    toggleTalkMode,
    toggleListening,
    stopListening,
    stopSpeaking,
    beginStreamingSpeech,
    appendStreamingSpeechChunk,
    finishStreamingSpeech,
  } = useTalkMode({
    onDraftChange: setInput,
    onSubmitMessage: (message) => submitMessageRef.current?.(message),
    busy: streaming,
    preferAiVoice: user?.mode !== 'local',
  })

  // Voice note
  const { isRecording: voiceNoteRecording, isTranscribing: voiceNoteTranscribing, toggleRecording: toggleVoiceNote } = useVoiceNote({
    onTranscribed: (text) => { if (text) setInput(prev => prev ? `${prev} ${text}` : text) },
  })

  // Bookmarks
  const loadBookmarks = useCallback(async () => {
    try {
      const res = await client.get(`/api/bookmarks?document_id=${documentId}`)
      setBookmarks(res.data || [])
    } catch { setBookmarks([]) }
  }, [documentId])

  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  const handleBookmark = async (content, isAdding) => {
    if (isAdding) {
      try {
        await client.post('/api/bookmarks', { document_id: documentId, conversation_id: conversationId, content })
        toast.success('Bookmarked!')
        loadBookmarks()
      } catch { toast.error('Failed to bookmark') }
    }
  }

  const handleDeleteBookmark = async (id) => {
    try {
      await client.delete(`/api/bookmarks/${id}`)
      setBookmarks(prev => prev.filter(b => b.id !== id))
    } catch { toast.error('Failed to delete') }
  }

  const handleExport = async (format) => {
    if (!conversationId) return toast.error('No conversation to export')
    setExportOpen(false)
    try {
      const res = await client.get(`/api/chat/conversation/${conversationId}/export?format=${format}`, { responseType: 'blob' })
      const ext = format === 'json' ? 'json' : 'md'
      const blob = new Blob([res.data])
      const url = URL.createObjectURL(blob)
      const a = Object.assign(window.document.createElement('a'), { href: url, download: `conversation.${ext}` })
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported!')
    } catch { toast.error('Export failed') }
  }

  const handleShare = async () => {
    if (!conversationId) return toast.error('No conversation to share')
    try {
      const res = await client.post(`/api/chat/share/${conversationId}`)
      const shareUrl = `${window.location.origin}${res.data.url}`
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Share link copied to clipboard!')
    } catch { toast.error('Failed to create share link') }
  }

  useEffect(() => {
    stopListening()
    stopSpeaking()
    setMessages([])
    setConversationId(null)
    restoredConversationRef.current = false
    loadDocument()
    loadConversations()
  }, [documentId, loadDocument, loadConversations, stopListening, stopSpeaking])

  const loadConversation = useCallback(async (convId) => {
    try {
      stopSpeaking()
      stopListening()
      const res = await getConversation(convId)
      setMessages(res.data.messages || [])
      setConversationId(convId)
      localStorage.setItem(historyStorageKey(documentId), convId)
      setSidebarOpen(false)
    } catch {
      toast.error('Failed to load conversation')
    }
  }, [documentId, stopListening, stopSpeaking])

  const startNewChat = () => {
    stopSpeaking()
    stopListening()
    setMessages([])
    setConversationId(null)
    localStorage.removeItem(historyStorageKey(documentId))
    setSidebarOpen(false)
  }

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/documents')} className="btn-ghost px-3 py-2 text-sm">
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

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={startNewChat} className="btn-primary flex-1 justify-center">
            <Plus className="h-4 w-4" />
            New chat
          </button>
          <button
            type="button"
            onClick={() => navigate(`/call/${documentId}`)}
            className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 hover:border-emerald-300"
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 pt-4 flex items-center gap-1">
        {[
          { key: 'history', label: 'History', icon: null, count: conversations.length },
          { key: 'bookmarks', label: 'Pins', icon: Bookmark, count: bookmarks.length },
        ].map(tab => {
          const active = sidebarTab === tab.key
          const TabIcon = tab.icon
          return (
            <button key={tab.key} type="button" onClick={() => setSidebarTab(tab.key)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition"
              style={{
                background: active ? 'var(--teal-soft)' : 'transparent',
                color: active ? 'var(--teal)' : 'var(--muted-soft)',
              }}>
              {TabIcon && <TabIcon className="h-3 w-3" />}
              {tab.label}
              {tab.count > 0 && <span className="ml-0.5 rounded-md px-1 py-0 text-[9px] font-bold" style={{ background: active ? 'var(--teal)' : 'var(--border)', color: active ? 'white' : 'var(--muted-soft)' }}>{tab.count}</span>}
            </button>
          )
        })}
      </div>

      <div className="chat-scroll flex-1 px-3 pb-3 pt-3">
        {sidebarTab === 'bookmarks' ? (
          /* Bookmarks tab */
          bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bookmark className="h-8 w-8" style={{ color: 'var(--border)' }} />
              <p className="mt-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>No pins yet</p>
              <p className="mt-1 text-[10px] max-w-[180px] leading-4" style={{ color: 'var(--muted-soft)' }}>
                Hover over an AI response and click the bookmark icon to pin it.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookmarks.map((bm) => (
                <div key={bm.id} className="group rounded-xl border p-3 text-left transition hover:shadow-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <p className="text-[11px] line-clamp-3 leading-5" style={{ color: 'var(--text)' }}>{bm.content}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>
                      {new Date(bm.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </p>
                    <button type="button" onClick={() => handleDeleteBookmark(bm.id)}
                      className="opacity-0 group-hover:opacity-100 transition" style={{ color: 'var(--muted-soft)' }}>
                      <Trash2 className="h-3 w-3 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* History tab */
          conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <MessageSquareText className="h-8 w-8" style={{ color: 'var(--border)' }} />
              <p className="mt-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>No conversations yet</p>
              <p className="mt-1 text-[10px] max-w-[180px] leading-4" style={{ color: 'var(--muted-soft)' }}>
                Ask your first question and threads will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {conversations.map((conv) => {
                const active = conversationId === conv.id
                return (
                  <button key={conv.id} type="button" onClick={() => loadConversation(conv.id)}
                    className="w-full rounded-xl p-3 text-left transition"
                    style={{
                      background: active ? 'linear-gradient(135deg, #0f172a, #1e293b)' : 'var(--surface)',
                      border: active ? 'none' : '1px solid var(--border)',
                      boxShadow: active ? '0 8px 24px rgba(15,23,42,0.15)' : 'none',
                    }}>
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{ background: active ? 'rgba(255,255,255,0.1)' : 'var(--teal-soft)' }}>
                        <MessageSquareText className="h-3.5 w-3.5" style={{ color: active ? '#5eead4' : 'var(--teal)' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold" style={{ color: active ? 'white' : 'var(--text)' }}>{conv.title}</p>
                        <p className="mt-0.5 text-[10px]" style={{ color: active ? 'rgba(255,255,255,0.5)' : 'var(--muted-soft)' }}>
                          {conversationDate.format(new Date(conv.created_at))}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )
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

  const submitMessage = useCallback(async (messageText) => {
    const userMessage = messageText.trim()
    if (!userMessage || streaming) return

    stopSpeaking()
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
      beginStreamingSpeech()

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
        appendStreamingSpeechChunk(cleanData)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: assistantContent,
          }
          return updated
        })
      })
      finishStreamingSpeech()
    } catch (err) {
      stopSpeaking()
      toast.error(err.message || 'Failed to get response')
      setMessages((prev) =>
        prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -1) : prev,
      )
    } finally {
      setStreaming(false)
    }
  }, [
    appendStreamingSpeechChunk,
    beginStreamingSpeech,
    conversationId,
    documentId,
    finishStreamingSpeech,
    loadConversations,
    stopSpeaking,
    streaming,
  ])

  submitMessageRef.current = submitMessage

  const handleSend = async (event) => {
    event.preventDefault()
    await submitMessage(input)
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
          {/* ── Compact Header ── */}
          <header className="px-4 py-3 sm:px-5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-2">
              {/* Left: menu + doc info */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <button type="button" onClick={() => setSidebarOpen(true)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border lg:hidden"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--muted)' }}>
                  <Menu className="h-4 w-4" />
                </button>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--teal-soft)' }}>
                  {document?.source_type === 'website' ? (
                    <ChatFavicon url={document?.source_url} favicon={document?.favicon_url} />
                  ) : (
                    <FileText className="h-4 w-4" style={{ color: 'var(--teal)' }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-sm font-bold leading-5" style={{ color: 'var(--text)', maxWidth: '100%' }}>
                    {document?.original_filename}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-medium" style={{ color: 'var(--muted-soft)' }}>
                      {document?.source_type === 'website'
                        ? `${document?.page_count || 0} pages`
                        : `${document?.page_count || 0} pg`}
                    </span>
                    {document?.persona?.name && document.persona.name !== 'Document Reader' && (
                      <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
                        {document.persona.name}
                      </span>
                    )}
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${document?.status === 'ready' ? '' : 'opacity-60'}`}
                      style={{ background: document?.status === 'ready' ? '#10b98115' : 'var(--border)', color: document?.status === 'ready' ? '#10b981' : 'var(--muted-soft)' }}>
                      {document?.status === 'ready' ? 'Ready' : document?.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: action toolbar */}
              <div className="flex items-center rounded-xl border p-0.5 gap-0.5 shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <button type="button" onClick={handleShare} disabled={!conversationId || messages.length === 0}
                  className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/60 disabled:opacity-30" style={{ color: 'var(--muted)' }}
                  title="Share">
                  <Link2 className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => setPersonaOpen(true)}
                  className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/60" style={{ color: 'var(--muted)' }}
                  title="Persona">
                  <UserCog className="h-3 w-3" />
                </button>
                <div className="relative">
                  <button type="button" onClick={() => setExportOpen(!exportOpen)} disabled={!conversationId || messages.length === 0}
                    className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/60 disabled:opacity-30" style={{ color: 'var(--muted)' }}
                    title="Export">
                    <Download className="h-3 w-3" />
                  </button>
                  {exportOpen && (
                    <>
                      <button type="button" className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1.5 w-36 rounded-xl border p-1 shadow-xl" style={{ borderColor: 'var(--border)', background: 'var(--surface-strong)' }}>
                        <button onClick={() => handleExport('md')} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-medium transition hover:bg-white/60" style={{ color: 'var(--text)' }}>
                          Markdown
                        </button>
                        <button onClick={() => handleExport('json')} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-medium transition hover:bg-white/60" style={{ color: 'var(--text)' }}>
                          JSON
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="chat-scroll flex-1 px-4 py-5 sm:px-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'var(--teal-soft)' }}>
                  <Sparkles className="h-6 w-6" style={{ color: 'var(--teal)' }} />
                </div>
                <h2 className="mt-5 font-display text-xl sm:text-2xl" style={{ color: 'var(--text)' }}>
                  {document?.source_type === 'website' ? 'Ask about this website' : 'Ask about this document'}
                </h2>

                {/* Auto-generated summary */}
                {document?.auto_summary && (
                  <div className="mt-4 max-w-xl w-full">
                    <div className="soft-card p-4 text-left">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: 'var(--muted-soft)' }}>Summary</p>
                      <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>{document.auto_summary}</p>
                    </div>
                  </div>
                )}

                {/* Auto-generated FAQ */}
                {document?.auto_faq?.length > 0 ? (
                  <div className="mt-4 grid w-full max-w-xl gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-left" style={{ color: 'var(--muted-soft)' }}>Suggested questions</p>
                    {document.auto_faq.map((item, i) => (
                      <button key={i} type="button" onClick={() => submitMessage(item.q)}
                        className="rounded-xl border px-4 py-3 text-left text-xs font-medium leading-5 transition hover:-translate-y-0.5"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface)' }}>
                        {item.q}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="mt-2 max-w-md text-xs leading-6 sm:text-sm" style={{ color: 'var(--muted-soft)' }}>
                      {document?.source_type === 'website'
                        ? 'Ask about any page, topic, or detail from the crawled website.'
                        : 'Start with a summary, key risks, next steps, or any detail you want.'}
                    </p>
                    <div className="mt-5 grid w-full max-w-md gap-2">
                      {(document?.source_type === 'website' ? websitePromptIdeas : pdfPromptIdeas).map((idea) => (
                        <button key={idea} type="button" onClick={() => setInput(idea)}
                          className="rounded-xl border px-4 py-3 text-left text-xs font-medium leading-5 transition hover:-translate-y-0.5"
                          style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface)' }}>
                          {idea}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' ? (
                      <AssistantMessage
                        icon={document?.source_type === 'website' ? Globe : FileText}
                        content={msg.content}
                        isStreaming={streaming && index === messages.length - 1}
                        isSpeaking={isSpeaking && index === messages.length - 1}
                        pendingLabel="Reading the document"
                        onBookmark={(isAdding) => handleBookmark(msg.content, isAdding)}
                        onPageClick={document?.source_type !== 'website' ? (pageNum, quote) => setPageViewerState({ pageNum, highlightText: quote }) : undefined}
                      />
                    ) : (
                      <div className="max-w-[90%] rounded-2xl rounded-tr-lg px-4 py-3 text-sm leading-7 text-white sm:max-w-[75%]"
                        style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', boxShadow: '0 8px 24px rgba(15,23,42,0.15)' }}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <ChatComposer
            input={input}
            onInputChange={setInput}
            onSubmit={handleSend}
            placeholder="Ask about findings, dates, risks, actions, or summaries..."
            streaming={streaming}
            talkModeEnabled={talkModeEnabled}
            talkModeAvailable={recognitionSupported || speechSupported}
            recognitionSupported={recognitionSupported}
            speechSupported={speechSupported}
            isListening={isListening}
            isSpeaking={isSpeaking}
            voiceEngine={voiceEngine}
            onToggleTalkMode={toggleTalkMode}
            onToggleListening={toggleListening}
            onStopSpeaking={stopSpeaking}
            voiceNoteRecording={voiceNoteRecording}
            voiceNoteTranscribing={voiceNoteTranscribing}
            onToggleVoiceNote={toggleVoiceNote}
          />
        </section>
      </div>

      {/* Persona Modal */}
      {personaOpen && (
        <PersonaModal
          documentId={documentId}
          currentPersona={document?.persona}
          onClose={() => setPersonaOpen(false)}
          onSaved={(persona) => setDocument(prev => ({ ...prev, persona }))}
        />
      )}

      {/* Page Viewer Modal */}
      {pageViewerState && (
        <PageViewer
          documentId={documentId}
          pageNum={pageViewerState.pageNum}
          totalPages={document?.page_count}
          highlightText={pageViewerState.highlightText}
          onClose={() => setPageViewerState(null)}
          onPageChange={(num) => setPageViewerState({ pageNum: num })}
        />
      )}
    </div>
  )
}
