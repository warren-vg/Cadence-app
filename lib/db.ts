// lib/db.ts — Cadence Centralised Data Access Layer
// All Supabase table operations go here. Pages import from this module.

import { supabase } from '@/lib/supabase'
import { toDateStr, addDays, getMonday, timeToMinutes } from '@/lib/planData'
import { RESERVED_USERNAMES } from '@/lib/reservedUsernames'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly'
  days_of_week?: number[]  // 0=Sun, 1=Mon, …, 6=Sat. Required when frequency='weekly'.
  ends_on: string | null   // YYYY-MM-DD, or null for no end date.
}

export interface DBTask {
  id: string
  user_id: string
  text: string
  date: string      // YYYY-MM-DD; display queries always filter out templates so this is never null
  scheduled_time: string   // HH:MM
  duration: number         // hours
  category: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
  completed_at?: string | null
  goal_id?: string | null
  milestone_id?: string | null
  project_id?: string | null
  source?: 'manual' | 'auto'  // 'auto' = Build Week generated; 'manual' = user created
  created_at?: string
  // Recurrence (E2)
  is_recurrence_template?: boolean         // true on the master template row (no date)
  recurrence_template_id?: string | null   // on instance rows: FK to the template
  recurrence_rule?: RecurrenceRule | null  // set on template rows only
}

export interface DBScheduleItem {
  id: string
  user_id: string
  title: string
  scheduled_date: string
  start_time: string
  duration_minutes: number
  category: string
  is_flexible: boolean
  created_at?: string
}

export interface DBProject {
  id: string
  user_id: string
  title: string
  type: 'campaign' | 'study' | 'creative' | 'opportunity' | 'business'
  status: 'active' | 'planning' | 'paused' | 'completed' | 'archived'
  progress: number
  timeline?: string | null
  notes?: string | null
  created_at?: string
}

export interface DBMilestone {
  id: string
  user_id: string
  goal_id: string
  project_id?: string | null
  text: string
  completed: boolean
  target_date?: string | null
  created_at?: string
  updated_at?: string
}

export interface DBProjectTask {
  id: string
  project_id: string
  user_id: string
  text: string
  completed: boolean
  order_index: number
  created_at?: string
}

export interface WorkSchedule {
  employmentType: 'full-time' | 'part-time' | 'self-employed' | 'not-working'
  workDays: string[]
  workStartTime: string | null
  workEndTime: string | null
  timezone: string
}

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  employmentType: 'full-time',
  workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  workStartTime: '09:00',
  workEndTime: '17:00',
  timezone: 'America/New_York',
}

export interface DBGoal {
  id: string
  user_id: string
  text: string
  category: string
  status: 'active' | 'parked' | 'archived' | string
  priority: number
  progress: number
  quarter?: string | null
  refined_goal?: string | null
  metric?: string | null
  purpose?: string | null
  steps?: string[] | null
  notes?: string | null
  estimated_weekly_hours?: number | null
  project_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface FriendProfile {
  friendship_id: string
  friend_id: string
  username: string
  avatar_url?: string | null
  is_requester: boolean
}

export interface PendingRequest {
  id: string
  from_id: string
  username: string
  avatar_url?: string | null
  direction: 'incoming' | 'outgoing'
  created_at: string
}

export interface HypeNudgeResult {
  success: boolean
  error?: string
  onCooldown?: boolean
}

// ─── Task CRUD ────────────────────────────────────────────────────────────────

export async function getTasksForDate(userId: string, date: string): Promise<DBTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('is_recurrence_template', false)
    .order('scheduled_time', { ascending: true })
  if (error) { console.error('getTasksForDate:', error.message); return [] }
  return (data ?? []) as DBTask[]
}

export async function getTasksForWeek(userId: string, monday: Date): Promise<DBTask[]> {
  const start = toDateStr(monday)
  const end   = toDateStr(addDays(monday, 6))
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_recurrence_template', false)
    .gte('date', start)
    .lte('date', end)
  if (error) { console.error('getTasksForWeek:', error.message); return [] }
  return (data ?? []) as DBTask[]
}

export async function createTask(
  userId: string,
  task: Omit<DBTask, 'id' | 'user_id' | 'created_at' | 'completed_at'>
): Promise<DBTask | null> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, user_id: userId })
    .select()
    .single()
  if (error) { console.error('createTask:', error.message); return null }
  return data as DBTask
}

export async function toggleTask(taskId: string, currentCompleted: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .update({
      completed:    !currentCompleted,
      completed_at: !currentCompleted ? new Date().toISOString() : null,
    })
    .eq('id', taskId)
  if (error) { console.error('toggleTask:', error.message); return false }
  return true
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) { console.error('deleteTask:', error.message); return false }
  return true
}

export async function recalcGoalProgressFromTasks(goalId: string, userId: string): Promise<number | null> {
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('completed')
    .eq('goal_id', goalId)
    .eq('user_id', userId)
    .eq('is_recurrence_template', false)

  const { data: goal } = await supabase
    .from('goals')
    .select('progress')
    .eq('id', goalId)
    .single()

  if (!goal) return null

  const tasks: { completed: boolean }[] = allTasks || []
  if (tasks.length === 0) return goal.progress as number

  const newProgress = Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
  await supabase.from('goals').update({ progress: newProgress }).eq('id', goalId)
  return newProgress
}

// ─── Milestone CRUD ───────────────────────────────────────────────────────────

