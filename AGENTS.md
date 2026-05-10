<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Cadence.io — Agent Instructions

You are working on **Cadence.io**, a goal-and-momentum platform that helps users plan, execute, reflect, and build streaks of meaningful progress. Read this file in full before making any changes to the codebase.

## Project Overview

Cadence is a Next.js (App Router) application backed by Supabase. The app guides users through a planning loop: **Goals → Projects → Milestones → Tasks → Schedule**, supported by reflection layers (weekly reflections, quarterly reviews, momentum scores) and an AI mentor.

Key architectural facts:
- **Frontend:** Next.js (App Router) with TypeScript, in `/app`
- **Database & Auth:** Supabase (Postgres + RLS)
- **Auth flow:** Supabase Auth → `profiles` table mirrors `auth.users` 1:1
- **Onboarding:** Multi-step flow under `/app/onboarding/` (energy, goals, priorities, work-schedule, complete)
- **Main app:** `/app/dashboard/`
- **Server logic:** `/app/api/`
- **Shared utilities:** `/lib/`

---

## 🚨 DATABASE RULES — Read Before Any Data Work

This is the #1 source of bugs in this codebase. Pay attention.

### The Reference Doc Is Authoritative

Before generating **any** database query, Supabase client call, migration, or feature that touches data:

1. **Read `/docs/database/database_reference.md`.** It is the source of truth for all tables, columns, RLS policies, foreign keys, and known gotchas.
2. **Never assume a column or table exists.** If the reference doesn't list it, it doesn't exist. Either propose a migration or ask before assuming.
3. **Never assume a query will return rows without verifying RLS.** Every table is RLS-protected. If a query returns `[]`, the cause is likely:
   - The user isn't authenticated (`auth.uid()` is null)
   - The row's `user_id` doesn't match the current user
   - RLS policy denies the operation
4. **Always set `user_id` on insert.** Many `user_id` columns are nullable in schema but enforced via RLS — null rows will be invisible to their supposed owner.
5. **Watch for soft-link traps.** `projects.linked_goal_ids` is a jsonb array, NOT a foreign key. PostgREST embedded selects (`.select('*, goals(*)')`) will not traverse it.

If you find yourself wanting to call a column or table that isn't in the reference doc, **stop and surface this to the user** instead of writing code that will silently fail. This is the single biggest source of bugs in Cadence.

### Cadence Data Model (Quick Mental Map)

- **Identity:** `profiles` (extends `auth.users`)
- **Planning hierarchy:** `goals` → `projects` → `milestones` → `tasks`
- **Execution:** `schedule_items`, `energy_blocks`, `priority_stack`
- **Reflection:** `weekly_reflections`, `quarterly_reviews`, `momentum_scores`, `opportunity_evaluations`
- **AI coach:** `mentor_messages` (grouped by `session_id`, no parent table currently)
- **Social:** `friendships`, `community_actions`

Every user-owned row references `profiles.id` via `user_id` (or `actor_id`/`target_id`/`requester_id`/`addressee_id` for two-party tables).

### When Schema Changes

If you make changes to the database (new columns, tables, policies):

1. Apply the migration via Supabase
2. **Update `/docs/database/database_reference.md` in the same change**
3. If you can't update the doc, flag it explicitly so the user can do it

Schema drift in the reference doc is a leading cause of regressions. Treat it as a load-bearing document.

### Pre-Flight Checklist for Data Features

Before writing or modifying any query:

- [ ] I've read the relevant table section in `database_reference.md`
- [ ] Every column I'm referencing exists in the doc
- [ ] I'm setting `user_id` (or equivalent) on insert
- [ ] I understand which RLS policies apply to this operation
- [ ] If I need a new column or table, I've proposed a migration explicitly
- [ ] If using jsonb arrays as relations, I'm not relying on PostgREST embedded selects

### Debugging "Why Isn't This Working?"

The most common silent failures in Cadence:

1. **Empty array from a query** → RLS is filtering. Check `auth.uid()` and the row's `user_id`.
2. **"Column does not exist" error** → The frontend is referencing a column that was never added to the schema. Add the migration.
3. **Insert succeeds but row is invisible** → `user_id` was null on insert. Backfill it.
4. **Delete returns 0 rows affected** → No DELETE policy exists for that table (e.g. `profiles`, `friendships`, `community_actions`). Use status fields or service-role keys.
5. **Update doesn't persist** → Missing WITH CHECK on the UPDATE policy, or `updated_at` not being set (no auto-trigger exists).

---

## Code Conventions

### TypeScript
- Use TypeScript everywhere. No `any` unless explicitly justified.
- Prefer `type` over `interface` for object shapes unless extending.
- Database row types should match the reference doc exactly. If unsure, generate types from Supabase rather than handwriting them.

### File Structure
- Pages: `/app/[route]/page.tsx`
- API routes: `/app/api/[route]/route.ts`
- Shared logic: `/lib/`
- Database access: prefer co-locating Supabase queries with the feature that uses them, or in `/lib/supabase/`

### Supabase Client Usage
- Use the Supabase client appropriate to the context (server component, client component, route handler, middleware). Don't mix.
- For RLS-protected queries, use the user-scoped client (so `auth.uid()` is set).
- For admin operations that legitimately bypass RLS, use the service-role client — and only on the server.

### Component Patterns
- Server Components by default. Mark Client Components with `'use client'` only when needed (interactivity, hooks, browser APIs).
- Keep data fetching in Server Components or Route Handlers when possible.
- Forms: use Server Actions where appropriate.

---

## Cadence-Specific Gotchas

These are real bugs that have already happened in this codebase. Avoid repeating them.

### 1. The "test user with no profile row" trap
After signup, a `profiles` row must exist for the user to be functional. If you see "user is logged in but everything is empty," the `handle_new_user()` trigger may not have fired or may not exist. Check `auth.users` vs `profiles` for orphaned auth users.

### 2. Duplicate scheduling state
Both `tasks` (`scheduled_time`, `scheduled_date`, `duration_hours`) and `schedule_items` (`start_time`, `scheduled_date`, `duration_minutes`) carry scheduling info. Don't write features that update one without the other unless you've decided which is the source of truth.

### 3. Mismatched units across tables
- `tasks.duration_hours` is in **hours** (numeric, decimals OK)
- `schedule_items.duration_minutes` is in **minutes** (int)
- Always convert when comparing.

### 4. Mismatched priority types
- `goals.priority` is `int4` (integer)
- `tasks.priority` is `text`
- They are not the same type. Don't compare them directly.

### 5. jsonb soft-links aren't foreign keys
`projects.linked_goal_ids` is a `jsonb` array. PostgREST relational selects won't traverse it. Use `jsonb_array_elements_text()` on the SQL side, or fetch goals in a separate query.

### 6. Missing DELETE policies
`profiles`, `friendships`, and `community_actions` cannot be deleted by users via standard queries. Use status fields (`friendships.status = 'removed'`) or admin paths.

---

## What NOT to Do

- ❌ Don't write `.select('*, related_table(*)')` against `projects.linked_goal_ids` — it's a jsonb array, not a relation.
- ❌ Don't insert rows without `user_id` (or `actor_id`/`requester_id` for two-party tables).
- ❌ Don't add new columns or tables without updating `/docs/database/database_reference.md`.
- ❌ Don't write delete operations against tables with no DELETE policy without first adding the policy or using service-role.
- ❌ Don't store credentials, secrets, or service-role keys anywhere except `.env.local`.
- ❌ Don't bypass RLS without an explicit reason documented in code comments.

---

## When You're Unsure

If you're about to write code and you're uncertain whether a column exists, whether RLS will block a query, or whether you're modifying the right file — **ask the user**. A 30-second clarification beats an hour of debugging silent failures.