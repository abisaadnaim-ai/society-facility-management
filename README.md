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

## Status

**Phase 0 and Phase 1 complete.** Authentication, roles, the protected
application shell, and the UI foundation are in place. Operational modules
(Locations, Assets, Work Orders, etc.) are placeholder pages pending later
phases.

## Required manual Supabase configuration

These are one-time settings in the Supabase dashboard that cannot be applied
via migration:

1. **Authentication → URL Configuration**
   - Site URL: your production URL (e.g. `https://society-facility-management.vercel.app`)
   - Redirect URLs: add both `https://society-facility-management.vercel.app/auth/confirm`
     and `http://localhost:3000/auth/confirm` (for local dev)
2. **Authentication → Email Templates → Reset Password**
   - Confirm the link uses:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
   - This is Supabase's current default template format; only change it if it
     was previously customized.

Without step 1, the password-reset email link will redirect to the wrong host
and the flow will fail with "invalid or expired link" even on a fresh request.

## Creating the first Super Admin

There is intentionally no public sign-up page. To bootstrap the first admin:

1. In the Supabase dashboard, go to **Authentication → Users → Add user**
   (or **Invite user**, which emails them a set-password link) and create an
   account with the person's real email. A profile row is created
   automatically (default role: Viewer) the moment the user exists.
2. Run this SQL in the **SQL Editor** to promote that user to Super Admin
   (replace the email):

   ```sql
   update public.profiles
   set role_id = (select id from public.roles where code = 'super_admin')
   where email = 'admin@example.com';
   ```

   This bypasses the app entirely and runs as the Postgres owner, so the
   privilege-escalation trigger (which only blocks *client-driven* updates)
   does not apply here.
3. The user can now sign in at `/login` (using the password they set via the
   invite email, or one you set manually in the dashboard) and will see the
   full navigation.

User management UI (inviting/promoting users from within the app) is not
built yet — that's a later phase.

## Folder Structure

```
src/app/(auth)         → public auth routes: login, forgot/reset password, account-disabled, setup-error
src/app/auth/confirm    → route handler that completes the password-reset email link
src/app/(app)           → authenticated app shell + module routes
src/components/ui       → primitives (Button, Input, Select, Textarea, Badge, Card,
                           Dialog, Drawer, DropdownMenu, Loading/Empty/Error states, ConfirmDialog)
src/components/shared   → cross-module components (PageHeader, TableShell, SearchField,
                           FilterContainer, sign-out controls)
src/components/layout   → Sidebar, Header, MobileNav, AppShell, NavLinks
src/components/auth     → login/forgot-password/reset-password forms
src/lib/supabase        → browser + server Supabase clients (typed with Database)
src/lib/queries         → typed data-access functions, kept out of components
src/lib/types           → generated DB types + domain types (Profile, Role, SessionProfile)
src/lib/auth            → session context, permission helpers
supabase/migrations     → SQL migrations (schema source of truth)
```