export async function getMilestonesForGoal(goalId: string, userId: string): Promise<DBMilestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('goal_id', goalId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) { console.error('getMilestonesForGoal:', error.message); return [] }
  return (data ?? []) as DBMilestone[]
}

export async function createMilestone(userId: string, goalId: string, text: string): Promise<DBMilestone | null> {
  const { data, error } = await supabase
    .from('milestones')
    .insert({ user_id: userId, goal_id: goalId, text, completed: false })
    .select()
    .single()
  if (error) { console.error('createMilestone:', error.message); return null }
  return data as DBMilestone
}

export async function toggleMilestoneCompleted(milestoneId: string, completed: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('milestones')
    .update({ completed, updated_at: new Date().toISOString() })
    .eq('id', milestoneId)
  if (error) { console.error('toggleMilestoneCompleted:', error.message); return false }
  return true
}

export async function replaceMilestonesForGoal(
  userId: string,
  goalId: string,
  milestones: Array<{ text: string; completed: boolean }>
): Promise<boolean> {
  const { error: delErr } = await supabase
    .from('milestones')
    .delete()
    .eq('goal_id', goalId)
    .eq('user_id', userId)
  if (delErr) { console.error('replaceMilestonesForGoal (delete):', delErr.message); return false }
  if (milestones.length === 0) return true
  const { error: insErr } = await supabase
    .from('milestones')
    .insert(milestones.map(m => ({ user_id: userId, goal_id: goalId, text: m.text, completed: m.completed })))
  if (insErr) { console.error('replaceMilestonesForGoal (insert):', insErr.message); return false }
  return true
}

// ─── Schedule CRUD ────────────────────────────────────────────────────────────

export async function getScheduleForDate(userId: string, dateStr: string): Promise<DBScheduleItem[]> {
  const { data, error } = await supabase
    .from('schedule_items')
    .select('*')
    .eq('user_id', userId)
    .eq('scheduled_date', dateStr)
    .order('start_time', { ascending: true })
  if (error) { console.error('getScheduleForDate:', error.message); return [] }
  return (data ?? []) as DBScheduleItem[]
}

export async function createScheduleItem(
  userId: string,
  item: Omit<DBScheduleItem, 'id' | 'user_id' | 'created_at'>
): Promise<DBScheduleItem | null> {
  const { data, error } = await supabase
    .from('schedule_items')
    .insert({ ...item, user_id: userId })
    .select()
    .single()
  if (error) { console.error('createScheduleItem:', error.message); return null }
  return data as DBScheduleItem
}

export async function updateScheduleItem(
  itemId: string,
  updates: Partial<Omit<DBScheduleItem, 'id' | 'user_id' | 'created_at'>>
): Promise<boolean> {
  const { error } = await supabase.from('schedule_items').update(updates).eq('id', itemId)
  if (error) { console.error('updateScheduleItem:', error.message); return false }
  return true
}

export async function deleteScheduleItem(id: string): Promise<boolean> {
  const { error } = await supabase.from('schedule_items').delete().eq('id', id)
  if (error) { console.error('deleteScheduleItem:', error.message); return false }
  return true
}

// ─── Project CRUD ─────────────────────────────────────────────────────────────

export async function getProjects(userId: string): Promise<DBProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('getProjects:', error.message); return [] }
  return (data ?? []) as DBProject[]
}

export async function getProjectById(id: string): Promise<DBProject | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
  if (error) { console.error('getProjectById:', error.message); return null }
  return data as DBProject
}

export async function createProject(
  userId: string,
  project: Omit<DBProject, 'id' | 'user_id' | 'created_at'>
): Promise<DBProject | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert({ ...project, user_id: userId })
    .select()
    .single()
  if (error) { console.error('createProject:', error.message); return null }
  return data as DBProject
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<DBProject, 'id' | 'user_id' | 'created_at'>>
): Promise<boolean> {
  const { error } = await supabase.from('projects').update(updates).eq('id', id)
  if (error) { console.error('updateProject:', error.message); return false }
  return true
}

export async function deleteProject(id: string): Promise<boolean> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) { console.error('deleteProject:', error.message); return false }
  return true
}

// ─── Project Tasks ────────────────────────────────────────────────────────────

export async function getProjectTasks(projectId: string): Promise<DBProjectTask[]> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })
  if (error) { console.error('getProjectTasks:', error.message); return [] }
  return (data ?? []) as DBProjectTask[]
}

export async function createProjectTask(
  userId: string,
  projectId: string,
  taskText: string,
  currentTaskCount: number
): Promise<DBProjectTask | null> {
  const { data, error } = await supabase
    .from('project_tasks')
    .insert({ user_id: userId, project_id: projectId, text: taskText, completed: false, order_index: currentTaskCount })
    .select()
    .single()
  if (error) { console.error('createProjectTask:', error.message); return null }
  return data as DBProjectTask
}

