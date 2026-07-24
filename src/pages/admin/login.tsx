import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeSlash } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/hooks/use-admin'

const field =
  'w-full rounded-[1px] border border-line bg-transparent px-[15px] py-3 text-sm text-cream outline-none transition-colors focus:border-brass'

export const AdminLogin = () => {
  const navigate = useNavigate()
  const { session, isAdmin, loading } = useAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Already signed in as an admin? Skip the form.
  useEffect(() => {
    if (!loading && session && isAdmin) navigate('/admin/leads', { replace: true })
  }, [loading, session, isAdmin, navigate])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError('Invalid email or password.')
      setBusy(false)
      return
    }

    // Signed in — but only allowlisted admins may enter.
    const { data: admin } = await supabase.rpc('is_admin')
    if (admin !== true) {
      await supabase.auth.signOut()
      setError('This account is not an authorized admin.')
      setBusy(false)
      return
    }

    void data
    navigate('/admin/leads', { replace: true })
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-serif text-2xl text-cream">Infinity Rio Ranch</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-muted">
            Admin sign in
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${field} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-brass2"
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p className="text-[12px] text-[#d98a6a]">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-brass px-6 py-3 text-xs uppercase tracking-[0.22em] text-onbrass transition-colors hover:bg-brass2 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
