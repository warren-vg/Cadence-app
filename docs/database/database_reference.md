# Cadence.io — Database Reference

**Source of truth for all database structure.** Always consult this document before generating any query, Supabase client call, or feature that touches data. Never assume a column or table exists. Never assume a query will return rows without verifying the RLS policy permits it for the current auth context.

- **Database:** Supabase (Postgres)
- **Schema:** `public`
- **Tables:** 21
- **RLS:** Enabled on all tables
- **Last updated:** June 10, 2026 — Phase 3 Variable Rewards: `reward_events` table added (persistent idempotent reward tracking). Phase 3D Daily Touchpoints: `daily_reflections` table added (daily touchpoint check-in data). Phase 3C Username System: `profiles.full_name` added (display name, migrated from old `username`); `profiles.username` repurposed as @handle (now nullable, format-constrained, case-insensitive unique index); `profiles.username_changed_at` added for 30-day cooldown. `profiles` column count 16→18.

---

## Data Model Overview

Cadence is a goal-and-momentum platform built on Supabase. The data model has five conceptual layers:

1. **Identity** — `profiles` extends Supabase's `auth.users` and is the central user entity. Every user-owned table has a `user_id` foreign key to `profiles.id`.
2. **Planning** — `goals` → `projects` → `milestones` → `tasks` form the planning hierarchy. Goals are top-level intentions; projects are bundles of work; milestones mark progress; tasks are the executable units.
3. **Execution** — `schedule_items` and `energy_blocks` handle when work happens. `priority_stack` ranks what matters now.
4. **Reflection & Momentum** — `weekly_reflections`, `quarterly_reviews`, `momentum_scores`, and `opportunity_evaluations` capture the introspection loop.
5. **AI & Social** — `mentor_messages` stores the AI coach conversations. `friendships` and `community_actions` power the social layer.

### Standard RLS Pattern

Most tables use `auth.uid() = user_id` as a single ALL-command policy. Tables with more nuanced access (`profiles`, `goals`, `friendships`, `community_actions`) split into per-command policies. Every policy is documented per-table below.

### Quick Reference: Table Inventory

| Table | Purpose | Columns | RLS Policies |
|---|---|---|---|
| `profiles` | User identity & app-level user data | 19 | 3 |
| `goals` | Top-level user intentions | 17 | 4 |
| `projects` | Bundles of work toward goals | 10 | 1 |
| `milestones` | Progress markers within goals | 9 | 1 |
| `tasks` | Executable units of work | 19 | 1 |
| `project_tasks` | Ordered subtask checklist within a project | 7 | 1 |
| `schedule_items` | Calendar/time-block entries | 12 | 1 |
| `energy_blocks` | Recurring energy patterns by day/time | 8 | 1 |
| `priority_stack` | Reserved: future richer priority metadata | 6 | 1 |
| `weekly_reflections` | Weekly journaling/reflection entries | 10 | 1 |
| `quarterly_reviews` | Quarterly retrospective entries | 15 | 1 |
| `quarterly_events` | Key events and blocks per quarter | 7 | 1 |
| `pivots` | Historical log of accepted quarterly pivots | 6 | 1 |
| `momentum_scores` | Weekly momentum + streak tracking | 6 | 1 |
| `opportunity_evaluations` | Decision framework scoring | 12 | 1 |
| `mentor_messages` | AI coach conversation history | 6 | 1 |
| `friendships` | Friend request/connection state | 6 | 4 |
| `community_actions` | Social activity feed events | 6 | 2 |
| `notifications` | In-app notification inbox per user | 9 | 1 |
| `monthly_snapshots` | Auto-generated end-of-month snapshots | 14 | 1 |
| `daily_reflections` | Daily touchpoint check-in data per user | 12 | 1 |
| `reward_events` | Persistent idempotent reward/achievement records | 8 | 3 |

---

## Table: `profiles`

**Purpose:** Central user entity. Mirrors `auth.users` (id matches `auth.uid()`) and stores app-level user data including onboarding state, daily notes, energy preferences, schedule configuration, and a fast-access priority snapshot.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | **Primary key.** Matches `auth.users.id` |
| `full_name` | text | YES | Display name (e.g. "Warren G"). Migrated from old `username` column. Used in greetings and the Settings "Name" field. |
| `username` | text | YES | **@handle** (e.g. `warren_vg`). Stored as user typed; uniqueness enforced case-insensitively via `profiles_username_unique_idx` on `LOWER(username)`. Format: `^[a-zA-Z][a-zA-Z0-9_]{2,19}$` (enforced by `profiles_username_format` CHECK constraint). NULL for users who have not yet chosen a handle — blocked by the username backfill modal until set. |
| `username_changed_at` | timestamptz | YES | Timestamp of the last `username` change. Used to enforce the 30-day cooldown. NULL if the user has never changed their handle (first-time setting is always allowed). |
| `avatar_url` | text | YES | Optional profile image URL |
| `onboarding_complete` | bool | YES | Gate for onboarding flow |
| `daily_notes` | jsonb | YES | Free-form daily notes keyed by date |
| `low_energy_dates` | text[] | YES | Array of dates flagged as low energy |
| `quarter_locked` | jsonb | YES | Map of quarter → bool, e.g. `{"Q1 2026": true}`. Persists lock state per quarter. |
| `weekly_capacity` | int4 | YES | Max hours per week the user plans to work. Derived sum of `capacity_schedule` hours — recomputed and updated each time `capacity_schedule` is saved. |
| `capacity_schedule` | jsonb | YES | Per-day capacity breakdown set during onboarding. Shape: `{ "monday": { "hours": 2, "time_of_day": "morning" }, "tuesday": ..., "wednesday": ..., "thursday": ..., "friday": ..., "saturday": ..., "sunday": ... }`. `time_of_day` is one of `morning`, `afternoon`, `night`. All seven day keys must be present when written. |
| `energy_blocks` | jsonb | YES | User-configured energy patterns (snapshot; mirrors `energy_blocks` table) |
| `work_schedule` | jsonb | YES | Days/hours the user works, set during onboarding |
| `priority_stack` | jsonb | YES | Current priority stack snapshot for fast access |
| `notifications` | jsonb | YES | **Legacy** notification preference flags. Shape: `{ weeklyReviewReminder: bool, dailyPlanReminder: bool, goalProgressUpdates: bool, friendActivity: bool }`. Read/written by `app/dashboard/settings/page.tsx`. |
| `notification_preferences` | jsonb | YES | **Phase 3A** in-app notification opt-in flags. Shape: `{ "morning_touchpoint": bool, "weekly_review": bool, "streak_milestone": bool, "ai_insight": bool, "goal_progress": bool, "monthly_snapshot": bool }`. Default: all true. |
| `first_run_completed` | bool | NO | **Phase 3E** first-run tour gate. `false` on new users — triggers the guided app tour on first dashboard load. Set to `true` by `markFirstRunComplete()` in `lib/db.ts` when the user finishes or skips the tour. Existing users backfilled to `true` at migration time so the tour never auto-launches for them. |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (3)

