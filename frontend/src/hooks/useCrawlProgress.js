import { useCallback, useEffect, useRef, useState } from 'react'
import { createCrawlProgressWS } from '../api/websites'

/**
 * Hook for real-time crawl progress via WebSocket.
 * Connects when docId is provided and status is "processing".
 */
export function useCrawlProgress(docId, enabled = false) {
  const [pages, setPages] = useState([])
  const [currentUrl, setCurrentUrl] = useState('')
  const [pageNum, setPageNum] = useState(0)
  const [totalUrls, setTotalUrls] = useState(0)
  const [phase, setPhase] = useState('') // sitemap | bfs | complete
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState(null)
  const wsRef = useRef(null)

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled || !docId) {
      disconnect()
      return
    }

    const ws = createCrawlProgressWS(docId)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'discovery':
            setPhase(msg.phase)
            setTotalUrls(msg.urls_found || 0)
            break
          case 'page_crawling':
            setCurrentUrl(msg.url)
            setPageNum(msg.page_num)
            setTotalUrls(msg.total)
            break
          case 'page_crawled':
            setPages(prev => [...prev, {
              url: msg.url,
              title: msg.title,
              success: true,
            }])
            setPageNum(msg.page_num)
            setTotalUrls(msg.total)
            break
          case 'page_failed':
            setPageNum(msg.page_num)
            break
          case 'crawl_complete':
            setIsComplete(true)
            setCurrentUrl('')
            break
          case 'error':
            setError(msg.message)
            break
          default:
            break
        }
      } catch {}
    }

    ws.onerror = () => setError('Connection lost')
    ws.onclose = () => {}

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [docId, enabled, disconnect])

  const reset = useCallback(() => {
    setPages([])
    setCurrentUrl('')
    setPageNum(0)
    setTotalUrls(0)
    setPhase('')
    setIsComplete(false)
    setError(null)
  }, [])

  return {
    pages,
    currentUrl,
    pageNum,
    totalUrls,
    phase,
    isComplete,
    error,
    disconnect,
    reset,
  }
}
