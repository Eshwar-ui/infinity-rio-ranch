import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeSlash } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/hooks/use-admin'
import { SmartImage } from '@/components/ui/smart-image'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { logoFor, useThemeStore } from '@/store/theme'
import { btnPrimary, iconBtn } from '@/lib/admin-ui'

/**
 * Roomier than the panel's `field` — this form is the whole screen. Written out
 * rather than composed from `field`, because appending `px-3.5 text-[15px]` to a
 * string that already carries `px-3 text-[14px]` leaves the winner to stylesheet
 * order, not to the order they're written here.
 */
const loginField =
  'w-full rounded-md border border-line bg-panel/30 px-3.5 py-2.5 text-[15px] text-cream outline-none transition-colors placeholder:text-muted/50 focus:border-brass focus:bg-panel/60 focus:ring-2 focus:ring-brass/25'

export const AdminLogin = () => {
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
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
    <div className="admin-ui grid min-h-screen place-items-center bg-ink px-6">
      {/*
       * `/admin/login` sits outside RootLayout, so nothing had ever set
       * <html data-theme> on a direct load — the page fell through to the dark
       * `:root` tokens while the un-rehydrated store still read 'light'. Any
       * logo picked from that store would have been the dark cutout on a dark
       * page. Mounting the provider here makes the palette and the logo derive
       * from the same value again, in both themes.
       */}
      <ThemeProvider />
      <div className="w-full max-w-sm">
        {/*
         * The logo doubles as the way out of the admin area — this route is a
         * dead end otherwise, since the login screen renders without the public
         * navbar. The wordmark is in the artwork, so it replaces the serif
         * heading that used to repeat it. The text link underneath is there
         * because a logo alone doesn't read as clickable to everyone.
         */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            to="/"
            aria-label="Infinity at Rio Ranch — back to the website"
            className="group inline-flex"
          >
            <SmartImage
              src={logoFor(theme)}
              alt="Infinity at Rio Ranch"
              sizes="96px"
              priority
              className="h-24 w-auto transition-opacity duration-300 group-hover:opacity-75"
            />
          </Link>
          <div className="mt-3 text-[15px] font-medium text-cream">Admin sign in</div>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-brass2"
          >
            <ArrowLeft size={14} aria-hidden />
            Back to website
          </Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={loginField}
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${loginField} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className={`absolute right-1 top-1/2 -translate-y-1/2 ${iconBtn}`}
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p className="text-[13px] text-[#e0916f]">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className={`w-full ${btnPrimary}`}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
