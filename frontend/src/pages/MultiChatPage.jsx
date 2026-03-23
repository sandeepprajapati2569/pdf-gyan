import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Files,
  Loader2,
  Menu,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { getDocument } from '../api/documents'
import { sendMultiMessage, getMultiChatHistory, getConversation, readChatStream } from '../api/chat'
import toast from 'react-hot-toast'
import AssistantMessage from '../components/chat/AssistantMessage'
import ChatComposer from '../components/chat/ChatComposer'
import { useTalkMode } from '../hooks/useTalkMode'
import { useAuth } from '../context/useAuth'

const conversationDate = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
})

const multiPromptIdeas = [
  'Compare the main recommendations across these documents.',
  'Create a concise side-by-side summary with the biggest differences.',
]

const historyStorageKey = (docsParam) => `pdf-gyan:last-multi-chat:${docsParam}`

export default function MultiChatPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef(null)
  const restoredConversationRef = useRef(false)
  const submitMessageRef = useRef(null)

  const docsParam = searchParams.get('docs') || ''
  const docIds = docsParam.split(',').filter(Boolean)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const ids = docsParam.split(',').filter(Boolean)
      const docs = await Promise.all(ids.map((id) => getDocument(id)))
      setDocuments(docs.map((res) => res.data))
    } catch {
      toast.error('Failed to load documents')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [docsParam, navigate])

  const loadConversations = useCallback(async () => {
    try {
      const res = await getMultiChatHistory()
      const nextConversations = res.data || []
      setConversations(nextConversations)
      return nextConversations
    } catch {
      setConversations([])
      return []
    }
  }, [])

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

  useEffect(() => {
    if (docIds.length < 2) {
      navigate('/dashboard')
      return
    }

    stopListening()
    stopSpeaking()
    setMessages([])
    setConversationId(null)
    restoredConversationRef.current = false
    loadDocuments()
    loadConversations()
  }, [docIds.length, docsParam, loadConversations, loadDocuments, navigate, stopListening, stopSpeaking])

  const loadConversation = useCallback(async (convId) => {
    try {
      stopSpeaking()
      stopListening()
      const res = await getConversation(convId)
      setMessages(res.data.messages || [])
      setConversationId(convId)
      localStorage.setItem(historyStorageKey(docsParam), convId)
      setSidebarOpen(false)
    } catch {
      toast.error('Failed to load conversation')
    }
  }, [docsParam, stopListening, stopSpeaking])

  const startNewChat = () => {
    stopSpeaking()
    stopListening()
    setMessages([])
    setConversationId(null)
    localStorage.removeItem(historyStorageKey(docsParam))
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Multi-document history</p>
      </div>

      <div className="chat-scroll flex-1 px-3 pb-3 pt-3">
        {conversations.length === 0 ? (
          <div className="soft-card p-4 text-sm leading-6 text-slate-500">
            Your cross-document threads will appear here after the first question.
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
                  <Files className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{conv.title}</p>
                  <p className={`mt-1 text-xs ${conversationId === conv.id ? 'text-slate-300' : 'text-slate-400'}`}>
                    {conv.document_ids?.length || 0} docs · {conversationDate.format(new Date(conv.created_at))}
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

    const lastConversationId = localStorage.getItem(historyStorageKey(docsParam))
    const conversationToRestore =
      conversations.find((conv) => conv.id === lastConversationId) || conversations[0]

    if (!conversationToRestore) {
      restoredConversationRef.current = true
      return
    }

    restoredConversationRef.current = true
    loadConversation(conversationToRestore.id)
  }, [conversations, docsParam, loadConversation])

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
      const response = await sendMultiMessage(docIds, userMessage, conversationId)
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
            localStorage.setItem(historyStorageKey(docsParam), match[1])
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
    docIds,
    docsParam,
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
          <header className="border-b border-slate-200/80 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-600 lg:hidden"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <div className="icon-shell h-12 w-12 shrink-0">
                    <Files className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Multi-document chat</p>
                    <h1 className="truncate text-lg font-semibold text-slate-950 sm:text-xl">
                      Compare answers across {documents.length} PDFs
                    </h1>
                  </div>
                </div>

                <span className="status-pill status-ready sm:shrink-0">{documents.length} documents selected</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {documents.slice(0, 3).map((doc) => (
                  <span
                    key={doc.id}
                    title={doc.original_filename}
                    className="soft-pill max-w-full overflow-hidden text-ellipsis whitespace-nowrap bg-white/70 text-slate-600 sm:max-w-[20rem]"
                  >
                    {doc.original_filename}
                  </span>
                ))}
                {documents.length > 3 && (
                  <span className="soft-pill bg-white/70 text-slate-600">+ {documents.length - 3} more</span>
                )}
              </div>
            </div>
          </header>

          <div className="chat-scroll flex-1 px-4 py-5 sm:px-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="icon-shell h-16 w-16">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="mt-6 font-display text-3xl text-slate-950">Ask across multiple sources</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Use this view to compare findings, align recommendations, and surface the important differences across your selected files.
                </p>

                <div className="mt-8 grid w-full max-w-2xl gap-3">
                  {multiPromptIdeas.map((idea) => (
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
                        icon={Files}
                        content={msg.content}
                        isStreaming={streaming && index === messages.length - 1}
                        isSpeaking={isSpeaking && index === messages.length - 1}
                        pendingLabel="Comparing the selected documents"
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
            placeholder="Ask for patterns, differences, overlaps, or summaries across all selected documents..."
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
          />
        </section>
      </div>
    </div>
  )
}