- **SELECT** `Users can view their own profile` — USING `auth.uid() = id` (authenticated)
- **INSERT** `Users can insert their own profile` — WITH CHECK `auth.uid() = id` (authenticated)
- **UPDATE** `Users can update their own profile` — USING & WITH CHECK `auth.uid() = id` (authenticated)

### Relationships

- **Has many:** Every other user-owned table references `profiles.id` via `user_id`

### Constraints

- **Index:** `profiles_username_unique_idx` — `UNIQUE` on `LOWER(username) WHERE username IS NOT NULL`. Enforces case-insensitive uniqueness for @handles; allows multiple NULL rows (users without a handle).
- **CHECK:** `profiles_username_format` — `username IS NULL OR username ~ '^[a-zA-Z][a-zA-Z0-9_]{2,19}$'`. Enforces 3–20 chars, starts with a letter, alphanumeric + underscores only.

### ⚠️ Notes for Claude Code

- A user has no `profiles` row until one is explicitly inserted. If you see "user logged in but data missing," check whether the profile row was created post-signup (typically via a `handle_new_user()` trigger on `auth.users`).
- `username` is now **nullable** — NULL means the user has not yet chosen a @handle. The username backfill modal gates app access until it is set. Do NOT use `username` as a display name anywhere — use `full_name` for that.
- `full_name` is the display name (shown in greetings, the Settings "Name" field, etc.). It is nullable in the schema but always populated for new users via onboarding. Read it as `full_name ?? username ?? 'there'` as a safe fallback until all users have migrated.
- `username_changed_at` tracks the last @handle change. Cooldown logic: if `username_changed_at IS NULL`, first-time set is always allowed. If set, allow change only if `now() >= username_changed_at + INTERVAL '30 days'`. Helper: `canChangeUsername(userId)` in `lib/db.ts`.
- `first_run_completed` is the one-time tour gate. Read it on dashboard mount; if `false`, auto-launch the guided tour. Set it `true` via `markFirstRunComplete(userId)` in `lib/db.ts` when the user finishes or skips the tour. The Settings "Take the App Tour" replay must NOT update this flag — the flag must remain `true` after the first run so the tour never auto-launches again.
- There is **no DELETE policy** — users cannot delete their own profile through standard queries. Profile deletion must go through `auth.users` (cascading) or an admin path.
- `profiles.priority_stack` is a jsonb snapshot of the user's current priorities, used for fast reads. The `priority_stack` table is reserved for future richer per-row priority metadata. In current application code, read and write priorities via `profiles.priority_stack`; do not query the `priority_stack` table unless adding features that require row-level data.

---

## Table: `goals`

**Purpose:** Core goal records per user including category, status, SMART fields, quarter assignment, and progress tracking. The root of the planning hierarchy.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | **FK → profiles.id** (defaults to `auth.uid()`) |
| `text` | text | YES* | Goal description. *NOT NULL after fix* |
| `category` | text | YES | E.g. Personal Growth, Career, Health |
| `status` | text | YES | E.g. inbox, active, paused, archived |
| `priority` | int4 | YES | Numeric priority |
| `progress` | int4 | YES | 0–100 |
| `refined_goal` | text | YES | AI-refined version of the goal |
| `metric` | text | YES | How success is measured (SMART: Measurable) |
| `purpose` | text | YES | The "why" behind the goal |
| `notes` | text | YES | Free-form notes |
| `quarter` | text | YES | E.g. "Q1 2026" |
| `estimated_weekly_hours` | int2 | YES | Effort estimate |
| `project_id` | uuid | YES | **FK → projects.id** (ON DELETE SET NULL) — optional, groups this goal under a project |
| `steps` | text[] | YES | Lightweight text checklist items (plain strings, no completion state) |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (4 — per-command)

- **SELECT** `Users can read own goals` — USING `auth.uid() = user_id` (authenticated)
- **INSERT** `Users can insert own goals` — WITH CHECK `auth.uid() = user_id` (authenticated)
- **UPDATE** `Users can update own goals` — USING & WITH CHECK `auth.uid() = user_id` (authenticated)
- **DELETE** `Users can delete own goals` — USING `auth.uid() = user_id` (authenticated)

### Relationships

- **Belongs to:** `profiles` (via `user_id`), `projects` (via `project_id`, optional)
- **Has many:** `tasks` (via `tasks.goal_id`), `milestones` (via `milestones.goal_id`), `schedule_items` (via `schedule_items.linked_goal_id`)

