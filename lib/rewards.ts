// lib/rewards.ts — Variable Rewards evaluation engine
// Single entry point: evaluateRewards(userId, payload) → newly earned DBRewardEvent[]
// All checks are idempotent via ON CONFLICT DO NOTHING on reward_events.unique(user_id, dedupe_key).

import { supabase } from '@/lib/supabase'
import { toDateStr, getMonday, addDays } from '@/lib/planData'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RewardType =
  | 'first_move'
  | 'full_day'
  | 'perfect_week'
  | 'quiet_win'
  | 'streak_milestone'
  | 'first_reflection'
  | 'goal_complete'
  | 'back_in_rhythm'

export interface DBRewardEvent {
  id: string
  user_id: string
  reward_type: RewardType
  dedupe_key: string
  context: Record<string, unknown>
  earned_at: string
  seen: boolean
  created_at: string
}

export interface TaskCompletedContext {
  taskId: string
  taskDate: string        // YYYY-MM-DD
  taskCreatedAt: string   // ISO timestamptz
  taskCategory: string
  goalId: string | null
  goalTitle: string | null
  goalProgress: number | null  // 0–100, after recalcGoalProgressFromTasks
}

export interface ReflectionSubmittedContext {
  weekOf: string  // YYYY-MM-DD (Monday of the week reflected on)
  streak: number  // value from getWeekStreakFromDB, already includes this submission
}

export interface AppOpenedContext {
  date: string  // YYYY-MM-DD (today's date)
}

export type TriggerPayload =
  | { trigger: 'task_completed'; ctx: TaskCompletedContext }
  | { trigger: 'reflection_submitted'; ctx: ReflectionSubmittedContext }
  | { trigger: 'app_opened'; ctx: AppOpenedContext }

// ─── Idempotent insert helper ─────────────────────────────────────────────────

/**
 * Attempts an INSERT with ON CONFLICT (user_id, dedupe_key) DO NOTHING.
 * Returns the inserted row (newly earned) or null (already earned / error).
 */
