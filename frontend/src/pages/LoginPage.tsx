import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { const r = await authApi.login(email, password); setAuth(r.user, r.access_token, r.refresh_token); navigate('/workspace') }
    catch (err: any) { setError(err.response?.data?.error || 'Login failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-tertiary px-4 relative">
      <div className="bg-bg-secondary p-8 rounded-xl shadow-2xl w-full max-w-sm border border-border">
        <h1 className="text-2xl font-bold text-center text-text-primary mb-1">Welcome back!</h1>
        <p className="text-center text-text-muted text-sm mb-6">We're so excited to see you again!</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-3 py-2 rounded-md">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-3 py-2.5 bg-bg-tertiary border border-border rounded-md text-text-primary focus:outline-none focus:border-brand text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-3 py-2.5 bg-bg-tertiary border border-border rounded-md text-text-primary focus:outline-none focus:border-brand text-sm" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-brand hover:bg-brand-hover text-white font-medium py-2.5 rounded-md transition-colors disabled:opacity-50 text-sm">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <p className="text-sm text-text-muted mt-4">Need an account? <Link to="/register" className="text-text-link hover:underline">Register</Link></p>
      </div>
      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-text-muted">
        TeamVault · Developed by{' '}
        <a href="https://strucureo.com" target="_blank" rel="noreferrer" className="text-brand hover:underline font-medium">
          Strucureo
        </a>
      </p>
    </div>
  )
}