### ⚠️ Notes for Claude Code

- `user_id` defaults to `auth.uid()` so you don't need to supply it on insert if calling as the authenticated user.
- `project_id` is nullable — a goal does not need to belong to a project. When set, it means this goal is grouped under that project for collective progress tracking.
- `steps` is a plain text checklist (no completion state). For structured checkpoints with completion tracking, see the `milestones` table (which has a `goal_id` FK to this table).
- Status values are convention-based, not enforced by a CHECK constraint. Validate at the app layer.
- **Goal progress** is calculated exclusively from task completion: `(completed_tasks / total_tasks) * 100`. Do NOT derive progress from milestone completion. Use `recalcGoalProgressFromTasks()` in `lib/db.ts` as the single canonical function.

---

## Table: `projects`

**Purpose:** Bundles of work that progress one or more goals. Sits between goals and tasks in the planning hierarchy.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `title` | text | YES | Project name |
| `type` | text | YES | Project category |
| `status` | text | YES | E.g. planning, active, complete |
| `progress` | int4 | YES | 0–100 |
| `timeline` | text | YES | Free-form timeline description |
| `notes` | text | YES | Free-form notes |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their projects` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles` (via `user_id`)
- **Has many:** `goals` (via `goals.project_id`), `milestones` (via `milestones.project_id`), `tasks` (via `tasks.project_id`), `project_tasks` (via `project_tasks.project_id`)

### ⚠️ Notes for Claude Code

- A project groups **many goals** — the FK lives on `goals.project_id`, not on `projects`. To list a project's goals: `.from('goals').select('*').eq('project_id', projectId)`.
- `user_id` is nullable in the schema but the RLS policy requires `auth.uid() = user_id`, so a null `user_id` row is functionally inaccessible. Always set it on insert.
- **Project progress** is not yet auto-calculated. Future intent: average of all linked goals' `progress` values. Do not use `project_tasks` completion as a proxy for project progress.

---

## Table: `milestones`

**Purpose:** Progress markers within a goal or project. Used to break larger work into checkpoint moments.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | **FK → profiles.id** (ON DELETE CASCADE) |
| `goal_id` | uuid | NO | **FK → goals.id** (ON DELETE CASCADE) — required, every milestone belongs to a goal |
| `project_id` | uuid | YES | **FK → projects.id** (ON DELETE SET NULL) — optional |
| `text` | text | NO | Milestone description |
| `completed` | bool | NO | Defaults false |
| `target_date` | date | YES | When this should be hit |
| `created_at` | timestamptz | NO | |
| `updated_at` | timestamptz | NO | |

### RLS Policies (1)

- **ALL** `Users own their milestones` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles` (via `user_id`), `goals` (via `goal_id`, required), `projects` (via `project_id`, optional)
- **Has many:** `tasks` (via `tasks.milestone_id`, optional — tasks that belong to this milestone)

### ⚠️ Notes for Claude Code

- `goal_id` is **NOT NULL** — every milestone must belong to a goal. Never insert a milestone without `goal_id`.
- `completed` is managed at the app layer. The canonical meaning is: a milestone is considered complete when all tasks with `milestone_id = this milestone` are complete. The `completed` bool is the stored result of that calculation — update it when the last task in the milestone is toggled.
- `project_id` is optional. Set it when the goal belongs to a project (copy from `goals.project_id`), but do not require it.
- Always set `updated_at` on update — there is no auto-trigger.

---

## Table: `tasks`

**Purpose:** Executable units of work. Can be tied to a goal and/or project, scheduled to specific dates/times, and tagged with effort estimates.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | **FK → profiles.id** |
| `goal_id` | uuid | NO | **FK → goals.id** — required, every task belongs to a goal |
| `milestone_id` | uuid | YES | **FK → milestones.id** (ON DELETE SET NULL) — optional, links task to a milestone |
| `project_id` | uuid | YES | **FK → projects.id** |
| `text` | text | NO | Task description |
| `priority` | text | YES | Priority label — valid values: `'high'`, `'medium'`, `'low'`, or NULL. Enforced by `tasks_priority_check` CHECK constraint (applied). (NOT integer like `goals.priority`) |
| `completed` | bool | NO | Completion state, defaults false |
| `scheduled_time` | time | YES | Time of day (no date component) |
| `date` | date | NO | Date the task is scheduled for |
| `duration` | numeric | NO | Estimated effort in hours (decimals allowed, e.g. 0.5 = 30 min) |
| `source` | text | YES | Where the task originated — `manual` (user-created) or `auto` (Build Week generated) |
| `category` | text | NO | Task category label (e.g. Career, Personal, Health), defaults 'Career' |
| `completed_at` | timestamptz | YES | Timestamp when the task was marked complete |
| `created_at` | timestamptz | YES | |
| `is_recurrence_template` | boolean | NO | Defaults `false`. `true` on master template rows — these have no `date` and are filtered from all display queries. |
| `recurrence_template_id` | uuid | YES | **FK → tasks.id** (ON DELETE SET NULL) — on instance rows, points to the template. Null on standalone and template rows. |
| `recurrence_rule` | jsonb | YES | Set on template rows only. Shape: `{ "frequency": "daily"\|"weekly", "days_of_week": [0–6], "ends_on": "YYYY-MM-DD"\|null }` |

### Constraints

- **Index:** `tasks_recurrence_template_id_idx` on `recurrence_template_id` WHERE NOT NULL — for efficient instance lookups.

### RLS Policies (1)

- **ALL** `Users own their tasks` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles` (via `user_id`), `goals` (via `goal_id`, required), `milestones` (via `milestone_id`, optional), `projects` (via `project_id`, optional)
- **Linked from:** `schedule_items.linked_task_id`
- **Self-referencing:** `recurrence_template_id` → `tasks.id` (instances → template)

