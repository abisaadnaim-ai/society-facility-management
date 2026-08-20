# Society Facility Management

Generic, scalable facility operations platform (work orders, assets, preventive
maintenance, inspections, vendors, inventory, reporting) across multiple
locations. Hierarchy: **Organization → Location → Area → Asset**.

This is a standalone project with its own GitHub repository, Supabase project,
and Vercel project. It has no dependency on any other application.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres, Auth, Storage, RLS)
- Vercel (hosting)

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | This project's Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | This project's Supabase publishable/anon key |

## Folder Structure

```
src/app/(auth)         → public auth routes (login, reset-password)
src/app/(app)          → authenticated app shell + module routes
src/components/ui      → primitives
src/components/shared  → cross-module components (tables, filters, status badges)
src/components/layout  → sidebar, header
src/lib/supabase       → browser + server Supabase clients
src/lib/queries        → typed data-access functions, kept out of components
src/lib/types          → generated DB types + domain types
src/lib/auth           → role/permission helpers
supabase/migrations    → SQL migrations (schema source of truth)
```

## Status

Infrastructure scaffold only. No database schema, auth wiring, or module
functionality has been built yet — see project roadmap for phased build-out.
