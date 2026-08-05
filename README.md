# Infinity at Rio Ranch

Marketing site, CMS, client portal, and invoicing workflow for Infinity at Rio Ranch.

## Commands

```bash
npm run dev
npm run lint
npm run build
```

`npm run build` refreshes the committed CMS snapshot, checks types, builds the client and server entries, and prerenders public routes.

## Project layout

- `src/` â€” React application: public pages, admin routes, shared components, hooks, data, and utilities.
- `supabase/` â€” schema migrations and Edge Functions.
- `scripts/` â€” CMS snapshot, prerender, image, and agreement-preview tooling.
- `public/` â€” deployed static assets.
- `docs/` â€” deployment, SEO, operational, implementation-history, and admin setup documentation.
- `design/` â€” archived Claude Design handoff; reference only, not application code.

## Documentation

- [Deployment](docs/DEPLOY.md)
- [Operations runbook](docs/RUNBOOK.md)
- [SEO architecture](docs/SEO.md)
- [Admin implementation plan](docs/admin-plan.md)