### ⚠️ Notes for Claude Code

- `goal_id` is **NOT NULL** — every task must have a goal. Never insert a task without `goal_id`. Orphan tasks (no goal) are a hierarchy violation.
- `milestone_id` is nullable — tasks may or may not belong to a milestone. When set, the task counts toward that milestone's completion.
- `priority` on tasks is `text`, not `int4` — this differs from `goals.priority` which is `int4`. Don't mix them up.
- `date` is **nullable** (E2 migration). Template rows (`is_recurrence_template = true`) have `date = null`. All display queries must filter `WHERE is_recurrence_template = false OR is_recurrence_template IS NULL` (or equivalently `.eq('is_recurrence_template', false)`). Never show template rows in task lists.
- `duration` is the column name for effort in hours (`numeric`, supports decimals like 0.5 = 30 min). The old name `duration_hours` was renamed — use `duration` in all queries.
- `scheduled_time` is `time` (no date). To get a full datetime, combine `date` + `scheduled_time` in app code.
- `completed_at` is set by the app when `completed` flips to `true`. It is not auto-populated by a trigger — set it explicitly on update.
- `tasks` carries all scheduling state (`date`, `scheduled_time`, `duration`). `schedule_items` is a reserved future layer — do not write code that depends on it for scheduling until Phase 3 calendar integration.
- **Recurrence pattern — Template vs Instance:** A recurring task has one template row (`is_recurrence_template = true`, no `date`) that carries the `recurrence_rule`. Concrete occurrences are instance rows (`is_recurrence_template = false`, `recurrence_template_id = template.id`, normal `date`). Deleting the template sets `recurrence_template_id = null` on all instances (they become standalone tasks — past history is preserved). To stop generating new instances, set `recurrence_rule.ends_on` to a past date rather than deleting the template.

---

## Table: `schedule_items`

**Purpose:** Calendar/time-block entries. The bridge between planning (goals/tasks) and time (when it happens).

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `linked_task_id` | uuid | YES | **FK → tasks.id** |
| `linked_goal_id` | uuid | YES | **FK → goals.id** |
| `title` | text | YES | Display title for the schedule entry |
| `start_time` | time | YES | Time of day (no date) |
| `scheduled_date` | date | YES | Date this is scheduled for |
| `duration_minutes` | int4 | YES | Duration in minutes (NOT hours like tasks) |
| `category` | text | YES | E.g. focus, meeting, break |
| `is_flexible` | bool | YES | Whether it can be moved if needed |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their schedule` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles`, `tasks` (optional), `goals` (optional)

### ⚠️ Notes for Claude Code

- **This table is currently unused.** All scheduling state lives on the `tasks` table (`date`, `scheduled_time`, `duration`). `schedule_items` is reserved for a future scheduling layer abstraction (Phase 3 calendar integration). Do not write code that reads from or writes to `schedule_items` until that work is scoped. When it is implemented, `schedule_items` will become the canonical scheduling layer and `tasks.date`/`tasks.scheduled_time` will become read-only denormalized copies.
- **⚠️ Dormant bug:** `getScheduleForDate()` in `lib/db.ts` queries `.eq('date', dateStr)` but the column is `scheduled_date`. Fix this before activating the table in Phase 3.
- `duration_minutes` is in **minutes**, while `tasks.duration` is in **hours**. Always convert when the two tables are eventually joined.
- `start_time` is `time` (no date). The full scheduled moment is `scheduled_date` + `start_time` combined in app code.

---

## Table: `project_tasks`

