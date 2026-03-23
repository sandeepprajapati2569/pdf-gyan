import { useState } from 'react'
import { ArrowRight, Loader2, LockKeyhole, CheckCircle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth'
import AuthFrame from '../components/ui/AuthFrame'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <AuthFrame
        eyebrow="Invalid link"
        title="Missing reset token"
        subtitle="This link is invalid or has expired. Please request a new password reset."
        footerPrompt="Need a new link?"
        footerLinkTo="/forgot-password"
        footerLinkText="Request password reset"
      >
        <div />
      </AuthFrame>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await resetPassword({ token, password })
      setDone(true)
      toast.success('Password reset successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame
      eyebrow="Almost there"
      title="Set a new password"
      subtitle="Choose a strong password for your account."
      footerPrompt="Remember your password?"
      footerLinkTo="/login"
      footerLinkText="Back to sign in"
    >
      {done ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
            <CheckCircle className="h-7 w-7 text-teal-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">Password updated</h3>
            <p className="text-sm leading-6 text-slate-500">
              Your password has been reset. You can now sign in with your new password.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary mt-2"
          >
            <ArrowRight className="h-4 w-4" />
            Go to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="field-label">New password</label>
            <div className="relative">
              <LockKeyhole className="auth-field-icon pointer-events-none absolute z-10 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input auth-field-input"
                placeholder="At least 6 characters"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Confirm password</label>
            <div className="relative">
              <LockKeyhole className="auth-field-icon pointer-events-none absolute z-10 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="field-input auth-field-input"
                placeholder="Re-enter your password"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      )}
    </AuthFrame>
  )
}
