import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { register, sendSignupOtp, verifySignupOtp } from '../api/auth'
import AuthFrame from '../components/ui/AuthFrame'
import toast from 'react-hot-toast'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [verificationToken, setVerificationToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const resetVerificationState = () => {
    setOtp('')
    setOtpSent(false)
    setEmailVerified(false)
    setVerificationToken('')
  }

  const handleEmailChange = (value) => {
    setEmail(value)
    if (otpSent || emailVerified || verificationToken || otp) {
      resetVerificationState()
    }
  }

  const handleSendOtp = async () => {
    if (!email.trim()) {
      toast.error('Enter your email first')
      return
    }

    setSendingOtp(true)
    try {
      const res = await sendSignupOtp({ email, name })
      setOtp('')
      setOtpSent(true)
      setEmailVerified(false)
      setVerificationToken('')
      toast.success(res.data.message || 'Verification code sent')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send verification code')
    } finally {
      setSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error('Enter the verification code')
      return
    }

    setVerifyingOtp(true)
    try {
      const res = await verifySignupOtp({ email, otp })
      setEmailVerified(true)
      setVerificationToken(res.data.verification_token)
      toast.success(res.data.message || 'Email verified successfully')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Verification failed')
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (!verificationToken || !emailVerified) {
      toast.error('Verify your email before creating an account')
      return
    }

    setLoading(true)
    try {
      const res = await register({ name, email, password, verification_token: verificationToken })
      loginUser(res.data.access_token, res.data.user)
      toast.success('Account created!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame
      eyebrow="Create workspace"
      title="Create your workspace."
      subtitle="Verify your email, then finish signup and start chatting with your documents."
      footerPrompt="Already have an account?"
      footerLinkTo="/login"
      footerLinkText="Sign in instead"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="field-label">Full name</label>
          <div className="relative">
            <UserRound className="auth-field-icon pointer-events-none absolute z-10 text-slate-400" />
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input auth-field-input"
              placeholder="Full name"
            />
          </div>
        </div>

        <div>
          <label className="field-label">Work email</label>
          <div className="relative">
            <Mail className="auth-field-icon pointer-events-none absolute z-10 text-slate-400" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              className="field-input auth-field-input"
              placeholder="you@company.com"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!otpSent && !emailVerified ? (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={sendingOtp || !email.trim()}
                className="btn-secondary"
              >
                {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send OTP
              </button>
            ) : null}

            {emailVerified ? (
              <span className="status-pill status-ready">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Email verified
              </span>
            ) : otpSent ? (
              <span className="soft-pill bg-white/80 text-slate-600">Code sent to {email}</span>
            ) : null}
          </div>
        </div>

        {otpSent && !emailVerified && (
          <div className="soft-card p-5">
            <div className="flex items-start gap-3">
              <div className="icon-shell h-11 w-11 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-950">Verify your email</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Enter the 6-digit code we sent to <span className="font-medium text-slate-700">{email}</span>.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="field-label">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="field-input"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={handleVerifyOtp} disabled={verifyingOtp || otp.trim().length !== 6} className="btn-primary">
                {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verify email
              </button>
              <button type="button" onClick={handleSendOtp} disabled={sendingOtp} className="btn-ghost">
                {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Resend code
              </button>
            </div>
          </div>
        )}

        {emailVerified && (
          <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/90 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              <p className="font-semibold text-emerald-700">Email verified</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-600">
              Your email is confirmed. Set your password and create the account when you are ready.
            </p>
          </div>
        )}

        <div>
          <label className="field-label">Password</label>
          <div className="relative">
            <LockKeyhole className="auth-field-icon pointer-events-none absolute z-10 text-slate-400" />
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input auth-field-input"
              placeholder="Minimum 6 characters"
            />
          </div>
        </div>

        <button type="submit" disabled={loading || !emailVerified || !verificationToken} className="btn-primary w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? 'Creating your workspace...' : emailVerified ? 'Create account' : 'Verify email to continue'}
        </button>
      </form>
    </AuthFrame>
  )
}
