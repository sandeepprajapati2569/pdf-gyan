import { useState } from 'react'
import { ArrowRight, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { register } from '../api/auth'
import AuthFrame from '../components/ui/AuthFrame'
import toast from 'react-hot-toast'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const res = await register({ name, email, password })
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
      subtitle="Upload PDFs, ask better questions, and keep everything in one clean place."
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
              onChange={(e) => setEmail(e.target.value)}
              className="field-input auth-field-input"
              placeholder="you@company.com"
            />
          </div>
        </div>

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

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? 'Creating your workspace...' : 'Create account'}
        </button>
      </form>
    </AuthFrame>
  )
}
