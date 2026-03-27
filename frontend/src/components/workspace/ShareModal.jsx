import { useState } from 'react'
import {
  Check, Clock, Copy, Download, Eye, EyeOff, Globe,
  Key, Link2, Loader2, Lock, Mail, Plus, Shield, X,
} from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'
import RedactionSelector from './RedactionSelector'

const APP_URL = window.location.origin

export default function ShareModal({ fileId, fileName, fileType, pageCount, onClose, onShared }) {
  const [permission, setPermission] = useState('read')
  const [recipients, setRecipients] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [redactions, setRedactions] = useState([])
  const [expiresDays, setExpiresDays] = useState(30)
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [shareResult, setShareResult] = useState(null)
  const [showRedactor, setShowRedactor] = useState(false)
  const [copied, setCopied] = useState(false)

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase()
    if (!email || !email.includes('@') || recipients.includes(email)) return
    setRecipients(prev => [...prev, email])
    setEmailInput('')
  }

  const removeEmail = (email) => setRecipients(prev => prev.filter(e => e !== email))

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await client.post(`/api/sharespace/files/${fileId}/share`, {
        permission,
        recipients,
        redactions: permission === 'read' ? redactions : [],
        expires_days: expiresDays,
        password: password || null,
      })
      setShareResult(res.data)
      onShared?.()
      toast.success('Share link created!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create share')
    } finally {
      setCreating(false)
    }
  }

  const copyLink = () => {
    if (!shareResult) return
    navigator.clipboard.writeText(`${APP_URL}/shared-file/${shareResult.share_token}`)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const shareUrl = shareResult ? `${APP_URL}/shared-file/${shareResult.share_token}` : ''

  return (
    <>
      <div className="modal-overlay" style={{ zIndex: 55 }}>
        <button type="button" className="modal-backdrop" onClick={onClose} />
        <div className="premium-card modal-content w-full max-w-lg p-6" style={{ zIndex: 56 }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: 'var(--teal-soft)' }}>
                <Link2 className="h-4 w-4" style={{ color: 'var(--teal)' }} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>Share File</h2>
                <p className="text-xs truncate max-w-[260px]" style={{ color: 'var(--muted-soft)' }}>{fileName}</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost !rounded-full !p-2"><X className="h-4 w-4" /></button>
          </div>

          {/* ── Share result view ── */}
          {shareResult ? (
            <div className="space-y-5">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--teal-soft)', background: 'var(--teal-soft)' }}>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--teal)' }}>Share link ready</p>
                <div className="flex items-center gap-2">
                  <input type="text" value={shareUrl} readOnly className="field-input flex-1 !text-xs !font-mono" />
                  <button onClick={copyLink} className="btn-primary shrink-0 !px-3 !py-2 text-xs">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted-soft)' }}>
                <span className="flex items-center gap-1">
                  {permission === 'read' ? <Eye className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                  {permission === 'read' ? 'View only' : 'Full access'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Expires in {expiresDays} days
                </span>
                {password && <span className="flex items-center gap-1"><Key className="h-3 w-3" /> Password set</span>}
              </div>
              <button onClick={onClose} className="btn-primary w-full justify-center">Done</button>
            </div>
          ) : (
            /* ── Configuration view ── */
            <div className="space-y-5">
              {/* Permission */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--muted-soft)' }}>Permission</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'read', label: 'View Only', desc: 'Can view but not copy, select, or download', icon: Eye, color: '#f59e0b' },
                    { value: 'write', label: 'Full Access', desc: 'Can view and download the file', icon: Shield, color: '#10b981' },
                  ].map(opt => {
                    const Icon = opt.icon
                    const active = permission === opt.value
                    return (
                      <button key={opt.value} type="button" onClick={() => setPermission(opt.value)}
                        className={`rounded-xl border p-3 text-left transition ${active ? 'ring-2' : 'hover:bg-white/40'}`}
                        style={{ borderColor: active ? opt.color : 'var(--border)', ringColor: active ? opt.color : undefined }}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-3.5 w-3.5" style={{ color: opt.color }} />
                          <span className="text-xs font-bold" style={{ color: active ? opt.color : 'var(--text)' }}>{opt.label}</span>
                        </div>
                        <p className="text-[10px] leading-4" style={{ color: 'var(--muted-soft)' }}>{opt.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Redaction (read-only only) */}
              {permission === 'read' && fileType === 'pdf' && pageCount > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--muted-soft)' }}>Content Redaction</p>
                  <button type="button" onClick={() => setShowRedactor(true)}
                    className="flex w-full items-center justify-between rounded-xl border p-3 transition hover:bg-white/40"
                    style={{ borderColor: redactions.length > 0 ? '#f59e0b' : 'var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <EyeOff className="h-3.5 w-3.5" style={{ color: redactions.length > 0 ? '#f59e0b' : 'var(--muted-soft)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                        {redactions.length > 0 ? `${redactions.length} page${redactions.length !== 1 ? 's' : ''} hidden` : 'Select pages to hide'}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--muted-soft)' }}>
                      {pageCount} total pages
                    </span>
                  </button>
                </div>
              )}

              {/* Recipients */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--muted-soft)' }}>
                  Recipients <span style={{ color: 'var(--danger, #c2410c)' }}>*</span>
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--muted-soft)' }} />
                    <input
                      type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                      placeholder="email@example.com" className="field-input !pl-9 !text-xs"
                    />
                  </div>
                  <button type="button" onClick={addEmail} className="btn-ghost !p-2"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                {recipients.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recipients.map(email => (
                      <span key={email} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium"
                        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                        {email}
                        <button type="button" onClick={() => removeEmail(email)} className="hover:text-red-500 transition">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Options row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: 'var(--muted-soft)' }}>Expires</p>
                  <select value={expiresDays} onChange={e => setExpiresDays(parseInt(e.target.value))}
                    className="field-input !text-xs w-full">
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: 'var(--muted-soft)' }}>Password</p>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: 'var(--muted-soft)' }} />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Optional" className="field-input !pl-8 !text-xs w-full" />
                  </div>
                </div>
              </div>

              {/* Create button */}
              {recipients.length === 0 && (
                <p className="text-[10px] text-center" style={{ color: 'var(--muted-soft)' }}>
                  Add at least one recipient email to create a secure share link
                </p>
              )}
              <button type="button" onClick={handleCreate} disabled={creating || recipients.length === 0} className="btn-primary w-full justify-center">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4" /> Create Share Link</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Redaction selector overlay */}
      {showRedactor && (
        <RedactionSelector
          fileId={fileId}
          fileType={fileType}
          pageCount={pageCount}
          redactions={redactions}
          onChange={setRedactions}
          onClose={() => setShowRedactor(false)}
        />
      )}
    </>
  )
}
