import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { btnQuiet, hint, label } from '@/lib/admin-ui'

const SETTING_KEY = 'vercel_deploy_hook'

/**
 * Triggers a Vercel rebuild so CMS edits reach crawlers.
 *
 * Saving content updates the database, which the live site picks up immediately
 * for anyone running JavaScript. The prerendered HTML in `dist/` — what GPTBot,
 * ClaudeBot, PerplexityBot and Google's non-JS pass actually read — is only
 * rewritten by a build, because that's when `pull:content` snapshots the tables.
 * This button is what closes that gap.
 *
 * The hook URL lives in `site_settings`, not in an env var, because everything
 * in the bundle is public: the admin chunk is lazy-loaded but still served to
 * anyone who asks, so a `VITE_` deploy hook would be a free rebuild button for
 * the internet. `site_settings` is admin-only under RLS.
 */
export const PublishBar = () => {
  const [hook, setHook] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setHook(data?.value ? String(data.value) : '')
        setDraft(data?.value ? String(data.value) : '')
      })
    return () => {
      active = false
    }
  }, [])

  const saveHook = async () => {
    const value = draft.trim()
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: SETTING_KEY, value }, { onConflict: 'key' })
    if (error) {
      toast.error('Could not save the deploy hook.')
      return
    }
    setHook(value)
    setEditing(false)
    toast.success(value ? 'Deploy hook saved.' : 'Deploy hook cleared.')
  }

  const publish = async () => {
    if (!hook) return
    setBusy(true)
    try {
      /*
       * `no-cors`: Vercel's deploy-hook endpoint sends no CORS headers, so the
       * browser will not let us read the response. A POST with no custom
       * headers is still a "simple request", so it does reach Vercel — we just
       * can't see what it said. Hence the deliberately hedged wording below:
       * claiming success we can't observe would be worse than admitting it.
       */
      await fetch(hook, { method: 'POST', mode: 'no-cors' })
      toast.success('Rebuild requested — the live site updates in a minute or two.')
    } catch {
      toast.error('Could not reach the deploy hook.')
    } finally {
      setBusy(false)
    }
  }

  if (hook === null) return null

  return (
    <div className="border-t border-line px-5 py-4">
      {editing || !hook ? (
        <div>
          <label className={label}>Vercel deploy hook</label>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://api.vercel.com/v1/integrations/deploy/…"
            className="w-full rounded-md border border-line bg-panel/30 px-2.5 py-1.5 text-[12px] text-cream outline-none transition-colors placeholder:text-muted/50 focus:border-brass focus:ring-2 focus:ring-brass/25"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={saveHook}
              className="text-[13px] font-semibold text-brass2 transition-colors hover:text-brass"
            >
              Save
            </button>
            {hook && (
              <button
                onClick={() => {
                  setDraft(hook)
                  setEditing(false)
                }}
                className={btnQuiet}
              >
                Cancel
              </button>
            )}
          </div>
          <p className={hint}>
            Vercel → Project Settings → Git → Deploy Hooks. Without it, edits stay
            invisible to search engines until the next deploy.
          </p>
        </div>
      ) : (
        <div>
          <button
            onClick={publish}
            disabled={busy}
            className="w-full rounded-md bg-brass px-4 py-2 text-[13px] font-semibold text-onbrass transition-colors hover:bg-brass2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50 disabled:opacity-50"
          >
            {busy ? 'Requesting…' : 'Publish to live site'}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="mt-2 w-full text-[12px] font-medium text-muted transition-colors hover:text-brass2"
          >
            Change deploy hook
          </button>
        </div>
      )}
    </div>
  )
}