**Purpose:** Ordered subtask checklist within a project. Lightweight to-do items scoped to a project — distinct from scheduling-aware `tasks`.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `project_id` | uuid | YES | **FK → projects.id** |
| `text` | text | YES | Task description |
| `completed` | bool | YES | Completion state |
| `order_index` | int4 | YES | Display order within the project |
| `created_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their project tasks` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles`, `projects`

### ⚠️ Notes for Claude Code

- `project_tasks` is **not** the same as `tasks`. `tasks` are scheduling-aware (dates, times, duration in hours). `project_tasks` are ordered checklist items with no scheduling concept.
- Always set `order` on insert and update it when reordering — there is no auto-increment trigger.

---

## Table: `energy_blocks`

**Purpose:** Recurring energy patterns by day-of-week and time-of-day. Used for matching tasks to user's natural energy rhythm.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `type` | text | YES | E.g. high, medium, low |
| `start_time` | time | YES | Time of day (no date) |
| `end_time` | time | YES | Time of day (no date) |
| `day_of_week` | text | YES | E.g. "Monday", "Tuesday" |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their energy blocks` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles`

### ⚠️ Notes for Claude Code

- `day_of_week` is `text`, not an enum or integer. Convention is full day name strings — validate at app layer.
- `start_time`/`end_time` are `time` (no date), so these are recurring weekly blocks, not one-off events.

---

## Table: `priority_stack`

**Purpose:** Reserved for future richer per-row priority metadata. Not used directly by current application code.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `category` | text | YES | Priority category |
| `rank` | int4 | YES | Order in the stack |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their priority stack` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles`

### ⚠️ Notes for Claude Code

- **Do not read from this table in application code** unless you are adding a feature that explicitly requires row-level priority data. Current application code reads and writes priorities via `profiles.priority_stack` (a jsonb snapshot column) for fast access. See `profiles` table notes for the full pattern.

---

## Table: `weekly_reflections`

**Purpose:** Weekly journaling/reflection entries. Captures wins, challenges, learnings, and forward focus for each week.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `week_of` | date | YES | The week being reflected on |
| `wins` | text | YES | What went well |
| `challenges` | text | YES | What was hard |
| `learnings` | text | YES | What was learned |
| `next_week_focus` | text | YES | Forward-looking focus |
| `week_score` | int4 | YES | Numeric self-assessment score for the week (0–100) |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their reflections` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles`

### ⚠️ Notes for Claude Code

- Unique constraint `weekly_reflections_user_week_unique` on `(user_id, week_of)` — use `.upsert({...}, { onConflict: 'user_id,week_of' })` to safely save or update a week's reflection without duplicates.

---

## Table: `quarterly_reviews`

**Purpose:** Quarterly retrospective entries. One row per user per quarter.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `quarter_label` | text | YES | E.g. "Q1 2026" |
| `quarter_summary` | text | YES | Narrative summary (legacy — prefer `wins`/`challenges`) |
| `progress_assessment` | text | YES | Self-assessment narrative (legacy) |
| `next_quarter_goals` | text | YES | Forward-looking goals (legacy) |
| `wins` | text | YES | What worked well this quarter |
| `challenges` | text | YES | What needs to change |
| `performance_score` | int4 | YES | Computed avg progress across quarter goals (0–100) |
| `goals_completed` | int4 | YES | Count of goals at 100% this quarter |
| `goals_total` | int4 | YES | Total goals tracked this quarter |
| `ai_pivots` | jsonb | YES | Array of pivot action objects applied or suggested |
| `next_quarter_theme` | jsonb | YES | `{ theme: string, focus: string }` for next quarter |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### Constraints

- **Unique:** `quarterly_reviews_user_quarter_unique` on `(user_id, quarter_label)` — use `.upsert({...}, { onConflict: 'user_id,quarter_label' })` to save without duplicates.

### RLS Policies (1)

- **ALL** `Users own their quarterly reviews` — USING `auth.uid() = user_id` (public)

### ⚠️ Notes for Claude Code

- Always upsert with `onConflict: 'user_id,quarter_label'` — never plain insert.
- `wins` and `challenges` are the canonical reflection fields. The legacy columns `quarter_summary`, `progress_assessment`, `next_quarter_goals` remain for backwards compatibility but are not written by current app code.

---

## Table: `quarterly_events`

**Purpose:** Key events and time blocks for a given quarter. User-entered fixed obligations (vacations, deadlines, blocks). Will be populated from calendar integrations in Phase 4.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | **FK → profiles.id** (ON DELETE CASCADE) |
| `quarter_label` | text | NO | E.g. "Q2 2026" |
| `title` | text | NO | Event name |
| `start_date` | date | YES | Inclusive start |
| `end_date` | date | YES | Inclusive end |
| `type` | text | YES | One of `'vacation'`, `'event'`, `'block'` (CHECK constraint) |
| `created_at` | timestamptz | NO | |

### RLS Policies (1)

- **ALL** `Users own their quarterly events` — USING `auth.uid() = user_id` (public)

### ⚠️ Notes for Claude Code

- Filter by both `user_id` AND `quarter_label` when loading — rows from other quarters will otherwise appear.
- Order by `start_date ASC` for display. Rows with null `start_date` sort first.
- See `docs/TODO_PHASE_4.md` for the planned calendar sync integration.

---

## Table: `pivots`

**Purpose:** Historical log of accepted quarterly pivots. One row per pivot acceptance event.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | **FK → profiles.id** (ON DELETE CASCADE) |
| `quarter_label` | text | NO | E.g. "Q2 2026" |
| `pivot_summary` | text | YES | Human-readable summary of the pivot |
| `goals_paused` | jsonb | YES | Array of `{ id, text }` objects for paused goals |
| `goals_activated` | jsonb | YES | Array of `{ id, text }` objects for goals receiving new tasks |
| `created_at` | timestamptz | NO | |

### RLS Policies (1)

- **ALL** `Users own their pivots` — USING `auth.uid() = user_id` (public)

---

## Table: `momentum_scores`

**Purpose:** Weekly momentum tracking. One row per user per week.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `week_of` | date | YES | The week this score covers |
| `score` | int4 | YES | Numeric momentum score |
| `streak_count` | int4 | YES | Consecutive weeks of momentum |
| `created_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their momentum scores` — USING `auth.uid() = user_id` (public)

### ⚠️ Notes for Claude Code

- Unique constraint `momentum_scores_user_week_unique` on `(user_id, week_of)` — use `.upsert({...}, { onConflict: 'user_id,week_of' })` when recording or updating a week's momentum score.

---

## Table: `opportunity_evaluations`

**Purpose:** Decision-framework scoring for evaluating new opportunities. Captures upside/cost analysis and final decision.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | **FK → profiles.id** |
| `title` | text | NO | Opportunity name |
| `upside` | int4 | YES | Upside score |
| `alignment` | int4 | YES | Alignment with goals score |
| `urgency` | int4 | YES | Urgency score |
| `time_cost` | int4 | YES | Time cost score |
| `energy_cost` | int4 | YES | Energy cost score |
| `money_cost` | int4 | YES | Money cost score |
| `score` | int4 | NO | Computed total score |
| `decision` | text | NO | Final decision (e.g. yes/no/defer) |
| `created_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users manage own evaluations` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles`

---

## Table: `mentor_messages`

