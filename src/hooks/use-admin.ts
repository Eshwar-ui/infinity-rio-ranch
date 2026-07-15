import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

type AdminState = {
  loading: boolean
  session: Session | null
  isAdmin: boolean
}

/**
 * Tracks the Supabase session AND whether that user is an allowlisted admin.
 *
 * Being logged in is not enough — `is_admin()` checks the `admin_users` table so
 * a stray public signup can reach the login screen but never the panel. This is
 * a UX gate; the real data boundary is RLS on the tables themselves.
 */
export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({
    loading: true,
    session: null,
    isAdmin: false,
  })

  useEffect(() => {
    let active = true

    const resolve = async (session: Session | null) => {
      if (!session) {
        if (active) setState({ loading: false, session: null, isAdmin: false })
        return
      }
      const { data } = await supabase.rpc('is_admin')
      if (active) setState({ loading: false, session, isAdmin: data === true })
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      resolve(session),
    )

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return state
}
