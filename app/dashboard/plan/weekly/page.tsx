'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toDateStr, getMonday, addDays, getCatStyle, CONSTANTS } from '@/lib/planData'
import {
  getTasksForWeek, createTask, syncRecurringInstancesForWeek,
  DEFAULT_WORK_SCHEDULE,
  type DBTask, type WorkSchedule,
} from '@/lib/db'
import { generateTasksForGoal } from '@/lib/goalTemplates'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/app/dashboard/components/EmptyState'

interface GoalRow {
  id: string
  text: string
  category: string
  progress: number
  priority: number
  estimated_weekly_hours?: number | null
  project_id?: string | null
}

type CapacityDay = { hours: number; time_of_day: string }
type CapacitySchedule = Record<string, CapacityDay>
const DAY_JS_TO_KEY = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

export default function WeeklyPlannerPage() {
  const router = useRouter()
  const [goals, setGoals]           = useState<GoalRow[]>([])
  const [weekTasks, setWeekTasks]   = useState<DBTask[]>([])
  const [mounted, setMounted]       = useState(false)
  const [addedGoalIds, setAddedGoalIds] = useState<Set<string>>(new Set())
  const [building, setBuilding]     = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  const [availableHours, setAvailableHours]     = useState<number>(CONSTANTS.DEFAULT_WEEKLY_CAPACITY_HOURS)
  const [energyBlocks, setEnergyBlocks]         = useState<Record<string, string>>({})
  const [workSchedule, setWorkSchedule]         = useState<WorkSchedule>(DEFAULT_WORK_SCHEDULE)
  const [capacitySchedule, setCapacitySchedule] = useState<CapacitySchedule | null>(null)

  const today  = new Date()
  const monday = getMonday(today)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [{ data: goalsData }, { data: profileData }, tasks] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'active').order('priority', { ascending: true }),
        supabase.from('profiles').select('weekly_capacity, energy_blocks, work_schedule, capacity_schedule').eq('id', user.id).single(),
        getTasksForWeek(user.id, monday),
      ])

      setGoals(goalsData || [])
      setWeekTasks(tasks)
      if (profileData) {
        if (profileData.weekly_capacity)   setAvailableHours(profileData.weekly_capacity)
        else if (profileData.capacity_schedule) {
          const total = Object.values(profileData.capacity_schedule as CapacitySchedule)
            .reduce((s, d) => s + d.hours, 0)
          if (total > 0) setAvailableHours(total)
        }
        if (profileData.energy_blocks)    setEnergyBlocks(profileData.energy_blocks)
        if (profileData.work_schedule)    setWorkSchedule(profileData.work_schedule)
        if (profileData.capacity_schedule) setCapacitySchedule(profileData.capacity_schedule as CapacitySchedule)
      }
    }
    load()
  }, [])

  if (!mounted) return null

  const manualTasks    = weekTasks.filter(t => t.source !== 'auto')
  const plannedHours   = parseFloat(weekTasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
  const manualHours    = parseFloat(manualTasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
  const remainingHours = parseFloat(Math.max(0, availableHours - plannedHours).toFixed(1))
  const progressPct    = Math.min(100, Math.round((plannedHours / availableHours) * 100))
  const atCapacity       = remainingHours <= 0
  const hasAutoTasks     = weekTasks.some(t => t.source === 'auto')
  const hasManualTasks   = manualTasks.length > 0
  const hasExistingTasks = weekTasks.length > 0

  const weekLabel = (() => {
    const end = addDays(monday, 6)
    return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  })()

  const suggestedTasks = goals.slice(0, 3).map(goal => {
    const alreadyScheduled = weekTasks.map(t => ({ date: t.date, scheduled_time: t.scheduled_time }))
    const first = generateTasksForGoal(goal, energyBlocks, workSchedule, today, alreadyScheduled)[0]
    return { goal, task: first ?? null }
  }).filter((s): s is { goal: GoalRow; task: NonNullable<typeof s.task> } => s.task !== null)

  const handleAddSuggested = async (goal: GoalRow) => {
    if (!userId || addedGoalIds.has(goal.id)) return
    const alreadyScheduled = weekTasks.map(t => ({ date: t.date, scheduled_time: t.scheduled_time }))
    const generated = generateTasksForGoal(goal, energyBlocks, workSchedule, today, alreadyScheduled)
    const first = generated[0]
    if (!first) return
    const created = await createTask(userId, { ...first, source: 'manual' })

    if (created) {
      setWeekTasks(prev => [...prev, created])
      setAddedGoalIds(prev => new Set([...prev, goal.id]))
    }
  }

  const handleBuildWeek = async () => {
    if (!userId || goals.length === 0 || atCapacity) return
    if (hasAutoTasks && !confirm('This will replace your auto-scheduled tasks for this week. Your manual tasks will be kept. Continue?')) return
    setBuilding(true)

    const weekStart = toDateStr(monday)
    const weekEnd   = toDateStr(addDays(monday, 6))

    // Delete only previously auto-built tasks — manual tasks survive untouched
    await supabase.from('tasks')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'auto')
      .gte('date', weekStart)
      .lte('date', weekEnd)

    // Committed slots passed to generateTasksForGoal to prevent double-booking.
    // Rebuilt per goal by spreading manual tasks + tasks queued so far.
    const committed: { date: string; scheduled_time: string }[] = manualTasks.map(t => ({
      date: t.date, scheduled_time: t.scheduled_time,
    }))

    let budgetRemaining = Math.max(0, availableHours - manualHours)
    const toInsert: Omit<DBTask, 'id' | 'user_id' | 'completed_at' | 'created_at'>[] = []

    // Per-day capacity budget: initialise from capacity_schedule, then subtract manual tasks
    const dayBudgets: Record<string, number> = {}
    if (capacitySchedule) {
      for (let di = 0; di <= 6; di++) {
        const d       = addDays(monday, di)
        const dateStr = toDateStr(d)
        const key     = DAY_JS_TO_KEY[d.getDay()]
        dayBudgets[dateStr] = capacitySchedule[key]?.hours ?? Infinity
      }
      manualTasks.forEach(t => {
        if (t.date && dayBudgets[t.date] !== undefined && isFinite(dayBudgets[t.date])) {
          dayBudgets[t.date] = Math.max(0, dayBudgets[t.date] - t.duration)
        }
      })
    }

    for (const goal of goals) {
      if (budgetRemaining < 0.5) break

      const generated = generateTasksForGoal(
        goal,
        energyBlocks,
        workSchedule,
        monday,
        [...committed, ...toInsert.map(t => ({ date: t.date, scheduled_time: t.scheduled_time }))],
      )

      for (const t of generated) {
        if (budgetRemaining < 0.5) break
        if (t.date < weekStart || t.date > weekEnd) continue
        // Skip days that have hit their per-day capacity cap
        if (capacitySchedule && dayBudgets[t.date] !== undefined && dayBudgets[t.date] < 0.25) continue
        toInsert.push({ ...t, source: 'auto' })
        budgetRemaining -= t.duration
        if (capacitySchedule && dayBudgets[t.date] !== undefined) {
          dayBudgets[t.date] = Math.max(0, dayBudgets[t.date] - t.duration)
        }
      }
    }

    if (toInsert.length > 0) {
      await supabase
        .from('tasks')
        .insert(toInsert.map(t => ({ ...t, user_id: userId })))
    }

    // Ensure recurring task instances exist for this week
    await syncRecurringInstancesForWeek(userId, monday)

    // Reload the full week so both auto and recurring tasks are reflected
    const freshTasks = await getTasksForWeek(userId, monday)
    setWeekTasks(freshTasks)
    setBuilding(false)
    router.push('/dashboard/plan')
  }

  const handleResetWeek = async () => {
    if (!userId || !confirm('Reset all tasks for this week?')) return
    const weekStart = toDateStr(monday)
    const weekEnd   = toDateStr(addDays(monday, 6))
    await supabase.from('tasks').delete().eq('user_id', userId).gte('date', weekStart).lte('date', weekEnd)
    setWeekTasks([])
    router.refresh()
  }

  return (
    <div style={{ padding: '0 0 16px' }}>

      {/* Header */}
      <div style={{ padding: '56px 16px 16px', background: 'var(--c-surface)', borderBottom: '0.5px solid var(--c-border)' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Home
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Weekly Planner</h1>
        <p style={{ fontSize: 14, color: 'var(--c-text-2)', margin: '3px 0 0' }}>Week of {weekLabel}</p>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Available Hours */}
        <div style={{ background: atCapacity ? '#FFF7ED' : '#F0FFF4', borderRadius: 16, padding: '18px', border: `1px solid ${atCapacity ? '#FED7AA' : '#BBF7D0'}`, marginBottom: 14 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 4px' }}>Available Hours</p>
          <p style={{ fontSize: 13, color: atCapacity ? '#EA580C' : '#16A34A', margin: '0 0 12px' }}>
            {plannedHours} of {availableHours}h planned · {atCapacity ? 'week is full' : `${remainingHours}h remaining`}
          </p>
          <div style={{ background: atCapacity ? '#FED7AA' : '#BBF7D0', borderRadius: 6, height: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: atCapacity ? '#EA580C' : '#16A34A', borderRadius: 6, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Goal Priorities — each goal shown alongside its suggested task */}
        {goals.length === 0 ? (
          <EmptyState
            icon="🎯"
            iconBg="#EFF6FF"
            title="No active goals"
            body="Add goals first to get personalized task suggestions for your week."
            ctaLabel="Go to Goals"
            onCta={() => router.push('/dashboard/goals')}
          />
        ) : (
          <div style={{ background: 'var(--c-surface)', borderRadius: 16, padding: '18px', border: '0.5px solid var(--c-border)', marginBottom: 14 }}>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 2px' }}>Goal Priorities</p>
              <p style={{ fontSize: 12, color: 'var(--c-text-2)', margin: 0 }}>Suggested task for each goal — tap Add to schedule</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {goals.slice(0, 3).map((goal, i) => {
                const catStyle   = getCatStyle(goal.category)
                const hrs        = goal.estimated_weekly_hours || CONSTANTS.DEFAULT_HOURS_PER_GOAL_FALLBACK
                const suggestion = suggestedTasks.find(s => s.goal.id === goal.id)
                const added      = addedGoalIds.has(goal.id)
                const isLast     = i === Math.min(goals.length, 3) - 1
                return (
                  <div key={goal.id} style={{
                    paddingTop: i > 0 ? 14 : 0,
                    paddingBottom: isLast ? 0 : 14,
                    borderBottom: isLast ? 'none' : '0.5px solid var(--c-border-sub)',
                  }}>
                    {/* Goal label */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, background: catStyle.bg, color: catStyle.color, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.2 }}>
                        Goal
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--c-text-2)' }}>{goal.category} · {hrs}h/wk</span>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)', margin: '0 0 8px', lineHeight: 1.35 }}>
                      {goal.text}
                    </p>

                    {/* Suggested task for this goal */}
                    {suggestion ? (
                      <div style={{
                        background: 'var(--c-surface-2)', borderRadius: 10, padding: '10px 12px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: 'var(--c-text-mid)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {suggestion.task.text.length > 44 ? suggestion.task.text.slice(0, 44) + '…' : suggestion.task.text}
                          </p>
                          <span style={{ fontSize: 11, color: 'var(--c-text-2)' }}>
                            {suggestion.task.duration < 1 ? `${Math.round(suggestion.task.duration * 60)}m` : `${suggestion.task.duration}h`}
                          </span>
                        </div>
                        <button
                          onClick={() => handleAddSuggested(goal)}
                          disabled={added}
                          style={{
                            background: added ? '#F0FFF4' : '#3B7DFF', border: 'none',
                            cursor: added ? 'default' : 'pointer',
                            fontSize: 13, color: added ? '#16A34A' : 'white',
                            fontFamily: 'inherit', fontWeight: 600,
                            padding: '6px 14px', borderRadius: 8, flexShrink: 0,
                          }}
                        >
                          {added ? '✓ Added' : 'Add'}
                        </button>
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--c-text-3)', margin: 0 }}>No suggestion available</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Build Week */}
        {(() => {
          const disabled  = building || goals.length === 0 || atCapacity
          const bgColor   = goals.length === 0 || atCapacity ? '#D1D1D6' : '#3B7DFF'
          const label     = building           ? 'Building…'
            : goals.length === 0               ? 'Add Goals to Build Week'
            : atCapacity                       ? 'Week is Full'
            : hasAutoTasks                     ? 'Rebuild Week'
            : hasManualTasks                   ? 'Fill Remaining Week'
            : 'Build Week'
          const helperText = atCapacity
            ? 'Reset Week to free up capacity before rebuilding.'
            : hasExistingTasks && goals.length > 0
            ? `${remainingHours}h available · your manual tasks will be kept`
            : null
          return (
            <>
              <button
                data-tour="plan-build-week"
                onClick={handleBuildWeek}
                disabled={disabled}
                style={{
                  width: '100%', padding: '15px', borderRadius: 14, marginBottom: helperText ? 6 : 10,
                  background: bgColor, border: 'none', color: 'white',
                  fontSize: 15, fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: building ? 0.7 : 1,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {label}
              </button>
              {helperText && (
                <p style={{ fontSize: 12, color: atCapacity ? '#EA580C' : 'var(--c-text-2)', textAlign: 'center', margin: '0 0 10px' }}>
                  {helperText}
                </p>
              )}
            </>
          )
        })()}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleResetWeek}
            style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'var(--c-surface)', border: '0.5px solid var(--c-border)', color: 'var(--c-text-1)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Reset Week
          </button>
          <button
            onClick={() => router.push('/dashboard/plan/daily')}
            style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'var(--c-surface)', border: '0.5px solid var(--c-border)', color: 'var(--c-text-1)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            View Daily
          </button>
        </div>
      </div>
    </div>
  )
}
