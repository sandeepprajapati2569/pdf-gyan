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
      <div className="px-4 pt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSidebarTab('history')}
          className={`text-xs font-semibold uppercase tracking-[0.18em] px-2 py-1 rounded-lg transition ${
            sidebarTab === 'history' ? 'text-slate-950 bg-white/80' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          History
        </button>
        <button
          type="button"
          onClick={() => setSidebarTab('bookmarks')}
          className={`text-xs font-semibold uppercase tracking-[0.18em] px-2 py-1 rounded-lg transition flex items-center gap-1 ${
            sidebarTab === 'bookmarks' ? 'text-slate-950 bg-white/80' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Bookmark className="h-3 w-3" />
          Pins{bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}
        </button>
      </div>

      <div className="chat-scroll flex-1 px-3 pb-3 pt-3">
        {sidebarTab === 'bookmarks' ? (
          /* Bookmarks tab */
          bookmarks.length === 0 ? (
            <div className="soft-card p-4 text-sm leading-6 text-slate-500">
              Bookmark important AI responses to find them quickly later.
            </div>
          ) : (
            <div className="space-y-2">
              {bookmarks.map((bm) => (
                <div key={bm.id} className="rounded-[18px] bg-white/80 p-3 text-left">
                  <p className="text-xs text-slate-700 line-clamp-3 leading-5">{bm.content}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400">
                      {new Date(bm.created_at).toLocaleDateString()}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeleteBookmark(bm.id)}
                      className="text-slate-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* History tab */
          conversations.length === 0 ? (
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
          <header className="border-b px-4 py-4 sm:px-6" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="grid h-11 w-11 place-items-center rounded-2xl border lg:hidden"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--muted)' }}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="icon-shell h-12 w-12 shrink-0">
                  {document?.source_type === 'website' ? <Globe className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--muted-soft)' }}>
                    {document?.source_type === 'website' ? 'Website chat' : 'Document chat'}
                  </p>
                  <h1 className="truncate text-lg font-semibold sm:text-xl" style={{ color: 'var(--text)' }}>{document?.original_filename}</h1>
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                    {document?.source_type === 'website'
                      ? `${document?.page_count ? `${document.page_count} pages crawled` : 'Pages pending'}`
                      : `${document?.page_count ? `${document.page_count} pages` : 'Page count pending'}`}
                  </p>
                  {document?.source_type === 'website' && document?.source_url && (
                    <p className="truncate text-xs" style={{ color: 'var(--muted-soft)' }}>{document.source_url}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Status badges */}
                <div className="hidden sm:flex items-center gap-2">
                  {document?.persona?.name && document.persona.name !== 'Document Reader' && (
                    <span className="status-pill" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
                      {document.persona.name}
                    </span>
                  )}
                  <span className={`status-pill ${document?.status === 'ready' ? 'status-ready' : 'status-processing'}`}>
                    {document?.status === 'ready' ? 'Ready' : document?.status}
                  </span>
                </div>

                {/* Action toolbar — grouped in a pill */}
                <div className="flex items-center rounded-full border p-1 gap-0.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <button type="button" onClick={handleShare} disabled={!conversationId || messages.length === 0}
                    className="grid h-8 w-8 place-items-center rounded-full transition disabled:opacity-30" style={{ color: 'var(--muted)' }}
                    title="Share conversation">
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setPersonaOpen(true)}
                    className="grid h-8 w-8 place-items-center rounded-full transition" style={{ color: 'var(--muted)' }}
                    title="AI Persona">
                    <UserCog className="h-3.5 w-3.5" />
                  </button>
                  <div className="relative">
                    <button type="button" onClick={() => setExportOpen(!exportOpen)} disabled={!conversationId || messages.length === 0}
                      className="grid h-8 w-8 place-items-center rounded-full transition disabled:opacity-30" style={{ color: 'var(--muted)' }}
                      title="Export conversation">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {exportOpen && (
                      <>
                        <button type="button" className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                        <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-2xl border p-2 shadow-xl" style={{ borderColor: 'var(--border)', background: 'var(--surface-strong)' }}>
                          <button onClick={() => handleExport('md')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition hover:opacity-80" style={{ color: 'var(--text)' }}>
                            Markdown (.md)
                          </button>
                          <button onClick={() => handleExport('json')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition hover:opacity-80" style={{ color: 'var(--text)' }}>
                            JSON (.json)
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="chat-scroll flex-1 px-4 py-5 sm:px-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="icon-shell h-16 w-16">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="mt-6 font-display text-3xl text-slate-950">
                  {document?.source_type === 'website' ? 'Ask about this website' : 'Ask about this document'}
                </h2>

                {/* Auto-generated summary */}
                {document?.auto_summary && (
                  <div className="mt-5 max-w-2xl w-full">
                    <div className="soft-card p-5 text-left">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">Summary</p>
                      <p className="text-sm leading-7 text-slate-700">{document.auto_summary}</p>
                    </div>
                  </div>
                )}

                {/* Auto-generated FAQ */}
                {document?.auto_faq?.length > 0 ? (
                  <div className="mt-5 grid w-full max-w-2xl gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 text-left">Suggested questions</p>
                    {document.auto_faq.map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => submitMessage(item.q)}
                        className="soft-card px-5 py-3 text-left text-sm font-medium leading-6 text-slate-700 hover:-translate-y-0.5 hover:text-slate-950"
                      >
                        {item.q}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                      {document?.source_type === 'website'
                        ? 'Ask about any page, topic, or detail from the crawled website.'
                        : 'Start with a summary, key risks, next steps, or any detail you want surfaced from the PDF.'}
                    </p>
                    <div className="mt-8 grid w-full max-w-2xl gap-3">
                      {(document?.source_type === 'website' ? websitePromptIdeas : pdfPromptIdeas).map((idea) => (
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
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-5">
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
                        onPageClick={document?.source_type !== 'website' ? (pageNum) => setPageViewerState({ pageNum }) : undefined}
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
          onClose={() => setPageViewerState(null)}
          onPageChange={(num) => setPageViewerState({ pageNum: num })}
        />
      )}
    </div>
  )
}
