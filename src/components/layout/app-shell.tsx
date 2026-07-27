import { Suspense, type ReactNode } from 'react'
import { Toaster } from 'sonner'

/**
 * Everything the app renders *around* the router.
 *
 * Both entry points must render an identical tree or hydration fails: the
 * prerenderer used to emit just the matched route while the client also mounted
 * a Suspense boundary and the Toaster, which React rejected as a mismatch
 * (error #418) and recovered from by re-rendering the whole page on the client —
 * throwing away the prerender's head start. Keep this the single definition of
 * the shell, and let `children` be the only thing that differs.
 */
export const AppShell = ({ children }: { children: ReactNode }) => (
  <>
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-ink text-sm uppercase tracking-[0.24em] text-muted">
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: {
          background: 'var(--panel)',
          color: 'var(--cream)',
          border: '1px solid var(--line)',
        },
      }}
    />
  </>
)
