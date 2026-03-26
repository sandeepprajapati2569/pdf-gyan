import {
  AudioWaveform,
  Loader2,
  Mic,
  MicOff,
  MessageSquareText,
  Send,
  VolumeX,
} from 'lucide-react'

export default function ChatComposer({
  input,
  onInputChange,
  onSubmit,
  placeholder,
  streaming,
  talkModeEnabled,
  talkModeAvailable,
  recognitionSupported,
  speechSupported,
  isListening,
  isSpeaking,
  voiceEngine,
  onToggleTalkMode,
  onToggleListening,
  onStopSpeaking,
  // Voice note props
  voiceNoteRecording = false,
  voiceNoteTranscribing = false,
  onToggleVoiceNote,
}) {
  const talkPlaceholder = isListening
    ? 'Listening... say your question naturally'
    : voiceNoteRecording
    ? 'Recording voice note... tap mic to stop'
    : voiceNoteTranscribing
    ? 'Transcribing your voice note...'
    : placeholder

  const talkToggleTitle = talkModeEnabled
    ? 'Switch back to chat mode'
    : recognitionSupported && speechSupported
    ? 'Hands-free questions with spoken answers.'
    : recognitionSupported
      ? 'Hands-free questions through your microphone.'
      : 'Spoken answers are ready.'

  return (
    <div className="border-t px-4 py-3 sm:px-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-soft)' }}>
      <div className="chat-composer-stack">
        <form onSubmit={onSubmit} className="chat-composer-row chat-composer-row-compact">
          <input
            type="text"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={talkModeEnabled ? talkPlaceholder : voiceNoteRecording ? 'Recording...' : voiceNoteTranscribing ? 'Transcribing...' : placeholder}
            className={`field-input ${talkModeEnabled ? 'chat-input-talk' : ''} ${isListening ? 'chat-input-listening' : ''} ${voiceNoteRecording ? 'chat-input-listening' : ''}`}
            disabled={streaming || voiceNoteTranscribing}
            title={talkModeEnabled ? 'Press Enter to send a typed message while talk mode is on' : undefined}
          />

          <div className="chat-composer-actions">
            {/* Voice note button (when not in talk mode) */}
            {!talkModeEnabled && onToggleVoiceNote && (
              <button
                type="button"
                onClick={onToggleVoiceNote}
                disabled={streaming || voiceNoteTranscribing}
                title={voiceNoteRecording ? 'Stop recording' : 'Record voice note'}
                className={`talk-mode-icon-btn ${voiceNoteRecording ? 'talk-mode-icon-btn-live' : ''}`}
              >
                {voiceNoteTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : voiceNoteRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTalkMode}
              disabled={!talkModeAvailable}
              title={talkToggleTitle}
              aria-label={talkModeEnabled ? 'Switch back to chat mode' : 'Turn talk mode on'}
              className={`talk-mode-icon-btn ${talkModeEnabled ? 'talk-mode-icon-btn-active' : ''}`}
            >
              {talkModeEnabled ? <MessageSquareText className="h-4 w-4" /> : <AudioWaveform className="h-4 w-4" />}
              <span className={`talk-mode-dot ${talkModeEnabled ? 'talk-mode-dot-active' : ''}`} aria-hidden="true" />
            </button>

            {talkModeEnabled && recognitionSupported ? (
              <button
                type="button"
                onClick={onToggleListening}
                disabled={streaming}
                title={isListening ? 'Stop listening' : 'Start listening'}
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
                className={`talk-mode-icon-btn ${isListening ? 'talk-mode-icon-btn-live' : ''}`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            ) : null}

            {talkModeEnabled && isSpeaking ? (
              <button
                type="button"
                onClick={onStopSpeaking}
                title="Stop spoken reply"
                aria-label="Stop spoken reply"
                className="talk-mode-icon-btn"
              >
                <VolumeX className="h-4 w-4" />
              </button>
            ) : null}

            {!talkModeEnabled ? (
              <button type="submit" disabled={!input.trim() || streaming || voiceNoteRecording || voiceNoteTranscribing} className="btn-primary shrink-0 px-4 sm:px-5">
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
            ) : null}
          </div>
        </form>

        {talkModeEnabled && (isListening || isSpeaking) ? (
          <div className="talk-mode-status-line talk-mode-status-line-compact">
            <span
              className={`talk-mode-chip ${isListening || isSpeaking ? 'talk-mode-chip-live' : ''}`}
              title={isListening ? 'Listening for your next question' : 'Reading the answer aloud'}
            >
              {isListening ? 'Listening' : 'Speaking'}
            </span>
            {isSpeaking && voiceEngine === 'ai' ? (
              <span className="talk-mode-chip" title="AI-generated voice">
                AI voice
              </span>
            ) : null}
          </div>
        ) : null}

        {voiceNoteRecording && (
          <div className="talk-mode-status-line talk-mode-status-line-compact">
            <span className="talk-mode-chip talk-mode-chip-live">
              Recording voice note
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
