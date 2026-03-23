import ReactMarkdown from 'react-markdown'
import { Volume2 } from 'lucide-react'

function ThinkingDots({ compact = false }) {
  return (
    <span className={`chat-thinking-dots ${compact ? 'chat-thinking-dots-compact' : ''}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

export default function AssistantMessage({
  content,
  icon,
  isStreaming = false,
  isSpeaking = false,
  pendingLabel = 'Reading the document',
}) {
  const Icon = icon
  const hasContent = Boolean(content?.trim())

  return (
    <div className="flex max-w-[92%] gap-3 sm:max-w-[85%]">
      <div className={`icon-shell mt-1 h-10 w-10 shrink-0 ${isStreaming ? 'chat-avatar-live' : ''}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="soft-card rounded-[24px] px-5 py-4 text-sm shadow-none">
        {isStreaming ? (
          <div className="chat-live-indicator">
            <ThinkingDots compact />
            <span>{hasContent ? 'Answering live' : pendingLabel}</span>
          </div>
        ) : null}

        {isSpeaking ? (
          <div className="chat-live-indicator chat-live-indicator-speaking">
            <Volume2 className="h-3.5 w-3.5" />
            <span>Speaking aloud</span>
          </div>
        ) : null}

        {hasContent ? (
          <div className="markdown-response">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="chat-thinking-empty">
            <ThinkingDots />
            <p>{pendingLabel}</p>
          </div>
        )}
      </div>
    </div>
  )
}
