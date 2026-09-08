# FTLOM iOS 2.0

Production map app foundation (Despia + Next.js) on port **3002**.

Uses the **existing** Supabase backend (`public.accounts`, `place`, `page`, …) — same project as ios/web.

## Setup

```bash
pnpm install
cp env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (and server keys as needed).
pnpm dev
```

Production build:

```bash
pnpm type-check
pnpm build
pnpm start
```

## Vercel

Root of this repo is the Next.js app. Required env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` (production URLs)

**Story / post camera uploads** (presign → Cloudflare R2) also require on the host:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (e.g. `community-media`)
- `NEXT_PUBLIC_R2_PUBLIC_URL` (custom domain or `*.r2.dev` public base)

Without those, `/api/uploads/r2` returns **503 Media storage is not configured**. Copy from `apps/ios/.env.local` / `env.example`, and add your Despia / production origin to `r2-cors.json` on the bucket.

Optional for full tool/AI/wallet surfaces: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RAPIDAPI_KEY`, Stripe / RevenueCat keys (see `env.example`).

## Directory pages

User-generated `page.pages` (logos on the map). See [docs/pages-foundation.md](docs/pages-foundation.md).

## Legal policies

Versioned Terms + Privacy (platform-aware) live under `docs/legal/`. See [docs/legal/LEGAL_POLICIES.md](docs/legal/LEGAL_POLICIES.md). Apply `supabase/migrations/20260730_legal_policies.sql` to the shared Supabase project so signup can bind accounts to exact policy version IDs.
