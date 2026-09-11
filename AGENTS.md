# Leximory agent guide

## Start here

- This is a **pnpm Turborepo**. The primary product is `apps/leximory`; work there unless the task explicitly spans another app or shared package.
- Before changing **any Next.js code**, find and read the relevant installed documentation in `node_modules/next/dist/docs/`. The installed Next.js 16 docs are authoritative.
- Use `pnpm`, never npm. Verify Leximory changes with `pnpm --dir apps/leximory run check-types`; for the full repository use `turbo check-types`. Do not invoke `tsc` directly.
- Leximory development runs on port **3001** and also starts local Inngest and QStash: `pnpm --dir apps/leximory dev`.

## Repository map

- Workspace members are `apps/*` and `packages/*`. Turborepo task definitions and shared build environment inputs live in `turbo.json`; run cross-workspace tasks from the repository root.
- Apps: `leximory` is the language-learning product; `quiz` and `pouncepen` are separate Next.js apps. Do not couple them through app-to-app imports—extract genuinely shared code into `packages/`.
- Shared packages: `schema` owns Zod contracts; `env` validates configuration and exports shared constants; `supabase` owns typed database/auth clients; `service` owns reusable server-domain services; `ui` owns reusable UI; `kv`, `languages`, `scrape`, `user`, and `utils` own their respective cross-app concerns.
- Keep package public APIs deliberate: add an entry to its `package.json` `exports` map when a consumer needs a new shared module. Do not import another package’s private `src/` files.

## Structure and boundaries

- `apps/leximory/app/` is the App Router (pages, layouts, route handlers); `components/` is reusable UI; `service/` contains Server Actions; `server/` contains server-only auth, database, AI, and Inngest code; `lib/` contains app-local helpers. `@/*` resolves from `apps/leximory`.
- Put shared contracts/configuration in workspace packages, not app copies. Keep Leximory-only behavior local until another app actually needs it.
- Use `@repo/env` for validated configuration. Use the session-aware `@repo/supabase/server` client for request-scoped auth.
- Preserve authorization and quotas around libraries, texts, reviews, imports, and paid features. Keep server code server-only (`import 'server-only'` / Server Actions) and keep client components explicit with `'use client'`.
