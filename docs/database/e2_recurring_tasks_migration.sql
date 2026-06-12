-- ============================================================
-- E2 Phase 2: Recurring Tasks Schema Migration
-- Apply in Supabase SQL Editor
-- ============================================================

-- 1. Allow tasks.date to be null.
--    Template rows are master records with no scheduled date of their own.
--    Instance rows keep a concrete date as before.
ALTER TABLE tasks ALTER COLUMN date DROP NOT NULL;

-- 2. Add three recurrence columns.
--
--    is_recurrence_template  — true on the master template row (the source of truth
--                              for the recurrence rule). Template rows are filtered out
--                              of all display queries so they never appear in a task list.
--
--    recurrence_template_id  — on instance rows, FK to the template task.
--                              SET NULL on template delete so past instances survive
--                              as standalone tasks (history is preserved).
--
--    recurrence_rule         — jsonb on template rows only.
--                              Shape: {
--                                "frequency":    "daily" | "weekly",
--                                "days_of_week": [0,1,2,3,4,5,6],  -- weekly only; 0=Sun
--                                "ends_on":      "YYYY-MM-DD" | null  -- null = no end
--                              }
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_recurrence_template  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_template_id  uuid REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurrence_rule         jsonb;

-- 3. Index for "find all instances of a template" lookups (used by stopRecurrence
--    and editFutureRecurringInstances in Phase 3).
CREATE INDEX IF NOT EXISTS tasks_recurrence_template_id_idx
  ON tasks(recurrence_template_id)
  WHERE recurrence_template_id IS NOT NULL;
