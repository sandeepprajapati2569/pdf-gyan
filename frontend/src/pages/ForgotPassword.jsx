import { useState } from 'react'
import { ArrowRight, Loader2, Mail, CheckCircle } from 'lucide-react'
import { forgotPassword } from '../api/auth'
import AuthFrame from '../components/ui/AuthFrame'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword({ email })
      setSent(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      footerPrompt="Remember your password?"
      footerLinkTo="/login"
      footerLinkText="Back to sign in"
    >
      {sent ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
            <CheckCircle className="h-7 w-7 text-teal-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">Check your email</h3>
            <p className="text-sm leading-6 text-slate-500">
              If an account exists for <span className="font-medium text-slate-700">{email}</span>,
              you'll receive a reset link shortly.
            </p>
          </div>
          <button
            onClick={() => { setSent(false); setEmail(''); }}
            className="mt-2 text-sm font-medium text-teal-700 hover:text-teal-800 transition"
          >
            Try a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="field-label">Email address</label>
            <div className="relative">
              <Mail className="auth-field-icon pointer-events-none absolute z-10 text-slate-400" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input auth-field-input"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthFrame>
  )
}