export async function toggleProjectTask(
  taskId: string,
  projectId: string,
  currentCompleted: boolean
): Promise<number> {
  const { error: toggleError } = await supabase
    .from('project_tasks').update({ completed: !currentCompleted }).eq('id', taskId)
  if (toggleError) { console.error('toggleProjectTask (toggle):', toggleError.message); return -1 }

  const { data: allTasks, error: tasksError } = await supabase
    .from('project_tasks')
    .select('completed')
    .eq('project_id', projectId)
  if (tasksError) { console.error('toggleProjectTask (allTasks):', tasksError.message); return -1 }

  const tasks: { completed: boolean }[] = allTasks || []
  const newProgress = tasks.length > 0
    ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
    : 0

  const { error: progressError } = await supabase
    .from('projects').update({ progress: newProgress }).eq('id', projectId)
  if (progressError) { console.error('toggleProjectTask (progress):', progressError.message) }

  // Propagate completion to any goals linked to this project (via goals.project_id)
  const { data: linkedGoals } = await supabase
    .from('goals')
    .select('id, progress')
    .eq('project_id', projectId)

  if (linkedGoals && linkedGoals.length > 0) {
    for (const g of linkedGoals) {
      const { data: goalTasks } = await supabase
        .from('tasks')
        .select('completed')
        .eq('goal_id', g.id)
        .eq('is_recurrence_template', false)
      const gt: { completed: boolean }[] = goalTasks || []
      // Preserve existing progress when a goal has no tasks (matches recalcGoalProgressFromTasks behaviour)
      const goalProgress = gt.length > 0
        ? Math.round((gt.filter(t => t.completed).length / gt.length) * 100)
        : (g.progress ?? 0)
      const { error: goalError } = await supabase
        .from('goals').update({ progress: goalProgress }).eq('id', g.id)
      if (goalError) { console.error('toggleProjectTask (goalProgress):', goalError.message); return newProgress }
    }
  }

  return newProgress
}

// ─── Priority Stack ───────────────────────────────────────────────────────────

export async function savePriorityStack(userId: string, categories: string[]): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ priority_stack: categories })
    .eq('id', userId)
  if (error) { console.error('savePriorityStack:', error.message); return false }
  return true
}

export async function getPriorityStack(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('priority_stack')
    .eq('id', userId)
    .single()
  if (error) { console.error('getPriorityStack:', error.message); return [] }
  return (data?.priority_stack ?? []) as string[]
}

// ─── Energy Blocks ────────────────────────────────────────────────────────────

export async function saveEnergyBlocks(
  userId: string,
  assignments: Record<string, string>
): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ energy_blocks: assignments })
    .eq('id', userId)
  if (error) { console.error('saveEnergyBlocks:', error.message); return false }
  return true
}

export async function getEnergyBlocks(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('energy_blocks')
    .eq('id', userId)
    .single()
  if (error) { console.error('getEnergyBlocks:', error.message); return {} }
  return (data?.energy_blocks ?? {}) as Record<string, string>
}

// ─── Community / Friendships ──────────────────────────────────────────────────

export async function getFriends(userId: string): Promise<FriendProfile[]> {
  const [{ data: sent }, { data: received }] = await Promise.all([
    supabase.from('friendships').select('id, friend_id').eq('user_id', userId).eq('status', 'accepted'),
    supabase.from('friendships').select('id, user_id').eq('friend_id', userId).eq('status', 'accepted'),
  ])

  const sentIds     = (sent    || []).map((f: { id: string; friend_id: string }) => ({ friendship_id: f.id, friend_id: f.friend_id, is_requester: true  }))
  const receivedIds = (received || []).map((f: { id: string; user_id: string })  => ({ friendship_id: f.id, friend_id: f.user_id,   is_requester: false }))
  const all = [...sentIds, ...receivedIds]

  if (all.length === 0) return []

  const ids = all.map(f => f.friend_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', ids)

  const profileMap = new Map((profiles || []).map((p: { id: string; username: string; avatar_url: string | null }) => [p.id, p]))

  return all.map(f => {
    const p = profileMap.get(f.friend_id)
    return {
      friendship_id: f.friendship_id,
      friend_id:     f.friend_id,
      username:      p?.username   || 'Unknown',
      avatar_url:    p?.avatar_url ?? null,
      is_requester:  f.is_requester,
    }
  })
}

export async function getPendingRequests(userId: string): Promise<PendingRequest[]> {
  const [{ data: incoming }, { data: outgoing }] = await Promise.all([
    supabase.from('friendships').select('id, user_id, created_at').eq('friend_id', userId).eq('status', 'pending'),
    supabase.from('friendships').select('id, friend_id, created_at').eq('user_id', userId).eq('status', 'pending'),
  ])

  const incomingIds = (incoming || []).map((r: { id: string; user_id: string; created_at: string }) => ({ id: r.id, from_id: r.user_id, direction: 'incoming' as const, created_at: r.created_at }))
  const outgoingIds = (outgoing || []).map((r: { id: string; friend_id: string; created_at: string }) => ({ id: r.id, from_id: r.friend_id, direction: 'outgoing' as const, created_at: r.created_at }))
  const all = [...incomingIds, ...outgoingIds]

  if (all.length === 0) return []

  const ids = all.map(r => r.from_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', ids)

  const profileMap = new Map((profiles || []).map((p: { id: string; username: string; avatar_url: string | null }) => [p.id, p]))

  return all.map(r => {
    const p = profileMap.get(r.from_id)
    return {
      id:         r.id,
      from_id:    r.from_id,
      username:   p?.username   || 'Unknown',
      avatar_url: p?.avatar_url ?? null,
      direction:  r.direction,
      created_at: r.created_at,
    }
  })
}

export async function sendFriendRequest(
  userId: string,
  targetUsername: string,
  connectionMethod: string = 'manual'
): Promise<{ success: boolean; error?: string }> {
  const { data: targetUser } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', targetUsername)
    .maybeSingle()

  if (!targetUser) return { success: false, error: 'User not found' }
  if (targetUser.id === userId) return { success: false, error: 'You cannot add yourself' }

  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(`and(user_id.eq.${userId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${userId})`)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') return { success: false, error: 'Already friends' }
    if (existing.status === 'pending')  return { success: false, error: 'Request already sent' }
  }

  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: userId, friend_id: targetUser.id, status: 'pending', connection_method: connectionMethod })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function respondToFriendRequest(requestId: string, accept: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', requestId)
  if (error) { console.error('respondToFriendRequest:', error.message); return false }
  return true
}