**Purpose:** AI coach conversation history. Each row is a single message in a conversation thread.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `session_id` | uuid | YES | Conversation session grouping (no FK) |
| `role` | text | YES | `user` or `assistant` |
| `content` | text | YES | Message body |
| `created_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their mentor messages` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles`
- **Grouped by:** `session_id` (no FK constraint — there's no `mentor_sessions` table currently)

### ⚠️ Notes for Claude Code

- `session_id` has no FK and no parent table. To list all messages in a session, query by `session_id` directly. Consider adding a `mentor_sessions` table if you need session-level metadata (title, summary, started_at, etc.).
- Order messages by `created_at` to reconstruct the conversation. Adding an index on `(user_id, session_id, created_at)` would speed this up if not already present.

---

## Table: `friendships`

**Purpose:** Friend request and connection state between two users.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** (the user who initiated the friendship) |
| `friend_id` | uuid | YES | **FK → profiles.id** (the other user) |
| `status` | text | YES | E.g. pending, accepted, blocked |
| `created_at` | timestamptz | YES | |
| `connection_method` | text | YES | How the connection was initiated. Values: `'manual'` (username entry), `'qr'` (QR code scan). NULL on rows predating Phase 3F. |

### RLS Policies (4 — per-command)

- **SELECT** `Users can see their own friendships` — USING `(auth.uid() = user_id) OR (auth.uid() = friend_id)` (public)
- **INSERT** `Users can create friendship requests` — WITH CHECK `auth.uid() = user_id` (public)
- **UPDATE** `Users can update their own friendships` — USING `(auth.uid() = user_id) OR (auth.uid() = friend_id)` (public)
- **DELETE** `Users can remove their own friendships` — USING `(auth.uid() = user_id) OR (auth.uid() = friend_id)` (public)

### Relationships

- **Two FKs to:** `profiles` (`user_id`, `friend_id`)

### ⚠️ Notes for Claude Code

- Either user can delete the friendship row (unfriend). The DELETE policy permits this for both parties.
- No unique constraint on `(user_id, friend_id)` — duplicate requests are possible. Validate at app layer or add a unique index.
- Either user can update the row (e.g. accept/block). Consider whether the app needs to restrict who can change status to what.

---

## Table: `community_actions`

**Purpose:** Social activity feed events between users (e.g. user A celebrated user B's milestone, user A nudged user B).

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `actor_id` | uuid | YES | **FK → profiles.id** (who performed the action) |
| `target_id` | uuid | YES | **FK → profiles.id** (who received it) |
| `action_type` | text | YES | E.g. "celebrate", "nudge", "endorse" |
| `period_week` | date | YES | The week this action relates to |
| `created_at` | timestamptz | YES | |

### RLS Policies (2 — per-command)

- **SELECT** `Users can see actions involving them` — USING `(auth.uid() = actor_id) OR (auth.uid() = target_id)` (public)
- **INSERT** `Users can create actions` — WITH CHECK `auth.uid() = actor_id` (public)

### Relationships

- **Two FKs to:** `profiles` (`actor_id`, `target_id`)

### ⚠️ Notes for Claude Code

- **No UPDATE or DELETE policies** — community actions are append-only from the user's perspective. They cannot be edited or removed without service-role access.
- `action_type` conventions: use `'hype'` for celebrations/encouragement and `'nudge'` for check-in reminders. Do not introduce new values without updating this list and the app-layer validation.
- `period_week` stores the Monday date of the week the action covers (ISO week start). To enforce a per-week cooldown — one action of each type per `(actor_id, target_id, action_type)` pair per week — query for an existing row with matching `actor_id`, `target_id`, `action_type`, and `period_week` before inserting.

---

## Cross-Table Patterns & Gotchas

These are patterns Claude Code should keep in mind when building features:

### 1. Project → Goal relationship is 1:many via `goals.project_id`
`goals.project_id` is a nullable uuid FK to `projects.id`. One project can group many goals; a goal belongs to at most one project. To list a project's goals: `.from('goals').select('*').eq('project_id', projectId)`. PostgREST relational selects from goals to project work: `.from('goals').select('*, projects(*)')`. The old `projects.linked_goal_id` column was dropped — do not reference it.

### 2. RLS silent failures
Every table requires `auth.uid() = user_id`. If a query returns `[]` unexpectedly:
- Confirm the user is authenticated (`auth.uid()` is not null)
- Confirm the row's `user_id` matches the current user
- Confirm RLS isn't filtering rows you'd expect to see

### 3. Missing DELETE policies
`profiles` and `community_actions` have no DELETE policy — standard delete queries on those tables will fail silently (zero rows affected). Use status fields or service-role keys. `friendships` now has a DELETE policy (either user can remove the row).

### 4. Nullable user_id columns
Many tables have `user_id` as nullable in schema but enforced via RLS. Always set `user_id` on insert — a null `user_id` row will be invisible to its supposed owner.

### 5. CHECK constraints on enum-like text columns
Most text columns (`status`, `category`, `type`, `role`, `action_type`, `day_of_week`, `source`) are free-form with no DB constraint — validate at the app layer. **Exception:** `tasks.priority` has a CHECK constraint (`tasks_priority_check`) enforcing values must be one of `'high'`, `'medium'`, `'low'`, or NULL. Inserts with other values will fail.

### 6. Convention: timestamps
Every table has `created_at` (timestamptz, defaults to `now()`). Most also have `updated_at`. There are no triggers updating `updated_at` automatically — your app must set it on update, OR add a trigger.

### 7. Auth integration
`profiles.id` is expected to match `auth.users.id`. New user signups need a corresponding profile row, typically via a `handle_new_user()` trigger on `auth.users`.

### 8. `tasks` is the sole source of scheduling truth
`tasks` (`date`, `scheduled_time`, `duration`) is the authoritative scheduling layer. `schedule_items` exists but is currently unused — it is reserved for Phase 3 calendar integration. Do not write scheduling code against `schedule_items`. `project_tasks` intentionally have **no scheduling** — they are unscheduled checklist items only.

**E2 addendum:** `tasks.date` is now nullable. Template rows (`is_recurrence_template = true`) have `date = null` and must be excluded from every display query with `.eq('is_recurrence_template', false)`. Failing to filter them will cause template rows to appear as undated tasks in task lists.

### 9. Mismatched units (future concern)
When `schedule_items` is eventually activated: `tasks.duration` is in **hours** (numeric/decimal); `schedule_items.duration_minutes` is in **minutes** (int). Always convert at the boundary. `project_tasks` has no duration column.

### 10. Mismatched priority types
`goals.priority` is `int4`. `tasks.priority` is `text`. They are not the same type and cannot be compared directly.

---

## Table: `notifications`

**Purpose:** In-app notification inbox. One row per notification per user. Used by the bell icon and notifications panel to surface activity, reminders, and system events.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | **FK → profiles.id** (ON DELETE CASCADE) |
| `type` | text | NO | One of: `morning_touchpoint`, `weekly_review`, `streak_milestone`, `ai_insight`, `goal_progress`, `monthly_snapshot` |
| `title` | text | NO | Short display title |
| `message` | text | NO | Body text (1–2 lines) |
| `action_url` | text | YES | Route to navigate to when tapped (e.g. `/dashboard/snapshots/:id`) |
| `icon_key` | text | YES | UI icon identifier: `sunrise`, `calendar`, `flame`, `lightbulb`, `target`, `chart` |
| `read` | boolean | NO | Defaults `false`. Set to `true` on open or explicit mark-read. |
| `created_at` | timestamptz | NO | Defaults `now()` |

### Indexes

- `idx_notifications_user_unread` on `(user_id, created_at DESC) WHERE read = false` — fast unread count + recent unread fetch.

### RLS Policies (1)

- **ALL** `Users own their notifications` — USING `auth.uid() = user_id` (public)

### ⚠️ Notes for Claude Code

- Always set `user_id` on insert. `auth.uid()` is not set automatically here since notifications can be created server-side.
- To get unread count efficiently: use `.select('*', { count: 'exact', head: true }).eq('read', false)` — hits the partial index.
- Helper functions in `lib/db.ts`: `createNotification`, `getNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`.

---

## Table: `monthly_snapshots`

**Purpose:** Auto-generated end-of-month summaries. One row per user per calendar month. Generated lazily when the user opens the snapshots page on or after the 1st of the following month.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | **FK → profiles.id** (ON DELETE CASCADE) |
| `month_label` | text | NO | Human-readable label, e.g. `"April 2026"`. Part of the unique constraint. |
| `month_start_date` | date | NO | e.g. `2026-04-01` |
| `month_end_date` | date | NO | e.g. `2026-04-30` |
| `goals_worked` | int4 | NO | Count of distinct goals with any task activity that month. Defaults 0. |
| `goals_completed` | int4 | NO | Count of goals at `progress = 100` that were worked on. Defaults 0. |
| `completion_rate` | int4 | NO | `completed_tasks / total_tasks * 100`. 0–100. Defaults 0. |
| `hours_logged` | numeric | NO | Sum of `duration` on completed tasks in the month. Defaults 0. |
| `top_wins` | jsonb | NO | Array of up to 3 win objects. Shape: `[{ "title": text, "description": text, "category": text, "icon": "trophy"\|"ribbon"\|"sparkle" }]`. Defaults `[]`. |
| `category_breakdown` | jsonb | NO | Hours per category. Shape: `{ "Career": 28.5, "Health": 12.0 }`. Defaults `{}`. |
| `momentum_weekly` | jsonb | NO | Up to 4 weekly momentum scores as integers. Shape: `[70, 78, 80, 74]`. Defaults `[]`. |
| `user_reflection` | text | YES | Free-text reflection written by the user from the snapshot detail page. |
| `created_at` | timestamptz | NO | Defaults `now()` |

### Constraints

- **Unique:** `(user_id, month_label)` — use `.upsert({...}, { onConflict: 'user_id,month_label' })` to safely regenerate without duplicates.

### RLS Policies (1)

- **ALL** `Users own their snapshots` — USING `auth.uid() = user_id` (public)

### ⚠️ Notes for Claude Code

- **Generation is lazy / on-demand.** `ensureMonthlySnapshot(userId)` in `lib/db.ts` checks whether the previous month's snapshot exists; if not, generates it. Call this when the snapshots list page mounts.
- `month_label` is the conflict key — use `.upsert({...}, { onConflict: 'user_id,month_label' })` when writing.
- `momentum_weekly` contains up to 4 entries — one per ISO week that falls within the month. Weeks 5+ are sliced off.
- When a snapshot is generated, a `monthly_snapshot` notification is automatically created via `createNotification()`.
- Helper functions in `lib/db.ts`: `generateMonthlySnapshot`, `ensureMonthlySnapshot`, `getMonthlySnapshots`, `getMonthlySnapshot`, `updateSnapshotReflection`.

---

## Table: `daily_reflections`

**Purpose:** One row per user per calendar day. Written by the Evening Touchpoint (reflection fields) and Morning Touchpoint (marks `morning_completed`). Used to compute morning streaks and surface reflection history.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | **FK → profiles.id** (ON DELETE CASCADE) |
| `date` | date | NO | The calendar day this row covers (`YYYY-MM-DD`). Part of the unique constraint. |
| `morning_completed` | bool | NO | `true` once the user taps "Start my day" on the Morning Touchpoint. Defaults `false`. |
| `evening_completed` | bool | NO | `true` once the user submits the Evening Touchpoint reflection. Defaults `false`. |
| `one_thing_learned` | text | YES | Free-text reflection from the Evening Touchpoint. |
| `tomorrow_intention` | text | YES | Intention for the next day, set on Evening Touchpoint. |
| `tasks_completed` | int4 | NO | Snapshot count of tasks completed on this day. Written at evening submit. Defaults `0`. |
| `hours_logged` | numeric | NO | Snapshot sum of completed task durations for the day. Written at evening submit. Defaults `0`. |
| `mood_score` | int4 | YES | Optional 1–5 mood rating. |
| `created_at` | timestamptz | NO | Defaults `now()` |
| `updated_at` | timestamptz | NO | Defaults `now()`. Must be set manually on update (no trigger). |

### Indexes

- Primary key on `id`.
- **Unique:** `(user_id, date)` — use `.upsert({...}, { onConflict: 'user_id,date' })` to safely write without duplicates.
- Performance index on `(user_id, date DESC)` — fast "last N days" streak queries.

### RLS Policies (1)

- **ALL** `Users own their daily reflections` — USING `auth.uid() = user_id` (public)

### ⚠️ Notes for Claude Code

- Always use upsert with `onConflict: 'user_id,date'` — never plain insert, since the user may revisit a touchpoint.
- `morning_completed` and `evening_completed` are written by separate touchpoints. Morning marks `morning_completed = true`; Evening marks `evening_completed = true` and writes the reflection text + snapshot stats.
- `tasks_completed` and `hours_logged` are point-in-time snapshots written at evening submit, not live counts. For live totals, query the `tasks` table directly.
- Helper functions in `lib/db.ts`: `upsertDailyReflection`, `getDailyReflectionForDate`, `getMorningStreak`.

---

## Table: `reward_events`

**Purpose:** Persistent, idempotent record of every reward earned. The `UNIQUE(user_id, dedupe_key)` constraint is the sole mechanism for preventing duplicate rewards — a single insert with `ON CONFLICT DO NOTHING` is both the earn check and the idempotency guard. One row per earned reward occurrence; `seen = false` until the UI has displayed it.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key, `gen_random_uuid()` |
| `user_id` | uuid | NO | **FK → profiles.id** (ON DELETE CASCADE) |
| `reward_type` | text | NO | One of: `first_move`, `full_day`, `perfect_week`, `quiet_win`, `streak_milestone`, `first_reflection`, `goal_complete`, `back_in_rhythm` |
| `dedupe_key` | text | NO | Idempotency key. Examples: `first_move`, `first_reflection`, `full_day:2026-06-11`, `perfect_week:2026-06-08`, `goal_complete:<goalId>`, `streak_milestone:7`, `back_in_rhythm:2026-06-11`, `quiet_win:<taskId>`. **Part of the UNIQUE constraint with user_id.** |
| `context` | jsonb | NO | Extra data for display. E.g. `{ "goalTitle": "Run a marathon", "goalId": "..." }` for goal_complete; `{ "tier": 7 }` for streak_milestone; `{ "date": "2026-06-11" }` for full_day. Defaults `{}`. |
| `earned_at` | timestamptz | NO | When the reward was earned. Defaults `now()`. |
| `seen` | bool | NO | `false` until the reward UI has displayed it. Defaults `false`. Set to `true` via UPDATE after display. |
| `created_at` | timestamptz | YES | Defaults `now()`. |

### Constraints

- **PRIMARY KEY** on `id`
- **UNIQUE** `reward_events_user_dedupe` on `(user_id, dedupe_key)` — the idempotency guard
- **FK** `reward_events_user_id_fkey` → `profiles(id)` ON DELETE CASCADE
- **NOT NULL** on `user_id`, `reward_type`, `dedupe_key`, `context`, `earned_at`, `seen`

### Indexes

- `idx_reward_events_user_unseen` on `(user_id, earned_at DESC) WHERE seen = false` — fast unseen-queue fetch on app open and task toggle
- `idx_reward_events_user_earned` on `(user_id, earned_at DESC)` — chronological history for Phase 2 Moments list

### RLS Policies (3 — per-command)

- **SELECT** `reward_events_select` — USING `auth.uid() = user_id`
- **INSERT** `reward_events_insert` — WITH CHECK `auth.uid() = user_id`
- **UPDATE** `reward_events_update` — USING `auth.uid() = user_id`

(No DELETE policy — reward records are immutable from the user's perspective.)

### ⚠️ Notes for Claude Code

- **Idempotency pattern:** `INSERT INTO reward_events (...) VALUES (...) ON CONFLICT (user_id, dedupe_key) DO NOTHING RETURNING *`. If the `RETURNING` clause returns a row, it is newly earned. If it returns nothing, the reward was already recorded — do not display it.
- **Never pre-check existence before inserting.** The unique constraint makes the insert itself the check. A separate SELECT-then-insert creates a race condition.
- **`seen` lifecycle:** Insert with `seen = false`. After the UI renders the reward, UPDATE to `seen = true`. On app open, fetch all `WHERE seen = false` and queue them.
- **`reward_type` values** are app-enforced conventions, not a DB CHECK constraint. Validate at the app layer in `lib/rewards.ts`.
- **`dedupe_key` format** must be consistent across all call sites. The canonical formats are defined in `lib/rewards.ts` — never construct dedupe keys inline in page code.
- Helper functions in `lib/rewards.ts`: `evaluateRewards`, `markRewardSeen`, `getUnseenRewards`.

---

## When This Document Drifts

This file reflects the schema as of the last dump. To regenerate:

```sql
-- Run each query separately in Supabase SQL Editor

-- Tables & columns
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- RLS policies
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Foreign keys
SELECT tc.table_name, kcu.column_name,
       ccu.table_name AS references_table,
       ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';

-- RLS status check
SELECT tablename, rowsecurity AS rls_enabled,
       (SELECT COUNT(*) FROM pg_policies p
        WHERE p.tablename = t.tablename AND p.schemaname = 'public') AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;
```

For the most reliable regeneration, use the Supabase CLI:

```bash
supabase db dump --schema public --schema-only > schema.sql
```
