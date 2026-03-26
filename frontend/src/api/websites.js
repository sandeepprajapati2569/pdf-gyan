import client from './client'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const WS_BASE = API_BASE.replace(/^http/, 'ws')

export const crawlWebsite = (data) =>
  client.post('/api/websites/crawl', data)

export const recrawlWebsite = (docId) =>
  client.post(`/api/websites/${docId}/recrawl`)

export const getWebsitePages = (docId, params = {}) =>
  client.get(`/api/websites/${docId}/pages`, { params })

export const updateWebsitePages = (docId, pages) =>
  client.patch(`/api/websites/${docId}/pages`, { pages })

export const addWebsitePage = (docId, url) =>
  client.post(`/api/websites/${docId}/pages/add`, { url })

export const indexWebsite = (docId) =>
  client.post(`/api/websites/${docId}/index`)

export const crawlMorePages = (docId, batchSize = 50, category = null) => {
  const params = { batch_size: batchSize }
  if (category) params.category = category
  return client.post(`/api/websites/${docId}/crawl-more`, null, { params })
}

export const bulkUpdatePages = (docId, action, category = null, status = null) => {
  const params = { action }
  if (category) params.category = category
  if (status) params.status = status
  return client.patch(`/api/websites/${docId}/pages/bulk`, null, { params })
}

export const createCrawlProgressWS = (docId) => {
  const token = localStorage.getItem('token')
  return new WebSocket(`${WS_BASE}/api/websites/${docId}/progress?token=${encodeURIComponent(token)}`)
}