export async function removeFriend(userId: string, friendId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
  if (error) { console.error('removeFriend:', error.message); return false }
  return true
}

export async function sendHypeOrNudge(
  actorId: string,
  targetId: string,
  actionType: 'hype' | 'nudge'
): Promise<HypeNudgeResult> {
  const periodWeek = toDateStr(getMonday(new Date()))
  const { error } = await supabase
    .from('community_actions')
    .insert({ actor_id: actorId, target_id: targetId, action_type: actionType, period_week: periodWeek })

  if (error) {
    if (error.code === '23505') {
      return { success: false, onCooldown: true, error: `You already ${actionType === 'hype' ? 'hyped' : 'nudged'} this person this week` }
    }
    return { success: false, error: error.message }
  }

  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId, targetId, actionType }),
  }).catch(() => { /* silently ignore — /api/notify may not exist */ })

  return { success: true }
}

export async function getFriendGoals(friendId: string): Promise<Array<{
  id: string; text: string; category: string; progress: number; status: string
}>> {
  const { data, error } = await supabase
    .from('goals')
    .select('id, text, category, progress, status')
    .eq('user_id', friendId)
    .eq('status', 'active')
    .order('priority', { ascending: true })
    .limit(4)
  if (error) { console.error('getFriendGoals:', error.message); return [] }
  return data ?? []
}

// ─── Goal CRUD ────────────────────────────────────────────────────────────────

export async function createGoal(
  userId: string,
  goal: {
    text: string; category: string; status: string; priority: number; progress: number
    notes?: string | null; steps?: string[] | null; quarter?: string | null
    estimated_weekly_hours?: number | null
  }
): Promise<{ id: string; text: string; category: string; status: string; priority: number; progress: number; quarter?: string | null; refined_goal?: string | null } | null> {
  const { data, error } = await supabase
    .from('goals')
    .insert({ ...goal, user_id: userId })
    .select()
    .single()
  if (error) { console.error('createGoal:', error.message); return null }
  return data
}

export async function cancelFriendRequest(requestId: string): Promise<boolean> {
  const { error } = await supabase.from('friendships').delete().eq('id', requestId)
  if (error) { console.error('cancelFriendRequest:', error.message); return false }
  return true
}

// ─── Weekly Reflections ────────────────────────────────────────────────────────

export interface DBReflection {
  week_of:         string
  wins:            string
  challenges:      string
  learnings:       string
  next_week_focus: string
  week_score:      number
}

export async function saveReflectionToDB(userId: string, r: DBReflection): Promise<boolean> {
  const { error } = await supabase
    .from('weekly_reflections')
    .upsert({ ...r, user_id: userId }, { onConflict: 'user_id,week_of' })
  if (error) { console.error('saveReflectionToDB:', error.message); return false }
  return true
}

export async function getReflectionForWeek(userId: string, weekOf: string): Promise<DBReflection | null> {
  const { data, error } = await supabase
    .from('weekly_reflections')
    .select('week_of, wins, challenges, learnings, next_week_focus, week_score')
    .eq('user_id', userId)
    .eq('week_of', weekOf)
    .single()
  if (error && error.code !== 'PGRST116') { console.error('getReflectionForWeek:', error.message) }
  return (data ?? null) as DBReflection | null
}

export async function getWeekStreakFromDB(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('weekly_reflections')
    .select('week_of')
    .eq('user_id', userId)
  if (error) { console.error('getWeekStreakFromDB:', error.message); return 0 }
  const weekSet = new Set((data || []).map((r: { week_of: string }) => r.week_of))
  let streak    = 0
  let cursor    = getMonday(new Date())
  while (streak < 52) {
    if (weekSet.has(toDateStr(cursor))) { streak++; cursor = addDays(cursor, -7) }
    else break
  }
  return streak
}

// ─── Work Schedule Helpers ────────────────────────────────────────────────────

export function isWorkDay(date: Date, workSchedule: WorkSchedule): boolean {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return workSchedule.workDays.includes(DAY_NAMES[date.getDay()])
}

export function getBlockedHoursForDate(
  date: Date,
  workSchedule: WorkSchedule
): { start: string; end: string } | null {
  if (!isWorkDay(date, workSchedule)) return null
  if (!workSchedule.workStartTime || !workSchedule.workEndTime) return null
  return { start: workSchedule.workStartTime, end: workSchedule.workEndTime }
}

