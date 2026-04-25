-- Cadence Phase 2 Migrations
-- Run this in Supabase SQL Editor before deploying Phase 2 code.

-- ─── New Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  date          DATE NOT NULL,
  scheduled_time TIME NOT NULL DEFAULT '09:00',
  duration      DECIMAL(4,2) NOT NULL DEFAULT 1,
  category      TEXT NOT NULL DEFAULT 'Career',
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  goal_id       UUID,
  project_id    UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_items (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  date         DATE NOT NULL,
  start_time   TIME NOT NULL,
  duration     INTEGER NOT NULL DEFAULT 60,
  category     TEXT NOT NULL DEFAULT 'work',
  is_flexible  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'campaign',
  status         TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('active','planning','paused','completed','archived')),
  progress       INTEGER NOT NULL DEFAULT 0,
  timeline       TEXT,
  notes          TEXT,
  linked_goal_id UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friendships (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS friend_actions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('hype','nudge')),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, target_id, action_type, date)
);

CREATE TABLE IF NOT EXISTS opportunity_evaluations (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  score          INTEGER NOT NULL,
  recommendation TEXT,
  details        JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quarterly_reviews (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quarter             TEXT NOT NULL,
  year                INTEGER NOT NULL,
  worked_well         TEXT,
  needs_change        TEXT,
  performance_score   INTEGER,
  goals_completed     INTEGER,
  goals_total         INTEGER,
  avg_progress        INTEGER,
  ai_pivots           JSONB,
  next_quarter_theme  JSONB,
  submitted_at        TIMESTAMPTZ,
  UNIQUE(user_id, quarter, year)
);

-- ─── Profile Column Additions ──────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS priority_stack JSONB DEFAULT '[]'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS energy_blocks JSONB DEFAULT '{}'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS work_schedule JSONB DEFAULT '{
    "employmentType": "full-time",
    "workDays": ["Mon","Tue","Wed","Thu","Fri"],
    "workStartTime": "09:00",
    "workEndTime": "17:00",
    "timezone": "America/New_York"
  }'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS weekly_capacity INTEGER DEFAULT 40;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT '{
    "weeklyReview": true,
    "dailyReminder": true,
    "goalProgress": false,
    "friendActivity": true
  }'::jsonb;

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_own" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "schedule_items_own" ON schedule_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "projects_own" ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "project_tasks_own" ON project_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "friendships_own" ON friendships FOR ALL USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "friend_actions_own" ON friend_actions FOR ALL USING (auth.uid() = actor_id);
CREATE POLICY "opportunity_evaluations_own" ON opportunity_evaluations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "quarterly_reviews_own" ON quarterly_reviews FOR ALL USING (auth.uid() = user_id);

-- Allow reading other users' profiles for friend search (username only)
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);
