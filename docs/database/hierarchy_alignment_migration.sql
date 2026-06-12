-- ============================================================================
-- Cadence.io — Hierarchy Alignment Migration
-- ============================================================================
-- Run this in the Supabase SQL Editor. Wrapped in a transaction — nothing
-- applies unless every statement succeeds. Verify the queries at the bottom
-- BEFORE running COMMIT.
--
-- CHANGES:
--   1. Create relational milestones table (if not already present)
--   2. Enforce milestones.goal_id NOT NULL
--   3. Migrate goals.milestones jsonb array → relational milestones rows
--   4. Drop goals.milestones jsonb column
--   5. Add tasks.milestone_id uuid FK → milestones.id (nullable)
--   6. Enforce tasks.goal_id NOT NULL
--   7. Add goals.project_id uuid FK → projects.id (nullable) — 1:many model
--   8. Migrate projects.linked_goal_id data → goals.project_id
--   9. Drop projects.linked_goal_id column
--
-- PRE-FLIGHT — run this query FIRST, before the transaction:
--   SELECT id, text, date FROM tasks WHERE goal_id IS NULL;
--   -- Must return 0 rows. If any orphaned tasks exist, assign them a goal
--   -- before running this migration. Step 6 will raise an exception otherwise.
--
-- BEFORE YOU RUN:
--   - Take a database backup (Supabase Dashboard → Database → Backups)
-- ============================================================================

BEGIN;

-- ─── 1. Relational milestones table ──────────────────────────────────────────
-- IF NOT EXISTS makes this safe to run even if the table was already created
-- directly in Supabase (outside of migrations.sql).

CREATE TABLE IF NOT EXISTS milestones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goal_id     uuid        NOT NULL REFERENCES goals(id)    ON DELETE CASCADE,
  project_id  uuid                 REFERENCES projects(id) ON DELETE SET NULL,
  text        text        NOT NULL,
  completed   bool        NOT NULL DEFAULT false,
  target_date date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Create RLS policy only if it doesn't already exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'milestones'
      AND policyname  = 'milestones_own'
  ) THEN
    EXECUTE 'CREATE POLICY "milestones_own" ON milestones FOR ALL USING (auth.uid() = user_id)';
  END IF;
END $$;


-- ─── 2. Enforce milestones.goal_id NOT NULL ───────────────────────────────────
-- If the milestones table already existed with nullable goal_id, any rows
-- that have no goal parent are unrecoverable — delete them first, then
-- tighten the constraint.

DELETE FROM milestones WHERE goal_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'milestones'
      AND column_name  = 'goal_id'
      AND is_nullable  = 'YES'
  ) THEN
    ALTER TABLE milestones ALTER COLUMN goal_id SET NOT NULL;
  END IF;
END $$;