async function tryEarn(
  userId: string,
  rewardType: RewardType,
  dedupeKey: string,
  context: Record<string, unknown> = {},
): Promise<DBRewardEvent | null> {
  const { data, error } = await supabase
    .from('reward_events')
    .upsert(
      [{ user_id: userId, reward_type: rewardType, dedupe_key: dedupeKey, context }],
      { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
    )
    .select()
  if (error) { console.error('tryEarn:', rewardType, error.message); return null }
  // Non-empty array = newly inserted = newly earned
  return data && data.length > 0 ? (data[0] as DBRewardEvent) : null
}

// ─── Individual reward checks ─────────────────────────────────────────────────

async function checkFirstMove(userId: string): Promise<DBRewardEvent | null> {
  return tryEarn(userId, 'first_move', 'first_move')
}

async function checkFullDay(userId: string, date: string): Promise<DBRewardEvent | null> {
  const { data } = await supabase
    .from('tasks')
    .select('id, completed, text')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('is_recurrence_template', false)
    .order('scheduled_time', { ascending: true })
  const all = data ?? []
  if (all.length === 0) return null
  if (!all.every((t: { completed: boolean }) => t.completed)) return null
  const taskTitles = all
    .slice(0, 3)
    .map((t: { text: string }) => t.text)
  return tryEarn(userId, 'full_day', `full_day:${date}`, { date, taskTitles, taskCount: all.length })
}

async function checkPerfectWeek(userId: string, anyDateInWeek: string): Promise<DBRewardEvent | null> {
  const monday = getMonday(new Date(anyDateInWeek + 'T12:00:00'))
  const mondayStr = toDateStr(monday)
  const sundayStr = toDateStr(addDays(monday, 6))

  const { data } = await supabase
    .from('tasks')
    .select('id, completed')
    .eq('user_id', userId)
    .eq('is_recurrence_template', false)
    .gte('date', mondayStr)
    .lte('date', sundayStr)
  const all = data ?? []
  if (all.length === 0) return null
  if (!all.every((t: { completed: boolean }) => t.completed)) return null
  return tryEarn(userId, 'perfect_week', `perfect_week:${mondayStr}`, { week_of: mondayStr })
}

async function checkQuietWin(
  userId: string,
  taskId: string,
  taskCreatedAt: string,
  taskCategory: string,
): Promise<DBRewardEvent | null> {
  // Cooldown gate: bail early if any quiet_win in the last 4 days
  const cooldownCutoff = new Date()
  cooldownCutoff.setDate(cooldownCutoff.getDate() - 4)
  const { data: recent } = await supabase
    .from('reward_events')
    .select('id')
    .eq('user_id', userId)
    .eq('reward_type', 'quiet_win')
    .gte('earned_at', cooldownCutoff.toISOString())
    .limit(1)
  if ((recent?.length ?? 0) > 0) return null

  // Condition A: task sat for 5+ days before being completed
  const ageDays = (Date.now() - new Date(taskCreatedAt).getTime()) / 86_400_000
  if (ageDays >= 5) {
    return tryEarn(userId, 'quiet_win', `quiet_win:${taskId}`, {
      taskId,
      category: taskCategory,
      trigger: 'procrastinated',
    })
  }

  // Condition B: rarely-used category (<15% of last 45 days completions), min 10 tasks
  const cutoff45 = new Date()
  cutoff45.setDate(cutoff45.getDate() - 45)
  const { data: recentCompleted } = await supabase
    .from('tasks')
    .select('category')
    .eq('user_id', userId)
    .eq('completed', true)
    .eq('is_recurrence_template', false)
    .gte('completed_at', cutoff45.toISOString())
  const all = recentCompleted ?? []
  if (all.length >= 10) {
    const catCount = all.filter((t: { category: string }) => t.category === taskCategory).length
    if (catCount / all.length < 0.15) {
      return tryEarn(userId, 'quiet_win', `quiet_win:${taskId}`, {
        taskId,
        category: taskCategory,
        trigger: 'rare_category',
      })
    }
  }

  return null
}

async function checkBackInRhythm(
  userId: string,
  taskId: string,   // the task just completed; excluded from the "prior completions" guard
  date: string,
): Promise<DBRewardEvent | null> {
  // Guard: user must have at least 1 prior completed task (so first-ever completion → first_move, not this)
  const { data: prior } = await supabase
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', true)
    .eq('is_recurrence_template', false)
    .neq('id', taskId)
    .limit(1)
  if ((prior?.length ?? 0) === 0) return null

  // Check: no other completed tasks in the last 3 calendar days (gap check)
  const gapCutoff = new Date()
  gapCutoff.setDate(gapCutoff.getDate() - 3)
  gapCutoff.setHours(0, 0, 0, 0)
  const { data: recentCompletions } = await supabase
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', true)
    .eq('is_recurrence_template', false)
    .neq('id', taskId)
    .gte('completed_at', gapCutoff.toISOString())
    .limit(1)
  if ((recentCompletions?.length ?? 0) > 0) return null

  return tryEarn(userId, 'back_in_rhythm', `back_in_rhythm:${date}`, { date })
}

async function checkGoalComplete(
  userId: string,
  goalId: string,
  goalTitle: string,
  goalProgress: number,
): Promise<DBRewardEvent | null> {
  if (goalProgress < 100) return null
  return tryEarn(userId, 'goal_complete', `goal_complete:${goalId}`, { goalId, goalTitle })
}

async function checkFirstReflection(userId: string, streak: number): Promise<DBRewardEvent | null> {
  return tryEarn(userId, 'first_reflection', 'first_reflection', { streak })
}

const STREAK_TIERS = [3, 7, 14, 28] as const

async function checkStreakMilestone(userId: string, streak: number): Promise<DBRewardEvent | null> {
  // Find the highest tier the current streak has hit
  const hitTier = ([...STREAK_TIERS] as number[]).reverse().find(t => streak >= t)
  if (!hitTier) return null
  return tryEarn(userId, 'streak_milestone', `streak_milestone:${hitTier}`, {
    tier: hitTier,
    streak,
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluates rewards for a given trigger. Returns only newly earned rewards.
 *
 * Non-blocking design: call without await from UI event handlers so reward
 * evaluation never delays the task toggle or reflection save the user sees.
 *
 *   evaluateRewards(userId, payload).then(earned => queueRewards(earned))
 */
export async function evaluateRewards(
  userId: string,
  payload: TriggerPayload,
): Promise<DBRewardEvent[]> {
  const earned: DBRewardEvent[] = []

  try {
    if (payload.trigger === 'task_completed') {
      const { taskId, taskDate, taskCreatedAt, taskCategory, goalId, goalTitle, goalProgress } = payload.ctx

      const results = await Promise.all([
        checkFirstMove(userId),
        checkFullDay(userId, taskDate),
        checkQuietWin(userId, taskId, taskCreatedAt, taskCategory),
        checkBackInRhythm(userId, taskId, taskDate),
        goalId && goalTitle !== null && goalProgress !== null
          ? checkGoalComplete(userId, goalId, goalTitle, goalProgress)
          : null,
      ])
      results.forEach(r => { if (r) earned.push(r) })
    }

    if (payload.trigger === 'reflection_submitted') {
      const { weekOf, streak } = payload.ctx
      const results = await Promise.all([
        checkFirstReflection(userId, streak),
        checkStreakMilestone(userId, streak),
        checkPerfectWeek(userId, weekOf),
      ])
      results.forEach(r => { if (r) earned.push(r) })
    }

    if (payload.trigger === 'app_opened') {
      // Reconciliation: check yesterday's full_day and the previous week's perfect_week.
      // back_in_rhythm is only fired from task_completed (tied to a concrete user action).
      const { date } = payload.ctx
      const yesterday = toDateStr(addDays(new Date(date + 'T12:00:00'), -1))
      const results = await Promise.all([
        checkFullDay(userId, yesterday),
        checkPerfectWeek(userId, yesterday),
      ])
      results.forEach(r => { if (r) earned.push(r) })
    }
  } catch (err) {
    console.error('evaluateRewards:', err)
  }

  return earned
}

/** Mark a reward as seen after the UI has displayed it. */
export async function markRewardSeen(rewardId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('reward_events')
    .update({ seen: true })
    .eq('id', rewardId)
    .eq('user_id', userId)
  if (error) console.error('markRewardSeen:', error.message)
}

/** Fetch all unseen rewards, oldest-first, for display queuing. */
export async function getUnseenRewards(userId: string): Promise<DBRewardEvent[]> {
  const { data, error } = await supabase
    .from('reward_events')
    .select('*')
    .eq('user_id', userId)
    .eq('seen', false)
    .order('earned_at', { ascending: true })
  if (error) { console.error('getUnseenRewards:', error.message); return [] }
  return (data ?? []) as DBRewardEvent[]
}