export function canScheduleTaskInSlot(
  taskCategory: string,
  slotTime: string,
  date: Date,
  workSchedule: WorkSchedule
): boolean {
  const blocked = getBlockedHoursForDate(date, workSchedule)
  if (!blocked) return true

  const slotMins     = timeToMinutes(slotTime)
  const blockStart   = timeToMinutes(blocked.start)
  const blockEnd     = timeToMinutes(blocked.end)
  const isDuringWork = slotMins >= blockStart && slotMins < blockEnd

  if (!isDuringWork) return true
  // Career and Business are work-hours categories; all others (Health, Finance, Creative, etc.) run off-hours.
  // Expand this list based on user feedback when new category types are added.
  return ['Career', 'Business'].includes(taskCategory)
}

export function findBestSlot(
  task: { energyType: string; category: string; duration: number },
  date: Date,
  energyBlocks: Record<string, string>,
  existingTasks: { scheduled_time: string }[],
  workSchedule: WorkSchedule
): string | null {
  const slots = Object.entries(energyBlocks).sort(([a], [b]) => a.localeCompare(b))
  const occupied = new Set(existingTasks.map(t => t.scheduled_time.slice(0, 5)))

  const matching = slots.filter(([time, energy]) =>
    energy === task.energyType && !occupied.has(time) &&
    canScheduleTaskInSlot(task.category, time, date, workSchedule)
  )
  if (matching.length > 0) return matching[0][0]

  const fallback = slots.filter(([time, energy]) =>
    energy !== 'recovery' && !occupied.has(time) &&
    canScheduleTaskInSlot(task.category, time, date, workSchedule)
  )
  return fallback.length > 0 ? fallback[0][0] : null
}

// ─── Recurring Tasks (E2) ─────────────────────────────────────────────────────

type RecurringTaskInput = Omit<
  DBTask,
  'id' | 'user_id' | 'created_at' | 'completed_at' | 'date' | 'completed' |
  'is_recurrence_template' | 'recurrence_template_id' | 'recurrence_rule'
>

/** Returns YYYY-MM-DD strings in [from, to] that match a RecurrenceRule. */
function recurrenceDatesInRange(rule: RecurrenceRule, from: Date, to: Date): string[] {
  const dates: string[] = []
  const endsOn  = rule.ends_on ? new Date(rule.ends_on + 'T00:00:00') : null
  const cursor  = new Date(from); cursor.setHours(0, 0, 0, 0)
  const ceiling = new Date(to);   ceiling.setHours(23, 59, 59, 999)

  while (cursor <= ceiling) {
    if (endsOn && cursor > endsOn) break
    const matches =
      rule.frequency === 'daily' ||
      (rule.frequency === 'weekly' && (rule.days_of_week ?? []).includes(cursor.getDay()))
    if (matches) dates.push(toDateStr(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/**
 * Creates a recurring task: one template row (date=null in DB) + instance rows
 * for the next 28 days. Returns the template id and text, or null on failure.
 * Template rows are never returned by display queries — they are internal to the
 * recurrence system and have date=null, so they are not typed as DBTask.
 */
export async function createRecurringTask(
  userId: string,
  taskData: RecurringTaskInput,
  rule: RecurrenceRule
): Promise<{ id: string; text: string } | null> {
  const { data: template, error } = await supabase
    .from('tasks')
    .insert({
      ...taskData,
      user_id: userId,
      date: null,
      completed: false,
      is_recurrence_template: true,
      recurrence_rule: rule,
    })
    .select('id, text')
    .single()
  if (error) { console.error('createRecurringTask:', error.message); return null }

  const today   = new Date()
  const horizon = addDays(today, 27)
  await generateRecurringInstances(userId, (template as { id: string }).id, today, horizon)
  return template as { id: string; text: string }
}

/**
 * Generates instance rows for a recurring template in [fromDate, toDate].
 * Skips dates that already have an instance (idempotent). Returns count inserted.
 */
export async function generateRecurringInstances(
  userId: string,
  templateId: string,
  fromDate: Date,
  toDate: Date
): Promise<number> {
  const { data: tmpl, error: tErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', templateId)
    .eq('is_recurrence_template', true)
    .single()
  if (tErr || !tmpl) {
    console.error('generateRecurringInstances (template):', tErr?.message ?? 'not found')
    return 0
  }

  const rule = tmpl.recurrence_rule as RecurrenceRule | null
  if (!rule) { console.error('generateRecurringInstances: template has no recurrence_rule'); return 0 }

  const targetDates = recurrenceDatesInRange(rule, fromDate, toDate)
  if (targetDates.length === 0) return 0

  const { data: existing } = await supabase
    .from('tasks')
    .select('date')
    .eq('recurrence_template_id', templateId)
    .in('date', targetDates)

  const existingSet = new Set((existing ?? []).map((r: { date: string }) => r.date))
  const toInsert    = targetDates.filter(d => !existingSet.has(d))
  if (toInsert.length === 0) return 0

  const { error: insErr } = await supabase.from('tasks').insert(
    toInsert.map(date => ({
      user_id:                userId,
      text:                   tmpl.text,
      date,
      scheduled_time:         tmpl.scheduled_time,
      duration:               tmpl.duration,
      category:               tmpl.category,
      priority:               tmpl.priority,
      completed:              false,
      goal_id:                tmpl.goal_id,
      milestone_id:           tmpl.milestone_id,
      project_id:             tmpl.project_id,
      source:                 tmpl.source,
      is_recurrence_template: false,
      recurrence_template_id: templateId,
    }))
  )
  if (insErr) { console.error('generateRecurringInstances (insert):', insErr.message); return 0 }
  return toInsert.length
}

/**
 * Stops a recurrence by setting ends_on to today in the template's rule.
 * Existing instances are preserved. New instances stop being generated.
 */
export async function stopRecurrence(templateId: string): Promise<boolean> {
  const { data: tmpl, error: tErr } = await supabase
    .from('tasks')
    .select('recurrence_rule')
    .eq('id', templateId)
    .single()
  if (tErr || !tmpl) { console.error('stopRecurrence:', tErr?.message ?? 'not found'); return false }

  const updated: RecurrenceRule = {
    ...(tmpl.recurrence_rule as RecurrenceRule),
    ends_on: toDateStr(new Date()),
  }
  const { error } = await supabase
    .from('tasks')
    .update({ recurrence_rule: updated })
    .eq('id', templateId)
  if (error) { console.error('stopRecurrence (update):', error.message); return false }
  return true
}

/**
 * Edits all future instances (date >= fromDate) of a recurring task:
 * deletes them, updates the template with new field values and/or a new rule,
 * then regenerates instances for the next 28 days from fromDate.
 */
export async function editFutureRecurringInstances(
  templateId: string,
  userId: string,
  fromDate: Date,
  updates: Partial<RecurringTaskInput>,
  newRule?: RecurrenceRule
): Promise<boolean> {
  const { error: delErr } = await supabase
    .from('tasks')
    .delete()
    .eq('recurrence_template_id', templateId)
    .gte('date', toDateStr(fromDate))
  if (delErr) { console.error('editFutureRecurringInstances (delete):', delErr.message); return false }

  const templateUpdate: Record<string, unknown> = { ...updates }
  if (newRule) templateUpdate.recurrence_rule = newRule
  const { error: updErr } = await supabase
    .from('tasks')
    .update(templateUpdate)
    .eq('id', templateId)
  if (updErr) { console.error('editFutureRecurringInstances (update):', updErr.message); return false }

  const horizon = addDays(fromDate, 27)
  await generateRecurringInstances(userId, templateId, fromDate, horizon)
  return true
}

/**
 * Ensures recurring instances exist for the given week (monday → sunday).
 * Call this from Build Week so recurring tasks appear in the weekly plan.
 * Safe to call multiple times — already-created instances are skipped.
 */
export async function syncRecurringInstancesForWeek(userId: string, monday: Date): Promise<void> {
  const sunday    = addDays(monday, 6)
  const mondayStr = toDateStr(monday)

  const { data: templates, error } = await supabase
    .from('tasks')
    .select('id, recurrence_rule')
    .eq('user_id', userId)
    .eq('is_recurrence_template', true)
  if (error) { console.error('syncRecurringInstancesForWeek:', error.message); return }

  for (const t of (templates ?? [])) {
    const rule = t.recurrence_rule as RecurrenceRule | null
    if (!rule) continue
    // Skip templates whose recurrence ended before this week
    if (rule.ends_on && rule.ends_on < mondayStr) continue
    await generateRecurringInstances(userId, t.id, monday, sunday)
  }
}

// ─── Notifications (Phase 3A) ─────────────────────────────────────────────────

export interface DBNotification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  action_url: string | null
  icon_key: string | null
  read: boolean
  created_at: string
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  actionUrl?: string,
  iconKey?: string,
): Promise<DBNotification | null> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, title, message, action_url: actionUrl ?? null, icon_key: iconKey ?? null })
    .select()
    .single()
  if (error) { console.error('createNotification:', error.message); return null }
  return data as DBNotification
}

export async function getNotifications(userId: string, limit = 50): Promise<DBNotification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as DBNotification[]
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  return count ?? 0
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
}