-- ─── 3. Migrate goals.milestones jsonb → relational milestones rows ───────────
-- Only runs if the goals.milestones jsonb column still exists.
-- - Skips items with empty/null text (garbage data).
-- - Preserves the jsonb item's id if it looks like a valid UUID; generates a
--   new one otherwise.
-- - ON CONFLICT (id) DO NOTHING makes this idempotent: safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'goals'
      AND column_name  = 'milestones'
  ) THEN
    INSERT INTO milestones (id, user_id, goal_id, text, completed, created_at)
    SELECT
      CASE
        WHEN (m->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (m->>'id')::uuid
        ELSE gen_random_uuid()
      END,
      g.user_id,
      g.id,
      m->>'text',
      COALESCE((m->>'completed')::bool, false),
      now()
    FROM  goals g,
          jsonb_array_elements(g.milestones) AS m
    WHERE g.milestones IS NOT NULL
      AND jsonb_array_length(g.milestones) > 0
      AND COALESCE(trim(m->>'text'), '') <> ''
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;


-- ─── 4. Drop goals.milestones jsonb column ────────────────────────────────────
-- Data has been migrated to the relational milestones table above.

ALTER TABLE goals DROP COLUMN IF EXISTS milestones;


-- ─── 5. Add tasks.milestone_id FK (nullable) ─────────────────────────────────
-- A task may optionally belong to a milestone. When a milestone is deleted,
-- the task remains but loses its milestone link (SET NULL).

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL;


-- ─── 6. Enforce tasks.goal_id NOT NULL ───────────────────────────────────────
-- Every task must belong to a goal — this is the foundation of goal progress
-- calculation. If orphaned tasks exist, this block raises an exception and
-- the entire transaction rolls back. Run the pre-flight query above first.

DO $$
DECLARE
  null_count int;
BEGIN
  SELECT COUNT(*) INTO null_count FROM tasks WHERE goal_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION
      'BLOCKED: % task(s) have null goal_id. '
      'Run: SELECT id, text, date FROM tasks WHERE goal_id IS NULL; '
      'Assign each task a goal_id, then re-run this migration.',
      null_count;
  END IF;
END $$;

ALTER TABLE tasks ALTER COLUMN goal_id SET NOT NULL;


-- ─── 7. Add goals.project_id FK (nullable) ───────────────────────────────────
-- Replaces the old projects.linked_goal_id pattern (1 project → 1 goal) with
-- a 1:many model: one project can group many goals. A goal may belong to at
-- most one project (nullable).

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;


-- ─── 8. Migrate projects.linked_goal_id → goals.project_id ───────────────────
-- For every project that had a linked_goal_id, set the corresponding goal's
-- project_id to that project's id. Because the old model was 1:1, there is
-- no ambiguity: each goal can only have been linked by at most one project.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'projects'
      AND column_name  = 'linked_goal_id'
  ) THEN
    UPDATE goals g
    SET    project_id = p.id
    FROM   projects p
    WHERE  p.linked_goal_id = g.id
      AND  p.linked_goal_id IS NOT NULL;
  END IF;
END $$;


-- ─── 9. Drop projects.linked_goal_id ─────────────────────────────────────────

ALTER TABLE projects DROP COLUMN IF EXISTS linked_goal_id;


-- ============================================================================
-- VERIFICATION QUERIES
-- Review each result before running COMMIT. Expected outcomes are noted.
-- ============================================================================

-- 1. milestones table columns — goal_id must show is_nullable = 'NO'
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'milestones'
ORDER  BY ordinal_position;

-- 2. RLS enabled on milestones — rowsecurity must be true
SELECT tablename, rowsecurity
FROM   pg_tables
WHERE  schemaname = 'public' AND tablename = 'milestones';

-- 3. Count migrated milestone rows (cross-check against how many you expected)
SELECT COUNT(*) AS migrated_milestone_rows FROM milestones;

-- 4. tasks.milestone_id exists and is nullable
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'tasks' AND column_name = 'milestone_id';
-- Expected: 1 row, is_nullable = 'YES'

-- 5. tasks.goal_id is now NOT NULL
SELECT column_name, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'tasks' AND column_name = 'goal_id';
-- Expected: is_nullable = 'NO'

-- 6. goals.project_id exists and is nullable
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'goals' AND column_name = 'project_id';
-- Expected: 1 row, is_nullable = 'YES'

-- 7. projects.linked_goal_id is gone — must return 0 rows
SELECT column_name
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'projects' AND column_name = 'linked_goal_id';

-- 8. goals.milestones jsonb column is gone — must return 0 rows
SELECT column_name
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'goals' AND column_name = 'milestones';

-- 9. Data migration spot-check: goals that now have linked milestones
SELECT g.id, g.text, COUNT(m.id) AS milestone_count
FROM   goals g
LEFT   JOIN milestones m ON m.goal_id = g.id
GROUP  BY g.id, g.text
ORDER  BY milestone_count DESC
LIMIT  10;

-- ============================================================================
-- If ALL verification queries look correct:   COMMIT;
-- If anything looks wrong:                    ROLLBACK;
-- ============================================================================

-- COMMIT;
-- ROLLBACK;
