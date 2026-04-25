// lib/db.ts — Cadence Centralised Data Access Layer
// All Supabase table operations go here. Pages import from this module.

import { supabase } from '@/lib/supabase'
import { toDateStr, addDays, timeToMinutes } from '@/lib/planData'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface DBTask {
  id: string
  user_id: string
  text: string
  date: string            // YYYY-MM-DD
  scheduled_time: string  // HH:MM
  duration: number        // hours
  category: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
  completed_at?: string | null
  goal_id?: string | null
  project_id?: string | null
  created_at?: string
}

export interface DBScheduleItem {
  id: string
  user_id: string
  title: string
  date: string
  start_time: string
  duration: number   // minutes
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
  linked_goal_id?: string | null
  created_at?: string
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
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('scheduled_time', { ascending: true })
  return (data ?? []) as DBTask[]
}

export async function getTasksForWeek(userId: string, monday: Date): Promise<DBTask[]> {
  const start = toDateStr(monday)
  const end   = toDateStr(addDays(monday, 6))
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
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

  const { data: goal } = await supabase
    .from('goals')
    .select('milestones, progress')
    .eq('id', goalId)
    .single()

  if (!goal) return null

  const milestones: { completed: boolean }[] = goal.milestones || []
  if (milestones.length > 0) return goal.progress as number

  const tasks: { completed: boolean }[] = allTasks || []
  if (tasks.length === 0) return goal.progress as number

  const newProgress = Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
  await supabase.from('goals').update({ progress: newProgress }).eq('id', goalId)
  return newProgress
}

// ─── Schedule CRUD ────────────────────────────────────────────────────────────

export async function getScheduleForDate(userId: string, dateStr: string): Promise<DBScheduleItem[]> {
  const { data } = await supabase
    .from('schedule_items')
    .select('*')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .order('start_time', { ascending: true })
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
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as DBProject[]
}

export async function getProjectById(id: string): Promise<DBProject | null> {
  const { data } = await supabase.from('projects').select('*').eq('id', id).single()
  return (data ?? null) as DBProject | null
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
  const { data } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })
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
  await supabase.from('project_tasks').update({ completed: !currentCompleted }).eq('id', taskId)

  const { data: allTasks } = await supabase
    .from('project_tasks')
    .select('completed')
    .eq('project_id', projectId)

  const tasks: { completed: boolean }[] = allTasks || []
  const newProgress = tasks.length > 0
    ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
    : 0

  await supabase.from('projects').update({ progress: newProgress }).eq('id', projectId)

  const { data: project } = await supabase
    .from('projects')
    .select('linked_goal_id')
    .eq('id', projectId)
    .single()

  if (project?.linked_goal_id) {
    await supabase
      .from('goals')
      .update({ progress: newProgress })
      .eq('id', project.linked_goal_id)
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
  const { data } = await supabase
    .from('profiles')
    .select('priority_stack')
    .eq('id', userId)
    .single()
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
  const { data } = await supabase
    .from('profiles')
    .select('energy_blocks')
    .eq('id', userId)
    .single()
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
  targetUsername: string
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
    .insert({ user_id: userId, friend_id: targetUser.id, status: 'pending' })

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
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase
    .from('friend_actions')
    .insert({ actor_id: actorId, target_id: targetId, action_type: actionType, date: today })

  if (error) {
    if (error.code === '23505') {
      return { success: false, onCooldown: true, error: `You already ${actionType === 'hype' ? 'hyped' : 'nudged'} this person today` }
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
  const { data } = await supabase
    .from('goals')
    .select('id, text, category, progress, status')
    .eq('user_id', friendId)
    .eq('status', 'active')
    .order('priority', { ascending: true })
    .limit(4)
  return data ?? []
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
  return taskCategory === 'Career'
}

export function findBestSlot(
  task: { energyType: string; category: string; duration: number },
  date: Date,
  energyBlocks: Record<string, string>,
  existingTasks: DBTask[],
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
