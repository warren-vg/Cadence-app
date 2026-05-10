// planData.ts — Cadence Source of Truth v1.0
// All logic here is deterministic. No Math.random(). No hardcoded scores.
// Momentum score uses the 4-component weighted formula from the spec.

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
  weeklyCapacityHours: number = CONSTANTS.DEFAULT_WEEKLY_CAPACITY_HOURS
): number {
  return weeklyCapacityHours - getUsedCapacity(goals)
}

export function getCapacityUsedPct(
  goals: GoalForCapacity[],
  weeklyCapacityHours: number = CONSTANTS.DEFAULT_WEEKLY_CAPACITY_HOURS
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
  goals: Array<{ status: string; progress: number; estimatedWeeklyHours?: number | null }>,
  weekTasks: Array<{ completed: boolean }>,
  streak: number,
  weeklyCapacityHours: number = CONSTANTS.DEFAULT_WEEKLY_CAPACITY_HOURS
): number {
  const C1 = weekTasks.length > 0
    ? Math.round((weekTasks.filter(t => t.completed).length / weekTasks.length) * 100)
    : 0

  const activeGoals = goals.filter(g => g.status === 'active')
  const C2          = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length)
    : 0

  const C3 = Math.min(streak, CONSTANTS.STREAK_MAX_FOR_NORMALIZATION)
           / CONSTANTS.STREAK_MAX_FOR_NORMALIZATION * 100

  const capPct = getCapacityUsedPct(goals, weeklyCapacityHours)
  const C4     = activeGoals.length === 0
    ? 0
    : capPct <= 100
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
