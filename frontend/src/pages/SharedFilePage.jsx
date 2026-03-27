import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Download, Eye, FileText, FolderOpen,
  Loader2, Lock, Mail, ShieldCheck, Sparkles,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const SESSION_KEY = (token) => `pgyan-share-session:${token}`
const PORTAL_SESSION = 'pgyan-portal-session'
const PORTAL_EMAIL = 'pgyan-portal-email'

export default function SharedFilePage() {
  const { token } = useParams()
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [imageSrc, setImageSrc] = useState(null)
  const [textContent, setTextContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState(false)
  const [error, setError] = useState(null)

  // Auth states
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [password, setPassword] = useState(null)
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [verifyStep, setVerifyStep] = useState('email') // 'email' | 'otp'
  const [emailInput, setEmailInput] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [session, setSession] = useState(() => localStorage.getItem(SESSION_KEY(token)))
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem(PORTAL_EMAIL) || '')

  const prevImageRef = useRef(null)

  // Load metadata
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (password) params.set('password', password)
    if (session) params.set('session', session)
    fetch(`${API}/api/shared-file/${token}?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.verification_required) {
          setVerificationRequired(true)
          if (data.session_expired) setSession(null)
          setMeta({ filename: data.filename, file_type: data.file_type })
          setLoading(false)
          return
        }
        if (data.password_required) {
          setPasswordRequired(true)
          setMeta({ filename: data.filename })
          setLoading(false)
          return
        }
        if (data.detail) {
          setError(data.detail)
          setLoading(false)
          return
        }
        setVerificationRequired(false)
        setPasswordRequired(false)
        setMeta(data)
        setTotalPages(data.page_count || 0)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load shared file'); setLoading(false) })
  }, [token, password, session])

  // Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault()
    if (!emailInput.trim() || !emailInput.includes('@')) return
    setVerifying(true)
    try {
      const res = await fetch(`${API}/api/shared-file/${token}/request-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setVerifyStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setVerifying(false)
    }
  }

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otpInput.trim()) return
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/shared-file/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim(), otp: otpInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Invalid code')
      // Save session token for this file AND for the portal
      localStorage.setItem(SESSION_KEY(token), data.session_token)
      localStorage.setItem(PORTAL_SESSION, data.session_token)
      localStorage.setItem(PORTAL_EMAIL, emailInput.trim())
      setSession(data.session_token)
      setUserEmail(emailInput.trim())
      setVerificationRequired(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setVerifying(false)
    }
  }

  // Load preview page
  const loadPage = useCallback((p) => {
    if (!meta || meta.file_type !== 'pdf') return
    setPageLoading(true)
    const params = new URLSearchParams({ page: p })
    if (password) params.set('password', password)
    if (session) params.set('session', session)
    fetch(`${API}/api/shared-file/${token}/preview?${params}`)
      .then(r => {
        if (!r.ok) throw new Error('Page not available')
        setTotalPages(parseInt(r.headers.get('X-Total-Pages') || '0') || meta.page_count || 0)
        return r.blob()
      })
      .then(blob => {
        if (prevImageRef.current) URL.revokeObjectURL(prevImageRef.current)
        const url = URL.createObjectURL(blob)
        prevImageRef.current = url
        setImageSrc(url)
        setPage(p)
        setPageLoading(false)
      })
      .catch(() => { setPageLoading(false) })
  }, [meta, token, password, session])

  // Load text content for non-PDF
  const loadTextContent = useCallback(() => {
    if (!meta || meta.file_type === 'pdf') return
    const params = new URLSearchParams()
    if (password) params.set('password', password)
    if (session) params.set('session', session)
    fetch(`${API}/api/shared-file/${token}/preview?${params}`)
      .then(r => r.json())
      .then(data => { setTextContent(data.text || ''); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [meta, token, password, session])

  // Auto-load first page / text
  useEffect(() => {
    if (!meta || passwordRequired || verificationRequired) return
    if (!meta.verified) return
    if (meta.file_type === 'pdf') loadPage(1)
    else loadTextContent()
  }, [meta, passwordRequired, verificationRequired, loadPage, loadTextContent])

  // Copy/select protection for read-only
  useEffect(() => {
    if (!meta || meta.permission !== 'read') return
    const prevent = (e) => e.preventDefault()
    document.addEventListener('contextmenu', prevent)
    document.addEventListener('copy', prevent)
    document.addEventListener('cut', prevent)
    document.addEventListener('selectstart', prevent)
    return () => {
      document.removeEventListener('contextmenu', prevent)
      document.removeEventListener('copy', prevent)
      document.removeEventListener('cut', prevent)
      document.removeEventListener('selectstart', prevent)
    }
  }, [meta])

  const handlePasswordSubmit = (e) => { e.preventDefault(); setPassword(passwordInput) }
  const handleDownload = () => {
    const params = new URLSearchParams()
    if (password) params.set('password', password)
    if (session) params.set('session', session)
    window.open(`${API}/api/shared-file/${token}/download?${params}`, '_blank')
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0fdf9, #f8fafc, #fffbeb)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0f766e' }} />
      </div>
    )
  }

  // ── Error (no share found) ──
  if (error && !verificationRequired && !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0fdf9, #f8fafc, #fffbeb)' }}>
        <div className="text-center max-w-md">
          <Lock className="mx-auto h-10 w-10" style={{ color: '#94a3b8' }} />
          <h2 className="mt-4 text-xl font-bold" style={{ color: '#0f172a' }}>Not Available</h2>
          <p className="mt-2 text-sm" style={{ color: '#64748b' }}>{error}</p>
        </div>
      </div>
    )
  }

  // ── Email Verification Required ──
  if (verificationRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #f0fdf9, #f8fafc, #fffbeb)' }}>
        <div className="w-full max-w-sm rounded-3xl border p-8 text-center" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderColor: '#e2e8f0' }}>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'rgba(15,118,110,0.1)' }}>
            <Mail className="h-6 w-6" style={{ color: '#0f766e' }} />
          </div>
          <h2 className="mt-5 text-lg font-bold" style={{ color: '#0f172a' }}>Verify Your Identity</h2>
          <p className="mt-2 text-sm" style={{ color: '#64748b' }}>
            <span className="font-semibold">{meta?.filename}</span> requires email verification to access.
          </p>

          {verifyStep === 'email' ? (
            <form onSubmit={handleRequestOtp} className="mt-5 space-y-3">
              <input
                type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                placeholder="Enter your email" autoFocus
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-teal-500"
                style={{ borderColor: '#e2e8f0' }}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={verifying}
                className="w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0f766e, #0f5d75)' }}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send Verification Code
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-5 space-y-3">
              <p className="text-xs" style={{ color: '#64748b' }}>
                We sent a 6-digit code to <span className="font-semibold">{emailInput}</span>
              </p>
              <input
                type="text" value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code" autoFocus maxLength={6}
                className="w-full rounded-xl border px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] outline-none focus:border-teal-500"
                style={{ borderColor: '#e2e8f0' }}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={verifying || otpInput.length < 6}
                className="w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0f766e, #0f5d75)' }}>
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verify & Access
              </button>
              <button type="button" onClick={() => { setVerifyStep('email'); setOtpInput(''); setError(null) }}
                className="text-xs font-medium" style={{ color: '#0f766e' }}>
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // ── Password Prompt ──
  if (passwordRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #f0fdf9, #f8fafc, #fffbeb)' }}>
        <div className="w-full max-w-sm rounded-3xl border p-8 text-center" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderColor: '#e2e8f0' }}>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'rgba(245,158,11,0.1)' }}>
            <Lock className="h-6 w-6" style={{ color: '#f59e0b' }} />
          </div>
          <h2 className="mt-5 text-lg font-bold" style={{ color: '#0f172a' }}>Password Protected</h2>
          <p className="mt-2 text-sm" style={{ color: '#64748b' }}>{meta?.filename} requires a password.</p>
          <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-3">
            <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
              placeholder="Enter password" autoFocus
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-teal-500"
              style={{ borderColor: '#e2e8f0' }} />
            <button type="submit" className="w-full rounded-xl py-3 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>Unlock</button>
          </form>
        </div>
      </div>
    )
  }

  const isReadOnly = meta?.permission === 'read'
  const isPdf = meta?.file_type === 'pdf'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #f0fdf9, #f8fafc, #fffbeb)' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderColor: '#e2e8f0' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ border: '1.5px solid #e2e8f0', background: 'white' }}>
            <FileText className="h-4 w-4" style={{ color: '#0f766e' }} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold" style={{ color: '#0f172a' }}>{meta?.filename}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: isReadOnly ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: isReadOnly ? '#f59e0b' : '#10b981' }}>
                {isReadOnly ? <><Eye className="h-2.5 w-2.5" /> View only</> : <><ShieldCheck className="h-2.5 w-2.5" /> Full access</>}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPdf && totalPages > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={() => loadPage(page - 1)} disabled={page <= 1 || pageLoading}
                className="grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-30" style={{ borderColor: '#e2e8f0' }}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium px-2" style={{ color: '#0f172a' }}>{page} / {totalPages}</span>
              <button onClick={() => loadPage(page + 1)} disabled={page >= totalPages || pageLoading}
                className="grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-30" style={{ borderColor: '#e2e8f0' }}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {!isReadOnly && (
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ background: '#0f766e' }}>
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          )}
          <Link to="/shared-files"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-50"
            style={{ borderColor: '#e2e8f0', color: '#0f766e' }}>
            <FolderOpen className="h-3.5 w-3.5" /> My Files
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className={`flex-1 flex items-start justify-center p-4 sm:p-8 ${isReadOnly ? 'select-none' : ''}`}
        style={isReadOnly ? { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } : {}}>
        {pageLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0f766e' }} />
          </div>
        )}
        {isPdf && imageSrc && !pageLoading && (
          <img src={imageSrc} alt={`Page ${page}`} className="max-w-full rounded-xl shadow-lg"
            style={isReadOnly ? { pointerEvents: 'none', WebkitUserDrag: 'none' } : {}}
            draggable={false} onContextMenu={e => isReadOnly && e.preventDefault()} />
        )}
        {!isPdf && textContent !== null && (
          <div className="w-full max-w-3xl rounded-3xl border p-6 sm:p-10" style={{ background: 'rgba(255,255,255,0.85)', borderColor: '#e2e8f0' }}>
            <div className="prose prose-sm max-w-none text-sm leading-7" style={{ color: '#0f172a', pointerEvents: isReadOnly ? 'none' : 'auto' }}>
              <ReactMarkdown>{textContent}</ReactMarkdown>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center border-t" style={{ borderColor: '#e2e8f0' }}>
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" style={{ color: '#0f766e' }} />
            <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>Shared via PDF Gyan</span>
          </div>
          <a href="/shared-files" className="text-[10px] font-semibold transition hover:underline" style={{ color: '#0f766e' }}>
            View all shared files
          </a>
        </div>
      </footer>
    </div>
  )
}
