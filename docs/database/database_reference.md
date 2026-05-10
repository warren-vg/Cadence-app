# Cadence.io — Database Reference

**Source of truth for all database structure.** Always consult this document before generating any query, Supabase client call, or feature that touches data. Never assume a column or table exists. Never assume a query will return rows without verifying the RLS policy permits it for the current auth context.

- **Database:** Supabase (Postgres)
- **Schema:** `public`
- **Tables:** 16
- **RLS:** Enabled on all tables
- **Last updated:** May 10, 2026 — code-alignment migration applied

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
| `profiles` | User identity & app-level user data | 12 | 3 |
| `goals` | Top-level user intentions | 17 | 4 |
| `projects` | Bundles of work toward goals | 11 | 1 |
| `milestones` | Progress markers within goals/projects | 9 | 1 |
| `tasks` | Executable units of work | 15 | 1 |
| `project_tasks` | Ordered subtask checklist within a project | 7 | 1 |
| `schedule_items` | Calendar/time-block entries | 12 | 1 |
| `energy_blocks` | Recurring energy patterns by day/time | 8 | 1 |
| `priority_stack` | Reserved: future richer priority metadata | 6 | 1 |
| `weekly_reflections` | Weekly journaling/reflection entries | 10 | 1 |
| `quarterly_reviews` | Quarterly retrospective entries | 8 | 1 |
| `momentum_scores` | Weekly momentum + streak tracking | 6 | 1 |
| `opportunity_evaluations` | Decision framework scoring | 12 | 1 |
| `mentor_messages` | AI coach conversation history | 6 | 1 |
| `friendships` | Friend request/connection state | 5 | 4 |
| `community_actions` | Social activity feed events | 6 | 2 |

---

## Table: `profiles`

**Purpose:** Central user entity. Mirrors `auth.users` (id matches `auth.uid()`) and stores app-level user data including onboarding state, daily notes, energy preferences, schedule configuration, and a fast-access priority snapshot.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | **Primary key.** Matches `auth.users.id` |
| `username` | text | NO | Display name. Should be supplied explicitly on signup |
| `avatar_url` | text | YES | Optional profile image URL |
| `onboarding_complete` | bool | YES | Gate for onboarding flow |
| `daily_notes` | jsonb | YES | Free-form daily notes keyed by date |
| `low_energy_dates` | text[] | YES | Array of dates flagged as low energy |
| `weekly_capacity` | int4 | YES | Max hours per week the user plans to work |
| `energy_blocks` | jsonb | YES | User-configured energy patterns (snapshot; mirrors `energy_blocks` table) |
| `work_schedule` | jsonb | YES | Days/hours the user works, set during onboarding |
| `priority_stack` | jsonb | YES | Current priority stack snapshot for fast access |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (3)

- **SELECT** `Users can view their own profile` — USING `auth.uid() = id` (authenticated)
- **INSERT** `Users can insert their own profile` — WITH CHECK `auth.uid() = id` (authenticated)
- **UPDATE** `Users can update their own profile` — USING & WITH CHECK `auth.uid() = id` (authenticated)

### Relationships

- **Has many:** Every other user-owned table references `profiles.id` via `user_id`

### ⚠️ Notes for Claude Code

- A user has no `profiles` row until one is explicitly inserted. If you see "user logged in but data missing," check whether the profile row was created post-signup (typically via a `handle_new_user()` trigger on `auth.users`).
- `username` is `NOT NULL` — always supply it on insert.
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
| `milestones` | jsonb | YES | Array of milestone objects `{id, text, completed}` — structured checkpoints with completion state |
| `steps` | text[] | YES | Lightweight text checklist items (plain strings, no completion state) |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (4 — per-command)

- **SELECT** `Users can read own goals` — USING `auth.uid() = user_id` (authenticated)
- **INSERT** `Users can insert own goals` — WITH CHECK `auth.uid() = user_id` (authenticated)
- **UPDATE** `Users can update own goals` — USING & WITH CHECK `auth.uid() = user_id` (authenticated)
- **DELETE** `Users can delete own goals` — USING `auth.uid() = user_id` (authenticated)

### Relationships

- **Belongs to:** `profiles` (via `user_id`)
- **Has many:** `tasks` (via `tasks.goal_id`), `milestones` (via `milestones.goal_id`), `schedule_items` (via `schedule_items.linked_goal_id`)
- **Linked from:** `projects.linked_goal_id` (uuid FK — one project can link to one goal)

### ⚠️ Notes for Claude Code

- `user_id` defaults to `auth.uid()` so you don't need to supply it on insert if calling as the authenticated user.
- `milestones` and `steps` are intentionally different. `milestones` are structured objects with completion state; `steps` are a plain text checklist. Do not conflate them.
- Status values are convention-based, not enforced by a CHECK constraint. Validate at the app layer.

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
| `linked_goal_id` | uuid | YES | **FK → goals.id** (optional — links project to one goal) |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their projects` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles` (via `user_id`), `goals` (via `linked_goal_id`, optional)
- **Has many:** `milestones` (via `milestones.project_id`), `tasks` (via `tasks.project_id`), `project_tasks` (via `project_tasks.project_id`)

### ⚠️ Notes for Claude Code

- `linked_goal_id` is a true uuid FK to `goals.id`. PostgREST relational selects (`.select('*, goals(*)')`) will work for this relationship.
- `user_id` is nullable in the schema but the RLS policy requires `auth.uid() = user_id`, so a null `user_id` row is functionally inaccessible. Always set it on insert.

---

## Table: `milestones`

