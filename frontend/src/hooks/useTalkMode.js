import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createSpeechAudio } from '../api/tts'

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function normalizeSpeechText(content) {
  return (content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/---\s*Page\s+(\d+)\s*---/gi, ' Page $1. ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitIntoSpeechChunks(content, maxLength = 220) {
  const text = normalizeSpeechText(content)
  if (!text) return []

  const sentences = text.match(/[^.!?]+[.!?]?/g) || [text]
  const chunks = []
  let currentChunk = ''

  for (const sentence of sentences) {
    const nextSentence = sentence.trim()
    if (!nextSentence) continue

    const candidate = currentChunk ? `${currentChunk} ${nextSentence}` : nextSentence
    if (candidate.length <= maxLength) {
      currentChunk = candidate
      continue
    }

    if (currentChunk) {
      chunks.push(currentChunk)
    }

    if (nextSentence.length <= maxLength) {
      currentChunk = nextSentence
      continue
    }

    for (let index = 0; index < nextSentence.length; index += maxLength) {
      chunks.push(nextSentence.slice(index, index + maxLength))
    }
    currentChunk = ''
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks
}

function findSoftBoundary(content, start, end) {
  for (let index = end - 1; index > start; index -= 1) {
    if (/[,:;\n]/.test(content[index])) {
      return index + 1
    }
  }

  for (let index = end - 1; index > start; index -= 1) {
    if (/\s/.test(content[index])) {
      return index
    }
  }

  return -1
}

function extractCompletedSpeechChunks(content, flush = false, maxLength = 220) {
  if (!content) {
    return { chunks: [], remainder: '' }
  }

  const chunks = []
  let cursor = 0
  let lastBoundary = -1

  const pushSegment = (start, end) => {
    if (end <= start) return
    chunks.push(...splitIntoSpeechChunks(content.slice(start, end), maxLength))
  }

  for (let index = 0; index < content.length; index += 1) {
    const currentChar = content[index]
    const nextChar = content[index + 1] || ''
    const isSentenceBoundary = /[.!?]/.test(currentChar) && (!nextChar || /\s/.test(nextChar))
    const isLineBoundary = currentChar === '\n' && (!nextChar || nextChar === '\n')
    const isColonBoundary = currentChar === ':' && /\s/.test(nextChar)

    if (isSentenceBoundary || isLineBoundary || isColonBoundary) {
      lastBoundary = isLineBoundary && nextChar === '\n' ? index + 2 : index + 1
    }

    const segmentLength = index + 1 - cursor
    if (segmentLength < maxLength) {
      continue
    }

    const boundary = lastBoundary > cursor ? lastBoundary : findSoftBoundary(content, cursor, index + 1)
    if (boundary <= cursor) {
      continue
    }

    pushSegment(cursor, boundary)
    cursor = boundary
    lastBoundary = -1
  }

  let remainder = content.slice(cursor)

  if (!flush && lastBoundary > cursor) {
    const candidate = normalizeSpeechText(content.slice(cursor, lastBoundary))
    if (candidate.length >= 64) {
      pushSegment(cursor, lastBoundary)
      remainder = content.slice(lastBoundary)
    }
  }

  if (flush) {
    pushSegment(cursor, content.length)
    remainder = ''
  }

  return { chunks, remainder }
}

function pickPreferredBrowserVoice(voices) {
  if (!voices?.length) return null

  const englishVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'))
  const pool = englishVoices.length ? englishVoices : voices
  const priorities = [
    /google.*english/i,
    /microsoft.*(aria|jenny|guy|natasha|ryan|natural)/i,
    /samantha/i,
    /daniel/i,
    /serena/i,
    /zira/i,
    /natural/i,
  ]

  for (const pattern of priorities) {
    const preferred = pool.find((voice) => pattern.test(voice.name))
    if (preferred) {
      return preferred
    }
  }

  return pool[0]
}

export function useTalkMode({
  onDraftChange,
  onSubmitMessage,
  busy = false,
  preferAiVoice = true,
}) {
  const [talkModeEnabled, setTalkModeEnabled] = useState(false)
  const [recognitionSupported] = useState(() => Boolean(getSpeechRecognitionCtor()))
  const [browserSpeechSupported] = useState(
    () =>
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window,
  )
  const [audioPlaybackSupported] = useState(
    () => typeof window !== 'undefined' && typeof window.Audio !== 'undefined',
  )
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [voiceEngine, setVoiceEngine] = useState(null)

  const speechSupported = browserSpeechSupported || (preferAiVoice && audioPlaybackSupported)

  const recognitionRef = useRef(null)
  const speechSynthesisRef = useRef(
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null,
  )
  const availableVoicesRef = useRef([])
  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)
  const ttsAbortControllerRef = useRef(null)
  const draftRef = useRef(onDraftChange)
  const submitRef = useRef(onSubmitMessage)
  const busyRef = useRef(busy)
  const talkModeEnabledRef = useRef(false)
  const preferAiVoiceRef = useRef(preferAiVoice)
  const finalTranscriptRef = useRef('')
  const liveTranscriptRef = useRef('')
  const suppressSubmitRef = useRef(false)
  const speechQueueRef = useRef([])
  const speechBufferRef = useRef('')
  const speechRunIdRef = useRef(0)
  const processingSpeechRef = useRef(false)
  const aiVoiceAllowedRef = useRef(preferAiVoice)
  const aiVoiceFallbackNotifiedRef = useRef(false)
  const browserSpeechFailureNotifiedRef = useRef(false)

  useEffect(() => {
    draftRef.current = onDraftChange
  }, [onDraftChange])

  useEffect(() => {
    submitRef.current = onSubmitMessage
  }, [onSubmitMessage])

  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  useEffect(() => {
    talkModeEnabledRef.current = talkModeEnabled
  }, [talkModeEnabled])

  useEffect(() => {
    preferAiVoiceRef.current = preferAiVoice
    aiVoiceAllowedRef.current = preferAiVoice
  }, [preferAiVoice])

  useEffect(() => {
    const synth = speechSynthesisRef.current
    if (!synth) return undefined

    const loadVoices = () => {
      availableVoicesRef.current = synth.getVoices?.() || []
    }

    loadVoices()

    if ('onvoiceschanged' in synth) {
      synth.onvoiceschanged = loadVoices
      return () => {
        if (synth.onvoiceschanged === loadVoices) {
          synth.onvoiceschanged = null
        }
      }
    }

    return undefined
  }, [])

  const cleanupAudio = useCallback(() => {
    const currentAudio = audioRef.current
    if (currentAudio) {
      currentAudio.onended = null
      currentAudio.onerror = null
      currentAudio.pause()
      audioRef.current = null
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }, [])

  useEffect(() => () => {
    recognitionRef.current?.abort()
    speechSynthesisRef.current?.cancel()
    ttsAbortControllerRef.current?.abort()
    cleanupAudio()
  }, [cleanupAudio])

  const stopSpeaking = useCallback(() => {
    speechRunIdRef.current += 1
    speechQueueRef.current = []
    speechBufferRef.current = ''
    processingSpeechRef.current = false
    aiVoiceAllowedRef.current = preferAiVoiceRef.current
    aiVoiceFallbackNotifiedRef.current = false
    browserSpeechFailureNotifiedRef.current = false
    ttsAbortControllerRef.current?.abort()
    ttsAbortControllerRef.current = null
    cleanupAudio()
    speechSynthesisRef.current?.cancel()
    setIsSpeaking(false)
    setVoiceEngine(null)
  }, [cleanupAudio])

  const stopListening = useCallback(() => {
    suppressSubmitRef.current = true
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  const finishListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const updateDraft = useCallback((value) => {
    liveTranscriptRef.current = value
    setLiveTranscript(value)
    draftRef.current?.(value)
  }, [])

  const toggleTalkMode = useCallback(() => {
    if (!recognitionSupported && !speechSupported) {
      toast.error('Talk mode is not supported in this browser.')
      return
    }

    setTalkModeEnabled((current) => {
      const nextValue = !current
      if (!nextValue) {
        stopListening()
        stopSpeaking()
        finalTranscriptRef.current = ''
        if (isListening) {
          updateDraft('')
        }
      }
      return nextValue
    })
  }, [isListening, recognitionSupported, speechSupported, stopListening, stopSpeaking, updateDraft])

  const startListening = useCallback(() => {
    if (!recognitionSupported) {
      toast.error('Voice input is not supported in this browser.')
      return
    }

    if (busyRef.current) {
      toast.error('Wait for the current answer to finish first.')
      return
    }

    stopSpeaking()

    const SpeechRecognitionCtor = getSpeechRecognitionCtor()
    if (!SpeechRecognitionCtor) {
      toast.error('Voice input is not available right now.')
      return
    }

    finalTranscriptRef.current = ''
    updateDraft('')

    const recognition = new SpeechRecognitionCtor()
    suppressSubmitRef.current = false
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      let nextFinalTranscript = finalTranscriptRef.current
      let interimTranscript = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript?.trim()
        if (!transcript) continue

        if (result.isFinal) {
          nextFinalTranscript = `${nextFinalTranscript} ${transcript}`.trim()
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim()
        }
      }

      finalTranscriptRef.current = nextFinalTranscript
      const combinedTranscript = `${nextFinalTranscript} ${interimTranscript}`.trim()
      updateDraft(combinedTranscript)
    }

    recognition.onerror = (event) => {
      setIsListening(false)

      if (event.error === 'aborted' || event.error === 'no-speech') {
        return
      }

      if (event.error === 'not-allowed') {
        toast.error('Microphone access was blocked. Please allow it to use talk mode.')
        return
      }

      toast.error('Voice capture ran into a problem. Please try again.')
    }

    recognition.onend = () => {
      setIsListening(false)
      const transcript = finalTranscriptRef.current.trim() || liveTranscriptRef.current.trim()
      const shouldSubmit = !suppressSubmitRef.current
      recognitionRef.current = null
      suppressSubmitRef.current = false

      if (transcript && shouldSubmit) {
        setLiveTranscript('')
        submitRef.current?.(transcript)
      } else {
        updateDraft('')
      }

      finalTranscriptRef.current = ''
      liveTranscriptRef.current = ''
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [recognitionSupported, stopSpeaking, updateDraft])

  const toggleListening = useCallback(() => {
    if (isListening) {
      finishListening()
      return
    }

    startListening()
  }, [finishListening, isListening, startListening])

  const playBrowserSpeechChunk = useCallback((content, runId) => {
    const synth = speechSynthesisRef.current
    if (!synth || typeof window === 'undefined' || !window.SpeechSynthesisUtterance) {
      return Promise.reject(new Error('Browser voice is not available'))
    }

    return new Promise((resolve, reject) => {
      const utterance = new window.SpeechSynthesisUtterance(content)
      const preferredVoice = pickPreferredBrowserVoice(availableVoicesRef.current)
      if (preferredVoice) {
        utterance.voice = preferredVoice
      }
      utterance.rate = 1
      utterance.pitch = 1
      utterance.onend = () => {
        if (speechRunIdRef.current === runId) {
          resolve()
          return
        }

        resolve()
      }
      utterance.onerror = () => reject(new Error('Browser voice playback failed'))
      synth.speak(utterance)
    })
  }, [])

  const playAiSpeechChunk = useCallback(async (content, runId) => {
    if (!audioPlaybackSupported || typeof window === 'undefined' || typeof window.Audio === 'undefined') {
      throw new Error('Audio playback is not available')
    }

    const controller = new AbortController()
    ttsAbortControllerRef.current = controller

    try {
      const audioBlob = await createSpeechAudio(content, controller.signal)
      if (speechRunIdRef.current !== runId) {
        return
      }

      cleanupAudio()
      const objectUrl = URL.createObjectURL(audioBlob)
      const audio = new window.Audio(objectUrl)
      audioRef.current = audio
      audioUrlRef.current = objectUrl

      await new Promise((resolve, reject) => {
        audio.onended = () => resolve()
        audio.onerror = () => reject(new Error('AI voice playback failed'))
        const playPromise = audio.play()
        if (playPromise) {
          playPromise.catch(reject)
        }
      })
    } finally {
      if (ttsAbortControllerRef.current === controller) {
        ttsAbortControllerRef.current = null
      }
      cleanupAudio()
    }
  }, [audioPlaybackSupported, cleanupAudio])

  const processSpeechQueue = useCallback(async () => {
    if (!talkModeEnabledRef.current || processingSpeechRef.current) return
    if (speechQueueRef.current.length === 0) return

    const runId = speechRunIdRef.current
    processingSpeechRef.current = true
    setIsSpeaking(true)

    try {
      while (
        talkModeEnabledRef.current &&
        speechRunIdRef.current === runId &&
        speechQueueRef.current.length > 0
      ) {
        const nextChunk = speechQueueRef.current.shift()
        if (!nextChunk) continue

        let usedAiVoice = false

        if (aiVoiceAllowedRef.current) {
          try {
            setVoiceEngine('ai')
            await playAiSpeechChunk(nextChunk, runId)
            usedAiVoice = true
          } catch (error) {
            if (error?.name === 'AbortError' || speechRunIdRef.current !== runId) {
              return
            }

            aiVoiceAllowedRef.current = false
            if (!aiVoiceFallbackNotifiedRef.current && browserSpeechSupported) {
              aiVoiceFallbackNotifiedRef.current = true
              toast.error('AI voice is unavailable right now, so we switched to the browser voice.')
            }
          }
        }

        if (usedAiVoice || speechRunIdRef.current !== runId) {
          continue
        }

        if (!browserSpeechSupported) {
          speechQueueRef.current = []
          setVoiceEngine(null)
          setIsSpeaking(false)
          if (!browserSpeechFailureNotifiedRef.current) {
            browserSpeechFailureNotifiedRef.current = true
            toast.error('Spoken replies are unavailable in this browser right now.')
          }
          return
        }

        setVoiceEngine('browser')
        await playBrowserSpeechChunk(nextChunk, runId)
      }
    } catch {
      setVoiceEngine(null)
      setIsSpeaking(false)
    } finally {
      processingSpeechRef.current = false
      if (speechRunIdRef.current === runId && speechQueueRef.current.length === 0) {
        setIsSpeaking(false)
        setVoiceEngine(null)
      }
    }
  }, [browserSpeechSupported, playAiSpeechChunk, playBrowserSpeechChunk])

  const queueSpeechChunks = useCallback((content, flush = false) => {
    if (!talkModeEnabledRef.current) return

    const nextBuffer = `${speechBufferRef.current}${content || ''}`
    const { chunks, remainder } = extractCompletedSpeechChunks(nextBuffer, flush)
    speechBufferRef.current = remainder

    if (chunks.length === 0) return

    speechQueueRef.current.push(...chunks)
    void processSpeechQueue()
  }, [processSpeechQueue])

  const beginStreamingSpeech = useCallback(() => {
    if (!talkModeEnabledRef.current) return
    stopSpeaking()
    speechBufferRef.current = ''
    speechQueueRef.current = []
    aiVoiceAllowedRef.current = preferAiVoiceRef.current
    aiVoiceFallbackNotifiedRef.current = false
    browserSpeechFailureNotifiedRef.current = false
  }, [stopSpeaking])

  const appendStreamingSpeechChunk = useCallback((content) => {
    queueSpeechChunks(content, false)
  }, [queueSpeechChunks])

  const finishStreamingSpeech = useCallback(() => {
    const remainder = speechBufferRef.current
    speechBufferRef.current = ''
    queueSpeechChunks(remainder, true)
  }, [queueSpeechChunks])

  return {
    talkModeEnabled,
    recognitionSupported,
    speechSupported,
    isListening,
    isSpeaking,
    voiceEngine,
    liveTranscript,
    toggleTalkMode,
    toggleListening,
    stopListening,
    stopSpeaking,
    beginStreamingSpeech,
    appendStreamingSpeechChunk,
    finishStreamingSpeech,
  }
}