// ─── Monthly Snapshots (Phase 3B) ─────────────────────────────────────────────

export interface DBMonthlySnapshot {
  id: string
  user_id: string
  month_label: string
  month_start_date: string
  month_end_date: string
  goals_worked: number
  goals_completed: number
  completion_rate: number
  hours_logged: number
  top_wins: { title: string; description: string; category: string; icon: string }[]
  category_breakdown: Record<string, number>
  momentum_weekly: number[]
  user_reflection: string | null
  created_at: string
}

export async function generateMonthlySnapshot(
  userId: string,
  monthLabel: string,
): Promise<DBMonthlySnapshot | null> {
  const [monthName, yearStr] = monthLabel.split(' ')
  const year       = parseInt(yearStr)
  const monthIndex = new Date(`${monthName} 1 ${year}`).getMonth()
  const startDate  = new Date(year, monthIndex, 1)
  const endDate    = new Date(year, monthIndex + 1, 0)
  const startStr   = toDateStr(startDate)
  const endStr     = toDateStr(endDate)

  const [{ data: allTasks }, { data: completedTasks }] = await Promise.all([
    supabase.from('tasks').select('id, goal_id, category, duration, completed, date')
      .eq('user_id', userId).eq('is_recurrence_template', false)
      .gte('date', startStr).lte('date', endStr),
    supabase.from('tasks').select('id, goal_id, category, duration, date')
      .eq('user_id', userId).eq('completed', true).eq('is_recurrence_template', false)
      .gte('date', startStr).lte('date', endStr),
  ])

  const all       = allTasks ?? []
  const completed = completedTasks ?? []

  const goalIdsWorked = [...new Set(all.map((t: { goal_id: string | null }) => t.goal_id).filter(Boolean))] as string[]

  let goals: { id: string; text: string; category: string | null; progress: number }[] = []
  if (goalIdsWorked.length > 0) {
    const { data } = await supabase
      .from('goals').select('id, text, category, progress')
      .eq('user_id', userId).in('id', goalIdsWorked)
    goals = data ?? []
  }

  const completionRate = all.length > 0
    ? Math.round((completed.length / all.length) * 100) : 0
  const hoursLogged = parseFloat(
    completed.reduce((s: number, t: { duration: number }) => s + (t.duration || 0), 0).toFixed(1)
  )

  const categoryBreakdown: Record<string, number> = {}
  completed.forEach((t: { category: string; duration: number }) => {
    const cat = t.category || 'Other'
    categoryBreakdown[cat] = parseFloat(
      ((categoryBreakdown[cat] || 0) + (t.duration || 0)).toFixed(1)
    )
  })

  // Top wins
  const goalTaskCounts: Record<string, { text: string; category: string; count: number }> = {}
  completed.forEach((t: { goal_id: string | null; category: string }) => {
    if (!t.goal_id) return
    const g = goals.find(g => g.id === t.goal_id)
    if (!g) return
    if (!goalTaskCounts[t.goal_id])
      goalTaskCounts[t.goal_id] = { text: g.text, category: g.category || 'Career', count: 0 }
    goalTaskCounts[t.goal_id].count++
  })
  const topGoal = Object.values(goalTaskCounts).sort((a, b) => b.count - a.count)[0]
  const topCat  = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])[0]

  const { data: momentumData } = await supabase
    .from('momentum_scores').select('score, week_of')
    .eq('user_id', userId).gte('week_of', startStr).lte('week_of', endStr)
    .order('week_of')
  const momentumWeekly = ((momentumData ?? []) as { score: number }[])
    .map(m => m.score ?? 0).slice(0, 4)
  const avgMomentum = momentumWeekly.length > 0
    ? Math.round(momentumWeekly.reduce((s, m) => s + m, 0) / momentumWeekly.length) : 0

  const topWins: DBMonthlySnapshot['top_wins'] = []
  if (topGoal) topWins.push({
    title:       topGoal.text.length > 44 ? topGoal.text.slice(0, 44) + '…' : topGoal.text,
    description: `Completed ${topGoal.count} task${topGoal.count !== 1 ? 's' : ''} toward this goal`,
    category:    topGoal.category,
    icon:        'trophy',
  })
  if (topCat) topWins.push({
    title:       `${topCat[0]} Focus`,
    description: `Logged ${topCat[1]}h in your strongest category`,
    category:    topCat[0],
    icon:        'ribbon',
  })
  if (momentumWeekly.length > 0) topWins.push({
    title:       'Consistency Streak',
    description: `Average momentum of ${avgMomentum} across ${momentumWeekly.length} week${momentumWeekly.length !== 1 ? 's' : ''}`,
    category:    'Personal',
    icon:        'sparkle',
  })

  const payload = {
    user_id:            userId,
    month_label:        monthLabel,
    month_start_date:   startStr,
    month_end_date:     endStr,
    goals_worked:       goalIdsWorked.length,
    goals_completed:    goals.filter(g => g.progress >= 100).length,
    completion_rate:    completionRate,
    hours_logged:       hoursLogged,
    top_wins:           topWins,
    category_breakdown: categoryBreakdown,
    momentum_weekly:    momentumWeekly,
  }

  const { data: snapshot, error } = await supabase
    .from('monthly_snapshots')
    .upsert(payload, { onConflict: 'user_id,month_label' })
    .select().single()
  if (error) { console.error('generateMonthlySnapshot:', error.message); return null }

  await createNotification(
    userId,
    'monthly_snapshot',
    'Monthly Snapshot Ready',
    `Your ${monthLabel} snapshot is now available to view`,
    `/dashboard/snapshots/${snapshot.id}`,
    'chart',
  )
  return snapshot as DBMonthlySnapshot
}

