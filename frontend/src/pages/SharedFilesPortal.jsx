import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight, Clock, Download, Eye, FileSpreadsheet, FileText,
  Loader2, Lock, Mail, Presentation, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const PORTAL_SESSION = 'pgyan-portal-session'
const PORTAL_EMAIL = 'pgyan-portal-email'

const FILE_ICONS = { pdf: FileText, xlsx: FileSpreadsheet, pptx: Presentation, docx: FileText, txt: FileText }
const FILE_COLORS = { pdf: '#ef4444', xlsx: '#22c55e', pptx: '#f97316', docx: '#3b82f6', txt: '#8b5cf6' }

export default function SharedFilesPortal() {
  const [email, setEmail] = useState(() => localStorage.getItem(PORTAL_EMAIL) || '')
  const [verified, setVerified] = useState(false)
  const [step, setStep] = useState('email') // email | otp | dashboard
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [files, setFiles] = useState([])
  const [filesLoading, setFilesLoading] = useState(false)

  // Check if already verified
  useEffect(() => {
    const savedEmail = localStorage.getItem(PORTAL_EMAIL)
    const savedSession = localStorage.getItem(PORTAL_SESSION)
    if (savedEmail && savedSession) {
      setEmail(savedEmail)
      setVerified(true)
      setStep('dashboard')
    }
  }, [])

  // Load shared files
  const loadFiles = useCallback(async () => {
    if (!email) return
    setFilesLoading(true)
    try {
      const res = await fetch(`${API}/api/shared-file/my-files?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      setFiles(data.files || [])
    } catch { setFiles([]) }
    finally { setFilesLoading(false) }
  }, [email])

  useEffect(() => {
    if (step === 'dashboard' && verified) loadFiles()
  }, [step, verified, loadFiles])

  // Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) return
    setLoading(true)
    setError(null)
    try {
      // We'll use a special portal verification endpoint
      const res = await fetch(`${API}/api/shared-file/portal/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/shared-file/portal/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Invalid code')
      localStorage.setItem(PORTAL_EMAIL, email.trim())
      localStorage.setItem(PORTAL_SESSION, data.session_token)
      setVerified(true)
      setStep('dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(PORTAL_EMAIL)
    localStorage.removeItem(PORTAL_SESSION)
    setVerified(false)
    setStep('email')
    setFiles([])
    setOtp('')
  }

  const activeFiles = files.filter(f => !f.expired)
  const expiredFiles = files.filter(f => f.expired)

  // ── Email / OTP screens ──
  if (step !== 'dashboard') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #f0fdf9, #f8fafc, #fffbeb)' }}>
        <div className="w-full max-w-sm">
          {/* Branding */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ border: '1.5px solid #e2e8f0', background: 'white' }}>
              <Sparkles className="h-4 w-4" style={{ color: '#0f766e' }} />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: '#0f172a' }}>PDF Gyan</p>
              <p className="text-[10px]" style={{ color: '#94a3b8' }}>Shared Files Portal</p>
            </div>
          </div>

          <div className="rounded-3xl border p-8 text-center" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderColor: '#e2e8f0' }}>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'rgba(15,118,110,0.1)' }}>
              <Mail className="h-6 w-6" style={{ color: '#0f766e' }} />
            </div>

            {step === 'email' ? (
              <>
                <h2 className="mt-5 text-lg font-bold" style={{ color: '#0f172a' }}>Access Your Shared Files</h2>
                <p className="mt-2 text-sm" style={{ color: '#64748b' }}>
                  Enter your email to see all documents shared with you.
                </p>
                <form onSubmit={handleRequestOtp} className="mt-5 space-y-3">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com" autoFocus
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-teal-500"
                    style={{ borderColor: '#e2e8f0' }} />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <button type="submit" disabled={loading || !email.includes('@')}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #0f766e, #0f5d75)' }}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Send Verification Code
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="mt-5 text-lg font-bold" style={{ color: '#0f172a' }}>Enter Verification Code</h2>
                <p className="mt-2 text-xs" style={{ color: '#64748b' }}>
                  We sent a 6-digit code to <span className="font-bold">{email}</span>
                </p>
                <form onSubmit={handleVerifyOtp} className="mt-5 space-y-3">
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" autoFocus maxLength={6}
                    className="w-full rounded-xl border px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] outline-none focus:border-teal-500"
                    style={{ borderColor: '#e2e8f0' }} />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <button type="submit" disabled={loading || otp.length < 6}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #0f766e, #0f5d75)' }}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Verify & View Files
                  </button>
                  <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(null) }}
                    className="text-xs font-medium" style={{ color: '#0f766e' }}>
                    Use a different email
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Dashboard ──
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0fdf9, #f8fafc, #fffbeb)' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b px-4 py-3" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderColor: '#e2e8f0' }}>
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ border: '1.5px solid #e2e8f0', background: 'white' }}>
              <Sparkles className="h-4 w-4" style={{ color: '#0f766e' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#0f172a' }}>Shared Files</p>
              <p className="text-[10px]" style={{ color: '#94a3b8' }}>{email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs font-medium px-3 py-1.5 rounded-lg border transition hover:bg-white/60"
            style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Active', value: activeFiles.length, color: '#10b981' },
            { label: 'Total shared', value: files.length, color: '#0f766e' },
            { label: 'Expired', value: expiredFiles.length, color: '#94a3b8' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border p-4 text-center" style={{ borderColor: '#e2e8f0', background: 'rgba(255,255,255,0.85)' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: '#94a3b8' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Files */}
        {filesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#0f766e' }} />
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-3xl border p-12 text-center" style={{ borderColor: '#e2e8f0', background: 'rgba(255,255,255,0.85)' }}>
            <FileText className="mx-auto h-10 w-10" style={{ color: '#94a3b8' }} />
            <p className="mt-4 text-sm font-bold" style={{ color: '#0f172a' }}>No files shared with you yet</p>
            <p className="mt-1 text-xs" style={{ color: '#94a3b8' }}>When someone shares a document with {email}, it will appear here.</p>
          </div>
        ) : (
          <>
            {/* Active files */}
            {activeFiles.length > 0 && (
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: '#94a3b8' }}>
                  Active ({activeFiles.length})
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeFiles.map(file => {
                    const color = FILE_COLORS[file.file_type] || '#8b5cf6'
                    const Icon = FILE_ICONS[file.file_type] || FileText
                    return (
                      <a key={file.share_token} href={`/shared-file/${file.share_token}`}
                        className="flex items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                        style={{ borderColor: '#e2e8f0', background: 'rgba(255,255,255,0.85)' }}>
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: `${color}12` }}>
                          <Icon className="h-5 w-5" style={{ color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold" style={{ color: '#0f172a' }}>{file.filename}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase"
                              style={{ background: file.permission === 'read' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: file.permission === 'read' ? '#f59e0b' : '#10b981' }}>
                              {file.permission === 'read' ? <><Eye className="h-2.5 w-2.5" /> View</> : <><Download className="h-2.5 w-2.5" /> Full</>}
                            </span>
                            {file.has_password && <Lock className="h-2.5 w-2.5" style={{ color: '#94a3b8' }} />}
                            {file.expires_at && (
                              <span className="flex items-center gap-0.5 text-[10px]" style={{ color: '#94a3b8' }}>
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(file.expires_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0" style={{ color: '#94a3b8' }} />
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Expired files */}
            {expiredFiles.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: '#94a3b8' }}>
                  Expired ({expiredFiles.length})
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {expiredFiles.map(file => (
                    <div key={file.share_token}
                      className="flex items-center gap-3 rounded-2xl border p-4 opacity-50"
                      style={{ borderColor: '#e2e8f0', background: 'rgba(255,255,255,0.6)' }}>
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: '#f1f5f9' }}>
                        <FileText className="h-5 w-5" style={{ color: '#94a3b8' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold" style={{ color: '#64748b' }}>{file.filename}</p>
                        <p className="text-[10px]" style={{ color: '#94a3b8' }}>Access expired</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 text-center border-t" style={{ borderColor: '#e2e8f0' }}>
        <div className="flex items-center justify-center gap-1.5">
          <Sparkles className="h-3 w-3" style={{ color: '#0f766e' }} />
          <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>Powered by PDF Gyan</span>
        </div>
      </footer>
    </div>
  )
}
