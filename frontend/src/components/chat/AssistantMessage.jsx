import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bookmark, BookmarkCheck, Volume2 } from 'lucide-react'

function ThinkingDots({ compact = false }) {
  return (
    <span className={`chat-thinking-dots ${compact ? 'chat-thinking-dots-compact' : ''}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

// Parse [Page X] references and make them clickable
function AnnotatedContent({ content, onPageClick }) {
  if (!content || !onPageClick) {
    return <ReactMarkdown>{content}</ReactMarkdown>
  }

  // Split on [Page X] pattern
  const parts = content.split(/(\[Page \d+\])/g)

  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => {
          // Process text children to find [Page X] references
          const processChildren = (child) => {
            if (typeof child !== 'string') return child
            const segments = child.split(/(\[Page \d+\])/g)
            return segments.map((segment, i) => {
              const match = segment.match(/\[Page (\d+)\]/)
              if (match) {
                const pageNum = parseInt(match[1])
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPageClick(pageNum) }}
                    className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold transition hover:-translate-y-0.5 mx-0.5"
                    style={{
                      borderColor: 'var(--teal-soft)',
                      background: 'var(--teal-soft)',
                      color: 'var(--teal)',
                    }}
                  >
                    Page {pageNum}
                  </button>
                )
              }
              return segment
            })
          }

          return (
            <p>
              {Array.isArray(children)
                ? children.map((child, i) => <span key={i}>{processChildren(child)}</span>)
                : processChildren(children)}
            </p>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export default function AssistantMessage({
  content,
  icon,
  isStreaming = false,
  isSpeaking = false,
  pendingLabel = 'Reading the document',
  onBookmark,
  isBookmarked = false,
  onPageClick,
}) {
  const [bookmarked, setBookmarked] = useState(isBookmarked)
  const Icon = icon
  const hasContent = Boolean(content?.trim())

  const handleBookmark = () => {
    setBookmarked(!bookmarked)
    onBookmark?.(!bookmarked)
  }

  return (
    <div className="group flex max-w-[92%] gap-3 sm:max-w-[85%]">
      <div className={`icon-shell mt-1 h-10 w-10 shrink-0 ${isStreaming ? 'chat-avatar-live' : ''}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="soft-card relative rounded-[24px] px-5 py-4 text-sm shadow-none">
        {/* Bookmark button (on hover) */}
        {hasContent && !isStreaming && onBookmark && (
          <button
            type="button"
            onClick={handleBookmark}
            className={`absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-xl transition ${
              bookmarked
                ? 'text-amber-500'
                : 'text-transparent group-hover:text-[var(--muted-soft)] hover:!text-amber-500'
            }`}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark this answer'}
          >
            {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        )}

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
            <AnnotatedContent content={content} onPageClick={onPageClick} />
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
