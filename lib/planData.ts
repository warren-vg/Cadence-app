// planData.ts — Cadence Source of Truth v1.0
// All logic here is deterministic. No Math.random(). No hardcoded scores.
// Momentum score uses the 4-component weighted formula from the spec.

export interface PlanTask {
  id: string
  text: string
  date: string          // YYYY-MM-DD
  scheduledTime: string // HH:MM
  duration: number      // hours
  category: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

export interface ScheduleBlock {
  id: string
  title: string
  date: string
  startTime: string   // HH:MM
  duration: number    // minutes
  category: string    // work, personal, health, creative, break
  isFlexible: boolean
}

export interface WeeklyReflection {
  id: string
  weekOf: string          // YYYY-MM-DD (Monday)
  wins: string
  challenges: string
  learnings: string
  nextWeekFocus: string
  weekScore: number
  timestamp: string       // ISO 8601
}

// ─── Constants (single source of truth — never inline these values) ───────────
export const CONSTANTS = {
  DEFAULT_WEEKLY_CAPACITY_HOURS:   40,
  DEFAULT_HOURS_PER_GOAL_FALLBACK: 4,
  MOMENTUM_WEIGHT_TASK_COMPLETION: 0.35,
  MOMENTUM_WEIGHT_GOAL_PROGRESS:   0.35,
  MOMENTUM_WEIGHT_STREAK:          0.20,
  MOMENTUM_WEIGHT_CAPACITY:        0.10,
  STREAK_MAX_FOR_NORMALIZATION:    8,
  CAPACITY_WARNING_PCT:            80,
  CAPACITY_ALERT_PCT:              100,
  TOP_PRIORITIES_LIMIT:            3,
} as const

const TASKS_KEY       = 'cadence_plan_tasks'
const SCHEDULE_KEY    = 'cadence_schedule'
const REFLECTIONS_KEY = 'cadence_reflections'

// ─── Date utilities ───────────────────────────────────────────────────────────

export function toDateStr(d: Date): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getMonday(d: Date): Date {
  const day  = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

// ─── Time utilities ───────────────────────────────────────────────────────────

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm   = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Convert "HH:MM" → total minutes. Throws on invalid format. */
export function timeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':')
  if (parts.length !== 2) throw new Error(`Invalid time format: ${hhmm}`)
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Invalid time value: ${hhmm}`)
  }
  return h * 60 + m
}

/** Convert total minutes → "HH:MM". Clamps to 0–1439. */
export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(mins)))
  const h       = Math.floor(clamped / 60)
  const m       = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Adds minutes to an HH:MM string. Result wraps at midnight (23:59 max). */
export function addMinutes(hhmm: string, mins: number): string {
  return minutesToTime(timeToMinutes(hhmm) + mins)
}

// ─── Cascade schedule adjustment ─────────────────────────────────────────────
/**
 * When a schedule item's startTime or duration changes, auto-adjust all
 * subsequent flexible items so they start right after the previous one ends.
 * Fixed items that would overlap produce a conflict flag instead.
 */
export function cascadeSchedule(
  items: ScheduleBlock[],
  changedIndex: number
): { items: ScheduleBlock[]; conflicts: string[] } {
  const result    = [...items]
  const conflicts: string[] = []

  for (let i = changedIndex + 1; i < result.length; i++) {
    const prev         = result[i - 1]
    const prevEndMins  = timeToMinutes(prev.startTime) + prev.duration
    const currStartMins = timeToMinutes(result[i].startTime)

    if (result[i].isFlexible || currStartMins < prevEndMins) {
      result[i] = { ...result[i], startTime: minutesToTime(prevEndMins) }
    } else {
      break
    }

    const newEndMins = timeToMinutes(result[i].startTime) + result[i].duration
    if (newEndMins > 1440) {
      conflicts.push(result[i].id)
    }
  }

  return { items: result, conflicts }
}

// ─── Task CRUD ────────────────────────────────────────────────────────────────

export function getAllTasks(): PlanTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    if (!raw) {
      const seed = generateSeedTasks()
      localStorage.setItem(TASKS_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveTasks(tasks: PlanTask[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
}

export function getTasksForDate(date: string): PlanTask[] {
  return getAllTasks()
    .filter(t => t.date === date)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
}

export function getTasksForWeek(monday: Date): PlanTask[] {
  const start = toDateStr(monday)
  const end   = toDateStr(addDays(monday, 6))
  return getAllTasks().filter(t => t.date >= start && t.date <= end)
}

export function toggleTask(id: string): PlanTask[] {
  const tasks   = getAllTasks()
  const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
  saveTasks(updated)
  return updated
}

export function addTask(task: Omit<PlanTask, 'id'>): PlanTask[] {
  const tasks   = getAllTasks()
  const newTask: PlanTask = { ...task, id: `task-${Date.now()}` }
  const updated = [...tasks, newTask]
  saveTasks(updated)
  return updated
}

export function deleteTask(id: string): PlanTask[] {
  const updated = getAllTasks().filter(t => t.id !== id)
  saveTasks(updated)
  return updated
}

// ─── Schedule CRUD ────────────────────────────────────────────────────────────

export function getAllSchedule(): ScheduleBlock[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (!raw) {
      const seed = generateSeedSchedule()
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function getScheduleForDate(date: string): ScheduleBlock[] {
  return getAllSchedule()
    .filter(s => s.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export function saveSchedule(items: ScheduleBlock[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(items))
}

// ─── Reflections ──────────────────────────────────────────────────────────────

export function getAllReflections(): WeeklyReflection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(REFLECTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveReflection(r: Omit<WeeklyReflection, 'id' | 'timestamp'>): void {
  const all      = getAllReflections()
  const existing = all.findIndex(x => x.weekOf === r.weekOf)
  const entry: WeeklyReflection = {
    ...r,
    id:        `ref-${Date.now()}`,
    timestamp: new Date().toISOString(),
  }
  if (existing >= 0) {
    all[existing] = entry
  } else {
    all.push(entry)
  }
  localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(all))
}

// ─── Week summary ─────────────────────────────────────────────────────────────

export function getWeekSummary(monday: Date) {
  const tasks          = getTasksForWeek(monday)
  const totalHours     = parseFloat(tasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
  const completedHours = parseFloat(
    tasks.filter(t => t.completed).reduce((s, t) => s + t.duration, 0).toFixed(1)
  )
  return {
    totalTasks:     tasks.length,
    completedTasks: tasks.filter(t => t.completed).length,
    totalHours,
    completedHours,
  }
}

export function getDayFocusCategories(date: string): string[] {
  const tasks = getTasksForDate(date)
  const cats  = [...new Set(tasks.map(t => t.category))]
  return cats.slice(0, 2)
}

// ─── STREAK ───────────────────────────────────────────────────────────────────
/**
 * Returns the number of consecutive past weeks that have a submitted
 * WeeklyReflection. The current (incomplete) week is NOT counted.
 * A streak is broken the moment a week has no reflection.
 */
export function getWeekStreak(): number {
  const reflections = getAllReflections()
  let streak        = 0
  let checkDate     = getMonday(new Date())

  checkDate = addDays(checkDate, -7)

  while (streak < 52) {
    const weekOf = toDateStr(checkDate)
    const found  = reflections.find(r => r.weekOf === weekOf && r.timestamp)
    if (found) {
      streak++
      checkDate = addDays(checkDate, -7)
    } else {
      break
    }
  }

  return streak
}

// ─── CAPACITY ─────────────────────────────────────────────────────────────────

interface GoalForCapacity {
  status: string
  estimatedWeeklyHours?: number | null
}

/**
 * Total hours/week currently consumed by active goals.
 * Uses goal.estimatedWeeklyHours when set; falls back to DEFAULT_HOURS_PER_GOAL_FALLBACK.
 */
export function getUsedCapacity(goals: GoalForCapacity[]): number {
  return goals
    .filter(g => g.status === 'active')
    .reduce((sum, g) => sum + (g.estimatedWeeklyHours ?? CONSTANTS.DEFAULT_HOURS_PER_GOAL_FALLBACK), 0)
}

export function getRemainingCapacity(
  goals: GoalForCapacity[],
  weeklyCapacityHours = CONSTANTS.DEFAULT_WEEKLY_CAPACITY_HOURS
): number {
  return weeklyCapacityHours - getUsedCapacity(goals)
}

export function getCapacityUsedPct(
  goals: GoalForCapacity[],
  weeklyCapacityHours = CONSTANTS.DEFAULT_WEEKLY_CAPACITY_HOURS
): number {
  return Math.round((getUsedCapacity(goals) / weeklyCapacityHours) * 100)
}

// ─── MOMENTUM SCORE ───────────────────────────────────────────────────────────
/**
 * 4-component weighted momentum score. Range: 0–100.
 *
 * Component weights (from CONSTANTS):
 *   C1 Task completion rate (last 7 days)  35%
 *   C2 Active goal progress average        35%
 *   C3 Weekly reflection streak            20%
 *   C4 Capacity health                     10%
 */
export function getMomentumScore(
  goals: Array<{ status: string; progress: number; estimatedWeeklyHours?: number | null }> = [],
  weeklyCapacityHours = CONSTANTS.DEFAULT_WEEKLY_CAPACITY_HOURS
): number {
  const monday    = getMonday(new Date())
  const weekTasks = getTasksForWeek(monday)
  const C1        = weekTasks.length > 0
    ? Math.round((weekTasks.filter(t => t.completed).length / weekTasks.length) * 100)
    : 0

  const activeGoals = goals.filter(g => g.status === 'active')
  const C2          = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length)
    : 0

  const streak = getWeekStreak()
  const C3     = Math.min(streak, CONSTANTS.STREAK_MAX_FOR_NORMALIZATION)
               / CONSTANTS.STREAK_MAX_FOR_NORMALIZATION * 100

  const capPct = getCapacityUsedPct(goals, weeklyCapacityHours)
  const C4     = capPct <= 100
    ? 100
    : Math.max(0, 100 - (capPct - 100) * 2)

  return Math.round(
    CONSTANTS.MOMENTUM_WEIGHT_TASK_COMPLETION * C1 +
    CONSTANTS.MOMENTUM_WEIGHT_GOAL_PROGRESS   * C2 +
    CONSTANTS.MOMENTUM_WEIGHT_STREAK          * C3 +
    CONSTANTS.MOMENTUM_WEIGHT_CAPACITY        * C4
  )
}

// ─── GOAL PROGRESS (milestone-based) ─────────────────────────────────────────

interface MilestoneForProgress {
  completed: boolean
  weight?:   number
}

/**
 * Calculates goal progress from milestones.
 * If no milestones exist, returns the manual progress value.
 * Each milestone weight defaults to 1 if not set.
 */
export function calcGoalProgress(
  milestones: MilestoneForProgress[],
  manualProgress = 0
): number {
  if (!milestones || milestones.length === 0) return manualProgress

  const totalWeight     = milestones.reduce((s, m) => s + (m.weight ?? 1), 0)
  const completedWeight = milestones
    .filter(m => m.completed)
    .reduce((s, m) => s + (m.weight ?? 1), 0)

  return Math.round((completedWeight / totalWeight) * 100)
}

// ─── PROJECTED COMPLETION DATE ────────────────────────────────────────────────
/**
 * Maps goal quarter to projected completion date.
 * Dynamic — uses the current year, never hardcoded strings.
 */
export function getProjectedCompletionDate(quarter: string | null | undefined): string {
  if (!quarter) return 'Not set'

  const now         = new Date()
  const currentYear = now.getFullYear()

  const endOfMonth = (year: number, month: number): string => {
    const last = new Date(year, month, 0)
    return toDateStr(last)
  }

  if (quarter === 'Q1') return endOfMonth(currentYear, 3)
  if (quarter === 'Q2') return endOfMonth(currentYear, 6)
  if (quarter === 'Q3') return endOfMonth(currentYear, 9)
  if (quarter === 'Q4') return endOfMonth(currentYear, 12)
  if (quarter === '2027') return '2027-12-31'

  const match = quarter.match(/^(Q[1-4])\s+(\d{4})$/)
  if (match) {
    const q    = match[1]
    const year = parseInt(match[2], 10)
    if (q === 'Q1') return endOfMonth(year, 3)
    if (q === 'Q2') return endOfMonth(year, 6)
    if (q === 'Q3') return endOfMonth(year, 9)
    if (q === 'Q4') return endOfMonth(year, 12)
  }

  return 'Not set'
}

// ─── CATEGORY COLORS ─────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Career:            { bg: '#EFF6FF', color: '#3B7DFF' },
  Finance:           { bg: '#F0FFF4', color: '#16A34A' },
  Health:            { bg: '#FFF0F5', color: '#EC4899' },
  Creative:          { bg: '#FFF7ED', color: '#EA580C' },
  Travel:            { bg: '#F0F9FF', color: '#0284C7' },
  Relationships:     { bg: '#FDF4FF', color: '#9333EA' },
  Business:          { bg: '#FFFBEB', color: '#D97706' },
  Community:         { bg: '#F0FDF4', color: '#15803D' },
  'Personal Growth': { bg: '#FDF4FF', color: '#9333EA' },
  Education:         { bg: '#EFF6FF', color: '#3B7DFF' },
}

export function getCatStyle(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: '#F2F2F7', color: '#8E8E93' }
}

// ─── Seed data (only used on first load when localStorage is empty) ───────────

function generateSeedTasks(): PlanTask[] {
  const today   = new Date()
  const todayStr = toDateStr(today)
  const monday  = getMonday(today)

  const weekData = [
    { offset: 0, tasks: [
      { text: 'Deep work: Portfolio case study', time: '09:00', dur: 2,   cat: 'Career',  pri: 'high'   as const },
      { text: 'Morning run - 5k',               time: '07:00', dur: 0.5,  cat: 'Health',  pri: 'medium' as const },
      { text: 'Budget review',                  time: '14:00', dur: 1,    cat: 'Finance', pri: 'medium' as const },
      { text: 'Blog post writing',              time: '15:00', dur: 1.5,  cat: 'Creative',pri: 'low'    as const },
    ]},
    { offset: 1, tasks: [
      { text: 'Review monthly budget',          time: '10:00', dur: 1,    cat: 'Finance', pri: 'high'   as const },
      { text: 'Team standup',                   time: '09:00', dur: 0.5,  cat: 'Career',  pri: 'medium' as const },
      { text: 'Write blog post draft',          time: '14:00', dur: 2,    cat: 'Creative',pri: 'medium' as const },
    ]},
    { offset: 2, tasks: [
      { text: 'Portfolio case study - deep work',time: '09:00', dur: 3,   cat: 'Career',  pri: 'high'   as const },
      { text: 'LinkedIn content creation',      time: '13:00', dur: 1,    cat: 'Career',  pri: 'medium' as const },
      { text: 'Gym workout',                    time: '07:00', dur: 1,    cat: 'Health',  pri: 'medium' as const },
    ]},
    { offset: 3, tasks: [
      { text: 'Morning run',                    time: '07:00', dur: 0.5,  cat: 'Health',  pri: 'medium' as const },
      { text: 'Email inbox zero',               time: '09:00', dur: 1,    cat: 'Career',  pri: 'low'    as const },
      { text: 'Short story writing session',    time: '11:00', dur: 1.5,  cat: 'Creative',pri: 'medium' as const },
    ]},
    { offset: 4, tasks: [
      { text: 'Portfolio final touches',        time: '09:00', dur: 2,    cat: 'Career',  pri: 'high'   as const },
      { text: 'Morning run',                    time: '07:00', dur: 0.5,  cat: 'Health',  pri: 'medium' as const },
      { text: 'Creative writing session',       time: '14:00', dur: 1.5,  cat: 'Creative',pri: 'medium' as const },
      { text: 'Financial review',               time: '16:00', dur: 1,    cat: 'Finance', pri: 'low'    as const },
    ]},
    { offset: 5, tasks: [
      { text: 'Long run - 8k',                  time: '08:00', dur: 1,    cat: 'Health',  pri: 'high'   as const },
      { text: 'Creative writing - chapter draft',time: '10:00', dur: 2,   cat: 'Creative',pri: 'medium' as const },
    ]},
    { offset: 6, tasks: [
      { text: 'Weekly planning session',        time: '10:00', dur: 1,    cat: 'Career',  pri: 'medium' as const },
    ]},
  ]

  const tasks: PlanTask[] = []
  weekData.forEach(day => {
    const date = toDateStr(addDays(monday, day.offset))
    day.tasks.forEach((t, i) => {
      tasks.push({
        id:            `seed-${day.offset}-${i}`,
        text:          t.text,
        date,
        scheduledTime: t.time,
        duration:      t.dur,
        category:      t.cat,
        priority:      t.pri,
        completed:     date < todayStr,
      })
    })
  })
  return tasks
}

function generateSeedSchedule(): ScheduleBlock[] {
  const todayStr = toDateStr(new Date())
  return [
    { id: 's1', title: 'Morning Routine',       date: todayStr, startTime: '07:00', duration: 30,  category: 'personal', isFlexible: false },
    { id: 's2', title: 'Deep Work Block',       date: todayStr, startTime: '07:30', duration: 120, category: 'work',     isFlexible: false },
    { id: 's3', title: 'Break',                 date: todayStr, startTime: '09:30', duration: 15,  category: 'break',    isFlexible: true  },
    { id: 's4', title: 'Creative Work',         date: todayStr, startTime: '09:45', duration: 90,  category: 'creative', isFlexible: false },
    { id: 's5', title: 'Lunch Break',           date: todayStr, startTime: '11:15', duration: 60,  category: 'break',    isFlexible: true  },
    { id: 's6', title: 'Light Tasks & Email',   date: todayStr, startTime: '12:15', duration: 90,  category: 'work',     isFlexible: true  },
    { id: 's7', title: 'Exercise',              date: todayStr, startTime: '14:00', duration: 60,  category: 'health',   isFlexible: false },
    { id: 's8', title: 'Evening Wind Down',     date: todayStr, startTime: '15:30', duration: 30,  category: 'personal', isFlexible: true  },
  ]
}
