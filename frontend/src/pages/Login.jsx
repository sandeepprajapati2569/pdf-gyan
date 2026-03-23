import { useState } from 'react'
import { ArrowRight, Loader2, Mail, LockKeyhole } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { login } from '../api/auth'
import AuthFrame from '../components/ui/AuthFrame'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await login({ email, password })
      loginUser(res.data.access_token, res.data.user)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame
      eyebrow="Welcome back"
      title="Welcome back."
      subtitle="Pick up your documents, chats, and API access in seconds."
      footerPrompt="New to PDF Gyan?"
      footerLinkTo="/register"
      footerLinkText="Create your workspace"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="field-label">Email</label>
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

        <div>
          <div className="flex items-center justify-between">
            <label className="field-label">Password</label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-teal-700 hover:text-teal-800 transition"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole className="auth-field-icon pointer-events-none absolute z-10 text-slate-400" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input auth-field-input"
              placeholder="Password"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? 'Signing you in...' : 'Sign in'}
        </button>
      </form>
    </AuthFrame>
  )
}