**Purpose:** Progress markers within a goal or project. Used to break larger work into checkpoint moments.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `goal_id` | uuid | YES | **FK → goals.id** |
| `project_id` | uuid | YES | **FK → projects.id** |
| `text` | text | YES | Milestone description |
| `completed` | bool | YES | |
| `target_date` | date | YES | When this should be hit |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their milestones` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles`, `goals` (optional), `projects` (optional)

### ⚠️ Notes for Claude Code

- A milestone can belong to a goal, a project, both, or neither — all three FKs are nullable. Decide based on UX whether you require at least one parent.

---

## Table: `tasks`

**Purpose:** Executable units of work. Can be tied to a goal and/or project, scheduled to specific dates/times, and tagged with effort estimates.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `goal_id` | uuid | YES | **FK → goals.id** |
| `project_id` | uuid | YES | **FK → projects.id** |
| `text` | text | YES | Task description |
| `priority` | text | YES | Free-form priority label (NOT integer like goals.priority) |
| `completed` | bool | YES | Completion state |
| `scheduled_time` | time | YES | Time of day (no date component) |
| `scheduled_date` | date | YES | Date the task is scheduled for |
| `duration_hours` | numeric | YES | Estimated effort in hours (decimals allowed) |
| `source` | text | YES | Where the task originated (e.g. manual, AI, import) |
| `category` | text | YES | Task category label (e.g. work, personal, health) |
| `completed_at` | timestamptz | YES | Timestamp when the task was marked complete |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their tasks` — USING `auth.uid() = user_id` (public)

### Relationships

- **Belongs to:** `profiles`, `goals` (optional), `projects` (optional)
- **Linked from:** `schedule_items.linked_task_id`

### ⚠️ Notes for Claude Code

- `priority` on tasks is `text`, not `int4` — this differs from `goals.priority` which is `int4`. Don't mix them up.
- `scheduled_time` is `time` (no date), `scheduled_date` is `date` (no time). To get a full datetime, combine them in app code.
- `duration_hours` is `numeric` — supports decimals (0.5, 1.25, etc.).
- `completed_at` is set by the app when `completed` flips to `true`. It is not auto-populated by a trigger — set it explicitly on update.
- Both `schedule_items` AND `tasks` carry scheduling info (`scheduled_time`/`scheduled_date`). Decide which is the source of truth in your app — duplicate scheduling state is a frequent bug source.

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

- `duration_minutes` is in **minutes** here, but `tasks.duration_hours` is in **hours**. Always convert when comparing across tables.
- `start_time` is `time` (no date). The full scheduled moment is `scheduled_date` + `start_time` combined in app code.
- Schedule items can stand alone (no linked task or goal), or link to either or both. Don't assume a task or goal will always be present.

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
| `order` | int4 | YES | Display order within the project |
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

**Purpose:** Quarterly retrospective entries.

### Schema

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | YES | **FK → profiles.id** |
| `quarter_label` | text | YES | E.g. "Q1 2026" |
| `quarter_summary` | text | YES | Narrative summary |
| `progress_assessment` | text | YES | Self-assessment of progress |
| `next_quarter_goals` | text | YES | Forward-looking goals |
| `created_at` | timestamptz | YES | |
| `updated_at` | timestamptz | YES | |

### RLS Policies (1)

- **ALL** `Users own their quarterly reviews` — USING `auth.uid() = user_id` (public)

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

### 1. `projects.linked_goal_id` is a true FK
`projects.linked_goal_id` is a uuid column with a foreign key constraint to `goals.id`. PostgREST relational selects (`.select('*, goals(*)')`) work for this relationship. One project links to at most one goal.

### 2. RLS silent failures
Every table requires `auth.uid() = user_id`. If a query returns `[]` unexpectedly:
- Confirm the user is authenticated (`auth.uid()` is not null)
- Confirm the row's `user_id` matches the current user
- Confirm RLS isn't filtering rows you'd expect to see

### 3. Missing DELETE policies
`profiles` and `community_actions` have no DELETE policy — standard delete queries on those tables will fail silently (zero rows affected). Use status fields or service-role keys. `friendships` now has a DELETE policy (either user can remove the row).

### 4. Nullable user_id columns
Many tables have `user_id` as nullable in schema but enforced via RLS. Always set `user_id` on insert — a null `user_id` row will be invisible to its supposed owner.

### 5. No CHECK constraints on enum-like text columns
`status`, `category`, `type`, `role`, `action_type`, `day_of_week`, `priority` (on tasks), `source` are all free-form text. Validate allowed values at the app layer or add CHECK constraints.

### 6. Convention: timestamps
Every table has `created_at` (timestamptz, defaults to `now()`). Most also have `updated_at`. There are no triggers updating `updated_at` automatically — your app must set it on update, OR add a trigger.

### 7. Auth integration
`profiles.id` is expected to match `auth.users.id`. New user signups need a corresponding profile row, typically via a `handle_new_user()` trigger on `auth.users`.

### 8. Duplicate scheduling state
Both `tasks` (`scheduled_time`, `scheduled_date`, `duration_hours`) and `schedule_items` (`start_time`, `scheduled_date`, `duration_minutes`) carry scheduling info. Pick one as the source of truth or you'll get out-of-sync bugs. `project_tasks` intentionally have **no scheduling** — they are unscheduled checklist items only.

### 9. Mismatched units
`tasks.duration_hours` is in **hours** (numeric/decimal). `schedule_items.duration_minutes` is in **minutes** (int). Always convert when comparing. `project_tasks` has no duration column.

### 10. Mismatched priority types
`goals.priority` is `int4`. `tasks.priority` is `text`. They are not the same type and cannot be compared directly.

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