/** Generates the previous month's snapshot if it doesn't exist yet. Call on snapshots page mount. */
export async function ensureMonthlySnapshot(userId: string): Promise<void> {
  const now   = new Date()
  const prev  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const label = prev.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const { data } = await supabase
    .from('monthly_snapshots').select('id')
    .eq('user_id', userId).eq('month_label', label).maybeSingle()
  if (!data) await generateMonthlySnapshot(userId, label)
}

export async function getMonthlySnapshots(userId: string): Promise<DBMonthlySnapshot[]> {
  const { data } = await supabase
    .from('monthly_snapshots').select('*')
    .eq('user_id', userId).order('month_start_date', { ascending: false })
  return (data ?? []) as DBMonthlySnapshot[]
}

export async function getMonthlySnapshot(userId: string, id: string): Promise<DBMonthlySnapshot | null> {
  const { data } = await supabase
    .from('monthly_snapshots').select('*')
    .eq('user_id', userId).eq('id', id).single()
  return data as DBMonthlySnapshot | null
}

export async function updateSnapshotReflection(id: string, userId: string, reflection: string): Promise<void> {
  await supabase
    .from('monthly_snapshots').update({ user_reflection: reflection })
    .eq('id', id).eq('user_id', userId)
}

// ─── Username System (Phase 3C) ───────────────────────────────────────────────

export type UsernameCheckResult = {
  available: boolean
  reason?: 'taken' | 'reserved' | 'invalid'
}

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/

