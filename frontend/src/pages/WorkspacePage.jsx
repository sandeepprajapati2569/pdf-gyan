import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  ArrowLeft, ArrowUpDown, ChevronRight, FileSpreadsheet, FileText, Folder, FolderOpen,
  FolderPlus, Globe, Loader2, Lock, MessageSquareText, MoreHorizontal, Move, Pencil,
  Plus, Presentation, Search, Send, Shield, Sparkles, Trash2, Upload, Users, X,
} from 'lucide-react'
import client from '../api/client'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import AccessModal from '../components/workspace/AccessModal'

const FILE_ICONS = { pdf: FileText, xlsx: FileSpreadsheet, pptx: Presentation, docx: FileText, txt: FileText }

const ACCESS_BADGE = {
  workspace: null, // no badge for default
  shared: { icon: Users, color: '#6366f1', label: 'Shared' },
  private: { icon: Lock, color: '#f59e0b', label: 'Private' },
}
const FILE_COLORS = { pdf: '#ef4444', xlsx: '#22c55e', pptx: '#f97316', docx: '#3b82f6', txt: '#8b5cf6' }
const FOLDER_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt', '.csv', '.md'],
}

export default function WorkspacePage() {
  // File manager state
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [breadcrumb, setBreadcrumb] = useState([])
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Sort & filter
  const [sortBy, setSortBy] = useState('folders-first')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  // Modals
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0])
  const [contextMenu, setContextMenu] = useState(null) // {x, y} for right-click on body
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [moveTarget, setMoveTarget] = useState(null) // {type:'file'|'folder', id}
  const [accessTarget, setAccessTarget] = useState(null) // {type:'file'|'folder', id, name, access}
  const [allFolders, setAllFolders] = useState([])
  const [moveDestination, setMoveDestination] = useState(null)

  // Chat state
  const [chatOpen, setChatOpen] = useState(false)
  const [chatScope, setChatScope] = useState('workspace') // 'workspace'|'folder'|fileId
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const chatEndRef = useRef(null)

  // ── Load folder contents ──
  const loadContents = useCallback(async () => {
    setLoading(true)
    try {
      const params = currentFolderId ? { parent_id: currentFolderId } : {}
      const res = await client.get('/api/workspace/folders', { params })
      setFolders(res.data.folders || [])
      setFiles(res.data.files || [])
      setBreadcrumb(res.data.path || [])
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [currentFolderId])

  useEffect(() => { loadContents() }, [loadContents])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Navigate ──
  const navigateTo = (folderId) => {
    setCurrentFolderId(folderId)
    setContextMenu(null)
  }

  // ── Upload ──
  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return
    setUploading(true)
    for (const file of acceptedFiles) {
      try {
        const form = new FormData()
        form.append('file', file)
        if (currentFolderId) form.append('folder_id', currentFolderId)
        await client.post('/api/workspace/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        toast.success(`Uploaded ${file.name}`)
      } catch (err) {
        console.error('Upload error:', err.response?.data || err)
        const d = err.response?.data?.detail
        toast.error(typeof d === 'string' ? d : Array.isArray(d) ? d.map(e => e.msg || '').join(', ') : `Failed: ${file.name}`)
      }
    }
    setUploading(false)
    loadContents()
  }, [currentFolderId, loadContents])

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({ onDrop, accept: ACCEPT, multiple: true, noClick: true })

  // ── Folder CRUD ──
  const handleCreateFolder = async (e) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    try {
      await client.post('/api/workspace/folders', { name: newFolderName, parent_id: currentFolderId, color: newFolderColor })
      setNewFolderOpen(false); setNewFolderName(''); loadContents()
    } catch { toast.error('Failed to create folder') }
  }

  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return
    try {
      await client.patch(`/api/workspace/folders/${renameTarget.id}`, { name: renameName })
      setRenameTarget(null); loadContents()
    } catch { toast.error('Rename failed') }
  }

  const handleDelete = async (type, id, name) => {
    if (!confirm(`Delete "${name}"${type === 'folder' ? ' and all its contents' : ''}?`)) return
    try {
      if (type === 'folder') await client.delete(`/api/workspace/folders/${id}`)
      else await client.delete(`/api/workspace/files/${id}`)
      toast.success('Deleted'); loadContents()
    } catch { toast.error('Delete failed') }
    setContextMenu(null)
  }

  const handleMove = async () => {
    if (!moveTarget) return
    try {
      if (moveTarget.type === 'file') await client.post(`/api/workspace/files/${moveTarget.id}/move`, { folder_id: moveDestination })
      else await client.patch(`/api/workspace/folders/${moveTarget.id}`, { parent_id: moveDestination || "__unchanged__" })
      setMoveTarget(null); loadContents(); toast.success('Moved')
    } catch { toast.error('Move failed') }
  }

  const openMoveModal = async (type, id) => {
    setMoveTarget({ type, id }); setContextMenu(null)
    try { const res = await client.get('/api/workspace/folders/tree'); setAllFolders(res.data || []) }
    catch { setAllFolders([]) }
  }

  // ── Chat ──
  const sendMessage = async (e) => {
    e?.preventDefault()
    const msg = chatInput.trim()
    if (!msg || streaming) return
    setChatInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }, { role: 'assistant', content: '' }])
    setStreaming(true)

    const body = { message: msg, conversation_id: conversationId }
    if (chatScope === 'folder' && currentFolderId) body.folder_id = currentFolderId
    else if (chatScope !== 'workspace' && chatScope !== 'folder') body.file_id = chatScope

    try {
      const response = await fetch(
        `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000')}/api/workspace/chat`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(body) },
      )
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          if (data.includes('<!--conv_id:')) { const m = data.match(/<!--conv_id:(.+?)-->/); if (m) setConversationId(m[1]); continue }
          content += data
          setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content }; return u })
        }
      }
    } catch { toast.error('Chat failed'); setMessages(prev => prev.slice(0, -1)) }
    finally { setStreaming(false) }
  }

  const startChat = (scope) => { setChatScope(scope); setMessages([]); setConversationId(null); setChatOpen(true) }

  // ── Drag item into folder ──
  const [dragItem, setDragItem] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  const handleDragStart = (type, id) => setDragItem({ type, id })
  const handleDragEnd = async () => {
    if (dragItem && dropTarget && dragItem.id !== dropTarget) {
      try {
        if (dragItem.type === 'file') await client.post(`/api/workspace/files/${dragItem.id}/move`, { folder_id: dropTarget })
        else await client.patch(`/api/workspace/folders/${dragItem.id}`, { parent_id: dropTarget })
        toast.success('Moved'); loadContents()
      } catch { toast.error('Move failed') }
    }
    setDragItem(null); setDropTarget(null)
  }

  // ── Right-click context menu ──
  const contentRef = useRef(null)
  const handleContextMenu = (e, item = null) => {
    e.preventDefault()
    e.stopPropagation()
    const menuW = 192, menuH = 340
    const x = Math.min(Math.max(e.clientX - 4, 8), window.innerWidth - menuW - 16)
    const y = Math.min(Math.max(e.clientY - 4, 8), window.innerHeight - menuH - 16)
    setContextMenu({ x, y, item })
  }

  // ── Sort + merge items ──
  const allItems = [
    ...folders.map(f => ({ ...f, _kind: 'folder', _name: f.name, _date: f.created_at })),
    ...files.map(f => ({ ...f, _kind: 'file', _name: f.original_filename, _date: f.created_at })),
  ]

  const sortedItems = [...allItems].sort((a, b) => {
    if (sortBy === 'folders-first') return a._kind === b._kind ? 0 : a._kind === 'folder' ? -1 : 1
    if (sortBy === 'files-first') return a._kind === b._kind ? 0 : a._kind === 'file' ? -1 : 1
    if (sortBy === 'newest') return new Date(b._date || 0) - new Date(a._date || 0)
    if (sortBy === 'oldest') return new Date(a._date || 0) - new Date(b._date || 0)
    if (sortBy === 'name-asc') return (a._name || '').localeCompare(b._name || '')
    if (sortBy === 'name-desc') return (b._name || '').localeCompare(a._name || '')
    return 0
  })

  const totalItems = folders.length + files.length
  const scopeLabel = chatScope === 'workspace' ? 'Entire Workspace' : chatScope === 'folder' ? (breadcrumb.length ? breadcrumb.map(b => b.name).join('/') : 'Root') : files.find(f => f.id === chatScope)?.original_filename || 'File'

  return (
    <div className="page-shell max-w-[1520px] py-0 h-[calc(100vh-var(--app-header-offset,0px))]" {...getRootProps({ onClick: (e) => e.stopPropagation() })}>
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/20 backdrop-blur-sm">
          <div className="premium-card p-10 text-center">
            <Upload className="mx-auto h-10 w-10" style={{ color: 'var(--teal)' }} />
            <p className="mt-3 text-lg font-bold" style={{ color: 'var(--text)' }}>Drop files here</p>
            <p className="text-xs" style={{ color: 'var(--muted-soft)' }}>Files will be added to the current folder</p>
          </div>
        </div>
      )}

      <div className={`h-full flex flex-col lg:flex-row gap-0 ${chatOpen ? '' : ''}`}>

        {/* ════ FILE MANAGER ════ */}
        <div className={`premium-card flex flex-col h-full overflow-hidden ${chatOpen ? 'lg:w-[55%]' : 'w-full'} transition-all`}>

          {/* Header */}
          <div className="border-b px-5 py-4 flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-3">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1 text-sm min-w-0 flex-1 overflow-hidden">
                <button onClick={() => navigateTo(null)} className="shrink-0 font-semibold transition hover:text-[var(--teal)]" style={{ color: currentFolderId ? 'var(--muted-soft)' : 'var(--text)' }}>
                  Workspace
                </button>
                {breadcrumb.map(b => (
                  <span key={b.id} className="flex items-center gap-1 min-w-0">
                    <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--muted-soft)' }} />
                    <button onClick={() => navigateTo(b.id)} className="truncate font-medium transition hover:text-[var(--teal)]" style={{ color: 'var(--text)' }}>
                      {b.name}
                    </button>
                  </span>
                ))}
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Sort button */}
                <div className="relative">
                  <button onClick={() => setSortMenuOpen(!sortMenuOpen)}
                    className="btn-ghost text-xs !gap-1.5" title="Sort">
                    <ArrowUpDown className="h-3 w-3" /> Sort
                  </button>
                  {sortMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSortMenuOpen(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border p-1 shadow-xl"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface-strong)' }}>
                        {[
                          { value: 'folders-first', label: 'Folders first' },
                          { value: 'files-first', label: 'Files first' },
                          { value: 'newest', label: 'Newest first' },
                          { value: 'oldest', label: 'Oldest first' },
                          { value: 'name-asc', label: 'Name A → Z' },
                          { value: 'name-desc', label: 'Name Z → A' },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => { setSortBy(opt.value); setSortMenuOpen(false) }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-white/60"
                            style={{ color: sortBy === opt.value ? 'var(--teal)' : 'var(--muted)' }}>
                            {sortBy === opt.value && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--teal)' }} />}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => setNewFolderOpen(true)} className="btn-ghost text-xs" title="New folder"><FolderPlus className="h-3.5 w-3.5" /> Folder</button>
                <button onClick={openFilePicker} className="btn-ghost text-xs" title="Upload files"><Upload className="h-3.5 w-3.5" /> Upload</button>
                <button onClick={() => chatOpen ? setChatOpen(false) : startChat(currentFolderId ? 'folder' : 'workspace')}
                  className={`btn-ghost text-xs ${chatOpen ? 'text-[var(--teal)]' : ''}`}>
                  <MessageSquareText className="h-3.5 w-3.5" /> Chat
                </button>
              </div>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--teal)' }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
              </div>
            )}
          </div>

          {/* Content — right-click enabled */}
          <div className="flex-1 overflow-y-auto p-4" onContextMenu={handleContextMenu} onClick={() => setContextMenu(null)}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--teal)' }} />
              </div>
            ) : totalItems === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FolderOpen className="h-12 w-12" style={{ color: 'var(--muted-soft)' }} />
                <p className="mt-4 text-sm font-medium" style={{ color: 'var(--muted)' }}>This folder is empty</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-soft)' }}>Upload files, create a folder, or right-click for options.</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={openFilePicker} className="btn-primary text-xs"><Upload className="h-3.5 w-3.5" /> Upload</button>
                  <button onClick={() => setNewFolderOpen(true)} className="btn-ghost text-xs"><FolderPlus className="h-3.5 w-3.5" /> New Folder</button>
                </div>
              </div>
            ) : (
              <div>
                {/* Back button */}
                {currentFolderId && (
                  <button onClick={() => navigateTo(breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null)}
                    className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition hover:bg-white/60"
                    style={{ color: 'var(--muted-soft)' }}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                )}

                {/* Mixed grid — responsive columns, fewer when chat is open */}
                <div className={`grid gap-3 ${chatOpen
                  ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                }`} style={{ gridTemplateColumns: chatOpen ? undefined : undefined }}>
                  {sortedItems.map(item => {
                    if (item._kind === 'folder') {
                      const clr = item.color || FOLDER_COLORS[0]
                      const isDropping = dropTarget === item.id
                      return (
                        <div key={`f-${item.id}`}
                          draggable
                          onDragStart={() => handleDragStart('folder', item.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => { e.preventDefault(); setDropTarget(item.id) }}
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={handleDragEnd}
                          onClick={() => navigateTo(item.id)}
                          onContextMenu={(e) => handleContextMenu(e, { _kind: 'folder', id: item.id, name: item.name, access_level: item.access_level, shared_with: item.shared_with })}
                          className={`group premium-card min-w-0 cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg ${isDropping ? 'ring-2 ring-[var(--teal)] scale-[1.02]' : ''}`}>
                          <div className="h-1.5 w-full rounded-t-[inherit]" style={{ background: `linear-gradient(90deg, ${clr}, ${clr}88)` }} />
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-1">
                              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${clr}12` }}>
                                <Folder className="h-5 w-5" style={{ color: clr }} />
                              </div>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); setRenameTarget({ id: item.id, name: item.name }); setRenameName(item.name) }} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-100 transition">
                                  <Pencil className="h-3 w-3" style={{ color: 'var(--muted-soft)' }} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete('folder', item.id, item.name) }} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-red-50 transition">
                                  <Trash2 className="h-3 w-3 text-red-400" />
                                </button>
                              </div>
                            </div>
                            <p className="mt-3 truncate text-sm font-bold leading-5" style={{ color: 'var(--text)' }}>{item.name}</p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="text-[10px] font-medium" style={{ color: 'var(--muted-soft)' }}>
                                {item.item_count} item{item.item_count !== 1 ? 's' : ''}
                              </span>
                              {ACCESS_BADGE[item.access_level] && (() => {
                                const badge = ACCESS_BADGE[item.access_level]
                                const BadgeIcon = badge.icon
                                return (
                                  <button onClick={(e) => { e.stopPropagation(); setAccessTarget({ type: 'folder', id: item.id, name: item.name, access: { access_level: item.access_level, shared_with: item.shared_with || [] } }) }}
                                    className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[9px] font-bold transition hover:opacity-80"
                                    style={{ background: `${badge.color}12`, color: badge.color }} title={badge.label}>
                                    <BadgeIcon className="h-2.5 w-2.5" /> {badge.label}
                                  </button>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      )
                    }

                    // File card
                    const Icon = FILE_ICONS[item.file_type] || FileText
                    const color = FILE_COLORS[item.file_type] || '#64748b'
                    return (
                      <div key={`e-${item.id}`}
                        draggable
                        onDragStart={() => handleDragStart('file', item.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => startChat(item.id)}
                        onContextMenu={(e) => handleContextMenu(e, { _kind: 'file', id: item.id, name: item.original_filename, access_level: item.access_level, shared_with: item.shared_with })}
                        className="group premium-card min-w-0 cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg">
                        <div className="h-1.5 w-full rounded-t-[inherit]" style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }} />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-1">
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${color}10` }}>
                              <Icon className="h-5 w-5" style={{ color }} />
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); openMoveModal('file', item.id) }} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-100 transition">
                                <Move className="h-3 w-3" style={{ color: 'var(--muted-soft)' }} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete('file', item.id, item.original_filename) }} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-red-50 transition">
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-3 truncate text-sm font-semibold leading-5" style={{ color: 'var(--text)' }}>{item.original_filename}</p>
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ background: `${color}10`, color }}>{item.file_type}</span>
                            <span className="text-[10px] font-medium" style={{ color: 'var(--muted-soft)' }}>
                              {item.char_count > 1000 ? `${(item.char_count / 1000).toFixed(1)}k chars` : `${item.char_count} chars`}
                            </span>
                            {item.page_count ? <span className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>{item.page_count} pg</span> : null}
                            {ACCESS_BADGE[item.access_level] && (() => {
                              const badge = ACCESS_BADGE[item.access_level]
                              const BadgeIcon = badge.icon
                              return (
                                <button onClick={(e) => { e.stopPropagation(); setAccessTarget({ type: 'file', id: item.id, name: item.original_filename, access: { access_level: item.access_level, shared_with: item.shared_with || [] } }) }}
                                  className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[9px] font-bold transition hover:opacity-80"
                                  style={{ background: `${badge.color}12`, color: badge.color }} title={badge.label}>
                                  <BadgeIcon className="h-2.5 w-2.5" /> {badge.label}
                                </button>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ════ CHAT PANEL ════ */}
        {chatOpen && (
          <div className="premium-card flex flex-col h-full overflow-hidden lg:w-[45%] lg:ml-3">

            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--teal-soft)' }}>
                  <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{scopeLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { key: 'workspace', label: 'All files' },
                  { key: 'folder', label: 'This folder' },
                ].map(s => (
                  <button key={s.key} onClick={() => { setChatScope(s.key); setMessages([]); setConversationId(null) }}
                    className="rounded-lg px-2.5 py-1 text-[10px] font-semibold transition"
                    style={{
                      background: chatScope === s.key ? 'var(--teal-soft)' : 'transparent',
                      color: chatScope === s.key ? 'var(--teal)' : 'var(--muted-soft)',
                    }}>
                    {s.label}
                  </button>
                ))}
                <button onClick={() => setChatOpen(false)} className="ml-1 grid h-7 w-7 place-items-center rounded-lg transition hover:bg-slate-100">
                  <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-soft)' }} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'var(--teal-soft)' }}>
                    <Sparkles className="h-6 w-6" style={{ color: 'var(--teal)' }} />
                  </div>
                  <p className="mt-4 text-sm font-bold" style={{ color: 'var(--text)' }}>Ask anything</p>
                  <p className="mt-1.5 max-w-[220px] text-xs leading-5" style={{ color: 'var(--muted-soft)' }}>
                    AI will search your files and cite sources like <span style={{ color: 'var(--teal)' }}>[File: report.pdf]</span>
                  </p>
                  <div className="mt-5 grid gap-2 w-full max-w-[240px]">
                    {['What are the key takeaways?', 'Summarize the main topics', 'Find financial data'].map(q => (
                      <button key={q} type="button" onClick={() => { setChatInput(q) }}
                        className="rounded-xl border px-3 py-2 text-[11px] font-medium text-left transition hover:-translate-y-0.5"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-4 space-y-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' ? (
                        <div className="flex gap-2 max-w-[92%]">
                          <div className="grid mt-0.5 h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--teal-soft)' }}>
                            <Sparkles className="h-3 w-3" style={{ color: 'var(--teal)' }} />
                          </div>
                          <div className="rounded-2xl rounded-tl-lg px-3.5 py-2.5 text-[12px] leading-[1.6]" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                            {msg.content ? <div className="markdown-response" style={{ fontSize: '12px' }}><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                              : <span className="chat-thinking-dots"><span /><span /><span /></span>}
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-[82%] rounded-2xl rounded-tr-lg px-3.5 py-2.5 text-[12px] leading-[1.6] text-white"
                          style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <form onSubmit={sendMessage} className="flex items-center gap-2 rounded-xl border p-1" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask about your files..."
                  className="flex-1 border-none bg-transparent px-3 py-2 text-xs outline-none" style={{ color: 'var(--text)' }}
                  disabled={streaming} />
                <button type="submit" disabled={!chatInput.trim() || streaming}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition disabled:opacity-30"
                  style={{ background: 'var(--teal)', color: 'white' }}>
                  {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ════ NEW FOLDER MODAL ════ */}
      {newFolderOpen && (
        <div className="modal-overlay"><button className="modal-backdrop" onClick={() => setNewFolderOpen(false)} />
          <div className="premium-card modal-content w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>New Folder</h3>
            <form onSubmit={handleCreateFolder}>
              <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name" className="field-input" autoFocus required />
              <div className="mt-3 flex gap-2">
                {FOLDER_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewFolderColor(c)}
                    className="h-7 w-7 rounded-lg border-2 transition"
                    style={{ background: c, borderColor: newFolderColor === c ? 'var(--text)' : 'transparent' }} />
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setNewFolderOpen(false)} className="btn-ghost text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs"><FolderPlus className="h-3.5 w-3.5" /> Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ RENAME MODAL ════ */}
      {renameTarget && (
        <div className="modal-overlay"><button className="modal-backdrop" onClick={() => setRenameTarget(null)} />
          <div className="premium-card modal-content w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>Rename Folder</h3>
            <input type="text" value={renameName} onChange={e => setRenameName(e.target.value)} className="field-input" autoFocus
              onKeyDown={e => e.key === 'Enter' && handleRename()} />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setRenameTarget(null)} className="btn-ghost text-xs">Cancel</button>
              <button onClick={handleRename} className="btn-primary text-xs">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ RIGHT-CLICK CONTEXT MENU (at root level for correct fixed positioning) ════ */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }} />
          <div className="fixed z-[70] w-56 rounded-xl border p-1.5 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y, borderColor: 'var(--border)', background: 'var(--surface-strong)', backdropFilter: 'blur(16px)' }}>

            {/* Create options — only when right-clicking empty space (no item) */}
            {!contextMenu.item && (
              <>
                <button onClick={() => { setNewFolderOpen(true); setContextMenu(null) }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-white/60" style={{ color: 'var(--text)' }}>
                  <FolderPlus className="h-3.5 w-3.5" style={{ color: '#6366f1' }} /> New Folder
                </button>
                <button onClick={() => { openFilePicker(); setContextMenu(null) }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-white/60" style={{ color: 'var(--text)' }}>
                  <Upload className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} /> Upload File
                </button>
                <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
              </>
            )}

            {/* Item actions — only when right-clicking on a file or folder */}
            {contextMenu.item && (
              <>
                <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--muted-soft)' }}>
                  {contextMenu.item._kind === 'folder' ? 'Folder' : 'File'}: {contextMenu.item.name?.slice(0, 25)}{contextMenu.item.name?.length > 25 ? '...' : ''}
                </p>
                <button onClick={() => { openMoveModal(contextMenu.item._kind, contextMenu.item.id); setContextMenu(null) }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-white/60" style={{ color: 'var(--text)' }}>
                  <Move className="h-3.5 w-3.5" style={{ color: 'var(--muted-soft)' }} /> Move
                </button>
                <button onClick={() => { handleDelete(contextMenu.item._kind, contextMenu.item.id, contextMenu.item.name); setContextMenu(null) }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-white/60 text-red-500">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
                <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--muted-soft)' }}>Access</p>
                {[
                  { value: 'workspace', label: 'Workspace (Everyone)', icon: Globe, color: 'var(--teal)' },
                  { value: 'shared', label: 'Shared (Select members)', icon: Users, color: '#6366f1' },
                  { value: 'private', label: 'Private (Only me)', icon: Lock, color: '#f59e0b' },
                ].map(opt => {
                  const isActive = (contextMenu.item.access_level || 'workspace') === opt.value
                  const OptIcon = opt.icon
                  return (
                    <button key={opt.value} onClick={() => {
                      const item = contextMenu.item
                      if (opt.value === 'shared') {
                        setAccessTarget({ type: item._kind, id: item.id, name: item.name, access: { access_level: item.access_level || 'workspace', shared_with: item.shared_with || [] } })
                      } else {
                        client.patch(`/api/workspace/${item._kind === 'folder' ? 'folders' : 'files'}/${item.id}/access`, { access_level: opt.value, shared_with: [] })
                          .then(() => { toast.success(`Set to ${opt.label.split('(')[0].trim()}`); loadContents() })
                          .catch(() => toast.error('Failed'))
                      }
                      setContextMenu(null)
                    }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-left transition hover:bg-white/60"
                      style={{ color: isActive ? opt.color : 'var(--muted)' }}>
                      <OptIcon className="h-3.5 w-3.5 shrink-0" style={{ color: opt.color }} />
                      <span className="flex-1 text-left">{opt.label}</span>
                      {isActive && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: opt.color }} />}
                    </button>
                  )
                })}
              </>
            )}

            {/* Sort — only on empty space right-click */}
            {!contextMenu.item && (
              <>
                <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--muted-soft)' }}>Sort by</p>
                {[
                  { value: 'folders-first', label: 'Folders first' },
                  { value: 'files-first', label: 'Files first' },
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                  { value: 'name-asc', label: 'Name A → Z' },
                  { value: 'name-desc', label: 'Name Z → A' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => { setSortBy(opt.value); setContextMenu(null) }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition hover:bg-white/60"
                    style={{ color: sortBy === opt.value ? 'var(--teal)' : 'var(--muted)' }}>
                    {sortBy === opt.value && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--teal)' }} />}
                    {opt.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ════ ACCESS MODAL ════ */}
      {accessTarget && (
        <AccessModal
          itemType={accessTarget.type}
          itemId={accessTarget.id}
          itemName={accessTarget.name}
          currentAccess={accessTarget.access}
          onClose={() => setAccessTarget(null)}
          onSaved={() => loadContents()}
        />
      )}

      {/* ════ MOVE MODAL ════ */}
      {moveTarget && (
        <div className="modal-overlay"><button className="modal-backdrop" onClick={() => setMoveTarget(null)} />
          <div className="premium-card modal-content w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>Move to folder</h3>
            <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setMoveDestination(null)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition text-xs font-medium"
                style={{ background: moveDestination === null ? 'var(--teal-soft)' : 'transparent', color: moveDestination === null ? 'var(--teal)' : 'var(--text)' }}>
                <FolderOpen className="h-3.5 w-3.5" /> Root (Workspace)
              </button>
              {allFolders.filter(f => f.id !== moveTarget.id).map(f => (
                <button key={f.id} onClick={() => setMoveDestination(f.id)}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition text-xs font-medium"
                  style={{ background: moveDestination === f.id ? 'var(--teal-soft)' : 'transparent', color: moveDestination === f.id ? 'var(--teal)' : 'var(--text)', paddingLeft: f.parent_id ? '1.5rem' : undefined }}>
                  <Folder className="h-3.5 w-3.5" style={{ color: 'var(--muted-soft)' }} /> {f.name}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setMoveTarget(null)} className="btn-ghost text-xs">Cancel</button>
              <button onClick={handleMove} className="btn-primary text-xs"><Move className="h-3.5 w-3.5" /> Move</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
