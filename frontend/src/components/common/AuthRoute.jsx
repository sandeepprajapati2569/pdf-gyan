import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { Loader2 } from 'lucide-react'

/**
 * AuthRoute — wraps login/register/forgot-password pages.
 * If user is already authenticated, redirect to dashboard.
 * Otherwise, show the auth page.
 */
export default function AuthRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return children
}