/** Check if a username is available. Validates format, reserved list, and DB uniqueness. */
export async function checkUsernameAvailable(username: string): Promise<UsernameCheckResult> {
  if (!USERNAME_RE.test(username)) return { available: false, reason: 'invalid' }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) return { available: false, reason: 'reserved' }

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle()

  return data ? { available: false, reason: 'taken' } : { available: true }
}

/** Write a new @handle for the user and stamp username_changed_at. */
export async function setUsername(userId: string, username: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ username, username_changed_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) { console.error('setUsername:', error.message); return false }
  return true
}

/**
 * Returns up to 5 available username suggestions derived from a first name.
 * Makes sequential availability checks — call once on page load, not on every keystroke.
 */
export async function generateUsernameSuggestions(firstName: string): Promise<string[]> {
  const base = firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
  const year = new Date().getFullYear()

  const candidates = [
    `${base}flies`,
    `${base}_vg`,
    `w_${base}`,
    `${base}_${year}`,
    `${base}codes`,
    `${base}_dev`,
    `${base}app`,
    `${base}hq`,
  ].filter(c => USERNAME_RE.test(c))

  const available: string[] = []
  for (const c of candidates) {
    if (available.length >= 5) break
    const res = await checkUsernameAvailable(c)
    if (res.available) available.push(c)
  }

  // Pad with numeric suffixes if fewer than 5 were available
  let attempts = 0
  while (available.length < 5 && attempts < 20) {
    attempts++
    const suffix = Math.floor(Math.random() * 9000 + 1000)
    const c = `${base}${suffix}`
    if (!USERNAME_RE.test(c) || available.includes(c)) continue
    const res = await checkUsernameAvailable(c)
    if (res.available) available.push(c)
  }

  return available.slice(0, 5)
}

// ─── Daily Reflections (Phase 3D) ─────────────────────────────────────────────

export interface DBDailyReflection {
  id: string
  user_id: string
  date: string              // YYYY-MM-DD
  morning_completed: boolean
  evening_completed: boolean
  one_thing_learned: string | null
  tomorrow_intention: string | null
  tasks_completed: number
  hours_logged: number
  mood_score: number | null
  created_at: string
  updated_at: string
}

type DailyReflectionFields = Partial<Pick<
  DBDailyReflection,
  'morning_completed' | 'evening_completed' | 'one_thing_learned' |
  'tomorrow_intention' | 'tasks_completed' | 'hours_logged' | 'mood_score'
>>

/** Upsert a daily reflection row. Safe to call multiple times for the same date. */
export async function upsertDailyReflection(
  userId: string,
  date: string,
  fields: DailyReflectionFields,
): Promise<boolean> {
  const { error } = await supabase
    .from('daily_reflections')
    .upsert(
      { user_id: userId, date, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' },
    )
  if (error) { console.error('upsertDailyReflection:', error.message); return false }
  return true
}

/** Fetch the reflection row for a specific date, or null if none exists. */
export async function getDailyReflectionForDate(
  userId: string,
  date: string,
): Promise<DBDailyReflection | null> {
  const { data } = await supabase
    .from('daily_reflections')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  return data as DBDailyReflection | null
}

/**
 * Returns the current consecutive-day morning streak.
 * Counts backward from today, stopping at the first day where morning_completed = false.
 */
export async function getMorningStreak(userId: string): Promise<number> {
  const { data } = await supabase
    .from('daily_reflections')
    .select('date, morning_completed')
    .eq('user_id', userId)
    .eq('morning_completed', true)
    .order('date', { ascending: false })
    .limit(60)
  if (!data || data.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < data.length; i++) {
    const expected = new Date(today)
    expected.setDate(today.getDate() - i)
    const rowDate = new Date(data[i].date + 'T00:00:00')
    if (rowDate.getTime() !== expected.getTime()) break
    streak++
  }
  return streak
}

// ─── First-Run Tour Gate (Phase 3E) ──────────────────────────────────────────

/**
 * Marks the first-run guided tour as complete for the given user.
 * Call this when the user finishes or skips the tour.
 * Do NOT call this from the Settings replay path — the flag must stay true
 * after first run so the tour never auto-launches again.
 */
export async function markFirstRunComplete(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ first_run_completed: true })
    .eq('id', userId)
  if (error) { console.error('markFirstRunComplete:', error.message); return false }
  return true
}

/**
 * Returns whether the user's first-run tour has been completed.
 */
export async function getFirstRunCompleted(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_run_completed')
    .eq('id', userId)
    .single()
  if (error) { console.error('getFirstRunCompleted:', error.message); return true } // default true on error to avoid loop
  return data?.first_run_completed ?? true
}

/**
 * Returns whether the user is allowed to change their @handle.
 * First-time set (username_changed_at IS NULL) is always allowed.
 * Subsequent changes require 30 days since the last change.
 */
export async function canChangeUsername(
  userId: string
): Promise<{ allowed: boolean; nextChangeDate: Date | null }> {
  const { data } = await supabase
    .from('profiles')
    .select('username_changed_at')
    .eq('id', userId)
    .single()

  if (!data?.username_changed_at) return { allowed: true, nextChangeDate: null }

  const nextChangeDate = new Date(data.username_changed_at)
  nextChangeDate.setDate(nextChangeDate.getDate() + 30)
  const allowed = new Date() >= nextChangeDate
  return { allowed, nextChangeDate: allowed ? null : nextChangeDate }
}
