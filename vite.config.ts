import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The CMS fetch to Supabase is the only cross-origin request the public site
 * makes, and it happens right after first paint. Warming the connection in the
 * <head> saves the DNS + TLS round trip (~330 ms on a throttled mobile profile).
 * Injected from the env var rather than hardcoded so it follows the project.
 */
const supabasePreconnect = (supabaseUrl: string): Plugin => ({
  name: 'supabase-preconnect',
  transformIndexHtml: () =>
    supabaseUrl
      ? [
          {
            tag: 'link',
            attrs: { rel: 'preconnect', href: new URL(supabaseUrl).origin, crossorigin: '' },
            injectTo: 'head-prepend' as const,
          },
          {
            tag: 'link',
            attrs: { rel: 'dns-prefetch', href: new URL(supabaseUrl).origin },
            injectTo: 'head-prepend' as const,
          },
        ]
      : [],
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), supabasePreconnect(loadEnv(mode, process.cwd(), '').VITE_SUPABASE_URL)],
  build: {
    // Hashed bundles live under /build so /assets (the venue's photos, copied
    // verbatim from public/) can carry a shorter, replaceable cache policy.
    assetsDir: 'build',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
}))
