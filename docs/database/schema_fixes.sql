-- ============================================================================
-- Cadence.io — Schema Bug Fixes
-- ============================================================================
-- Run this in the Supabase SQL Editor. It's wrapped in a transaction so
-- nothing applies unless every statement succeeds. Review the verification
-- queries at the bottom before you COMMIT.
--
-- WHAT THIS DOES:
--   1. Fixes goals.text — removes literal 'NOT NULL' default, enforces NOT NULL
--   2. Fixes goals.status — removes malformed quoted/spaced default
--   3. Fixes goals.category — removes malformed double-quoted default
--   4. Fixes profiles.username — removes literal 'NULL' default
--   5. Adds missing FK constraints on mentor_messages and opportunity_evaluations
--
-- BEFORE YOU RUN:
--   - Take a database backup (Supabase Dashboard → Database → Backups)
--   - Read the "DATA CLEANUP" section — you likely have polluted rows already
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- DATA CLEANUP (run FIRST, before changing column defaults)
-- ----------------------------------------------------------------------------
-- These statements clean up rows that were saved with the broken default
-- values. If you skip this, the NOT NULL constraint on goals.text will fail.

-- Clean up goals.text rows that contain the literal string 'NOT NULL'
UPDATE goals
SET text = NULL
WHERE text = 'NOT NULL';

-- Clean up goals.status rows with malformed values
UPDATE goals
SET status = 'inbox'
WHERE status IN (' ''inbox''', '''inbox''', ' inbox', 'inbox ');

-- Clean up goals.category rows with malformed values
UPDATE goals
SET category = 'Personal Growth'
WHERE category IN ('''Personal Growth''', '"Personal Growth"');

-- Clean up profiles.username rows containing the literal string 'NULL'
UPDATE profiles
SET username = NULL
WHERE username = 'NULL';

-- ----------------------------------------------------------------------------
-- BUG FIX #1 — goals.text
-- ----------------------------------------------------------------------------
-- Was: DEFAULT 'NOT NULL'::text  (literal string "NOT NULL")
-- Should be: no default, with a NOT NULL constraint on the column
ALTER TABLE goals
  ALTER COLUMN text DROP DEFAULT;

-- NOTE: Only enforce NOT NULL if you've cleaned up existing nulls above.
-- If any goal rows have a legitimately empty text field that you want to
-- keep, COMMENT OUT the next line.
ALTER TABLE goals
  ALTER COLUMN text SET NOT NULL;

-- ----------------------------------------------------------------------------
-- BUG FIX #2 — goals.status
-- ----------------------------------------------------------------------------
-- Was: DEFAULT ' ''inbox'''::text  (literal string " 'inbox'" with space + quotes)
-- Should be: DEFAULT 'inbox'
ALTER TABLE goals
  ALTER COLUMN status SET DEFAULT 'inbox';

-- ----------------------------------------------------------------------------
-- BUG FIX #3 — goals.category
-- ----------------------------------------------------------------------------
-- Was: DEFAULT '''Personal Growth'''::text  (literal string with embedded quotes)
-- Should be: DEFAULT 'Personal Growth'
ALTER TABLE goals
  ALTER COLUMN category SET DEFAULT 'Personal Growth';

-- ----------------------------------------------------------------------------
-- BUG FIX #4 — profiles.username
-- ----------------------------------------------------------------------------
-- Was: DEFAULT 'NULL'::text  (literal string "NULL")
-- Should be: no default. Username should be supplied explicitly on signup.
ALTER TABLE profiles
  ALTER COLUMN username DROP DEFAULT;

-- Same for profiles.avatar_url (also has the same broken pattern)
ALTER TABLE profiles
  ALTER COLUMN avatar_url DROP DEFAULT;

-- ----------------------------------------------------------------------------
-- BUG FIX #5 — Missing foreign key constraints
-- ----------------------------------------------------------------------------
-- These tables have user_id columns that point to profiles.id but lack
-- the FK constraint, so orphaned rows are possible.

-- mentor_messages.user_id → profiles.id
ALTER TABLE mentor_messages
  ADD CONSTRAINT mentor_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- opportunity_evaluations.user_id → profiles.id
ALTER TABLE opportunity_evaluations
  ADD CONSTRAINT opportunity_evaluations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- BONUS: While we're here, mentor_messages also references a session_id
-- that has no FK. If you have a sessions table, uncomment and adjust:
-- ALTER TABLE mentor_messages
--   ADD CONSTRAINT mentor_messages_session_id_fkey
--   FOREIGN KEY (session_id) REFERENCES mentor_sessions(id) ON DELETE CASCADE;

-- ============================================================================
-- VERIFICATION — Review these BEFORE running COMMIT
-- ============================================================================
-- Check goals defaults are now correct
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'goals'
  AND column_name IN ('text', 'status', 'category');

-- Check profiles defaults are cleaned up
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('username', 'avatar_url');

-- Confirm FKs were added
SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('mentor_messages', 'opportunity_evaluations');

-- Confirm no polluted data remains
SELECT 'goals.text = NOT NULL string' AS check_name, COUNT(*) AS bad_rows
FROM goals WHERE text = 'NOT NULL'
UNION ALL
SELECT 'profiles.username = NULL string', COUNT(*)
FROM profiles WHERE username = 'NULL';

-- ============================================================================
-- If everything above looks correct, run:
--   COMMIT;
-- If something looks wrong, run:
--   ROLLBACK;
-- ============================================================================

-- COMMIT;   -- Uncomment after verifying
