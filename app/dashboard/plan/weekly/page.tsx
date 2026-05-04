'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toDateStr, getMonday, addDays, getCatStyle } from '@/lib/planData'
import {
  getTasksForWeek, createTask, findBestSlot,
  DEFAULT_WORK_SCHEDULE,
  type DBTask, type WorkSchedule,
} from '@/lib/db'
import { supabase } from '@/lib/supabase'

interface GoalRow {
  id: string
  text: string
  category: string
  progress: number
  priority: number
  estimated_weekly_hours?: number | null
}

function categoryToEnergyType(category: string): string {
  if (['Career', 'Finance', 'Business'].includes(category)) return 'deep'
  if (['Health', 'Relationships', 'Community'].includes(category)) return 'social'
  if (category === 'Creative') return 'creative'
  if (category === 'Recovery') return 'recovery'
  return 'deep'
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function WeeklyPlannerPage() {
  const router = useRouter()
  const [goals, setGoals]           = useState<GoalRow[]>([])
  const [weekTasks, setWeekTasks]   = useState<DBTask[]>([])
  const [mounted, setMounted]       = useState(false)
  const [addedGoalIds, setAddedGoalIds] = useState<Set<string>>(new Set())
  const [building, setBuilding]     = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  const [availableHours, setAvailableHours] = useState(40)
  const [energyBlocks, setEnergyBlocks]     = useState<Record<string, string>>({})
  const [workSchedule, setWorkSchedule]     = useState<WorkSchedule>(DEFAULT_WORK_SCHEDULE)

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
        supabase.from('profiles').select('weekly_capacity, energy_blocks, work_schedule').eq('id', user.id).single(),
        getTasksForWeek(user.id, monday),
      ])

      setGoals(goalsData || [])
      setWeekTasks(tasks)
      if (profileData) {
        if (profileData.weekly_capacity) setAvailableHours(profileData.weekly_capacity)
        if (profileData.energy_blocks)   setEnergyBlocks(profileData.energy_blocks)
        if (profileData.work_schedule)   setWorkSchedule(profileData.work_schedule)
      }
    }
    load()
  }, [])

  if (!mounted) return null

  const plannedHours = parseFloat(weekTasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
  const progressPct  = Math.min(100, Math.round((plannedHours / availableHours) * 100))

  const weekLabel = (() => {
    const end = addDays(monday, 6)
    return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  })()

  const suggestedGoals = goals.slice(0, 3)

  const handleAddSuggested = async (goal: GoalRow) => {
    if (!userId || addedGoalIds.has(goal.id)) return
    const todayStr = toDateStr(today)
    const todayTasksSorted = weekTasks
      .filter(t => t.date === todayStr)
      .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))

    let scheduledTime: string
    if (todayTasksSorted.length > 0) {
      const last = todayTasksSorted[todayTasksSorted.length - 1]
      scheduledTime = addMinutesToTime(last.scheduled_time, last.duration * 60)
    } else {
      scheduledTime = '09:00'
    }

    const hoursPerSession = Math.max(1, Math.round((goal.estimated_weekly_hours || 4) / 5))
    const created = await createTask(userId, {
      text:           `Work on: ${goal.text.slice(0, 50)}${goal.text.length > 50 ? '…' : ''}`,
      date:           todayStr,
      scheduled_time: scheduledTime,
      duration:       hoursPerSession,
      category:       goal.category,
      priority:       'medium',
      completed:      false,
      goal_id:        goal.id,
    })

    if (created) {
      setWeekTasks(prev => [...prev, created])
      setAddedGoalIds(prev => new Set([...prev, goal.id]))
    }
  }

  const handleBuildWeek = async () => {
    if (!userId || goals.length === 0) return
    setBuilding(true)

    const weekStart = toDateStr(monday)
    const weekEnd   = toDateStr(addDays(monday, 6))
    await supabase.from('tasks').delete().eq('user_id', userId).gte('date', weekStart).lte('date', weekEnd)

    const newTasks: DBTask[] = []
    const tasksPerDay: Record<string, Array<{ scheduled_time: string; duration: number }>> = {}

    for (let gi = 0; gi < goals.length; gi++) {
      const goal          = goals[gi]
      const hoursPerWeek  = goal.estimated_weekly_hours || 4
      const sessions      = Math.min(5, Math.ceil(hoursPerWeek / 2))
      const hoursPerSession = Math.max(1, Math.round(hoursPerWeek / sessions))
      const energyType    = categoryToEnergyType(goal.category)

      for (let si = 0; si < sessions; si++) {
        const dayOffset  = (gi + si) % 5
        const date       = addDays(monday, dayOffset)
        const dateStr    = toDateStr(date)
        const dayExisting = tasksPerDay[dateStr] || []

        let scheduledTime = findBestSlot(
          { energyType, category: goal.category, duration: hoursPerSession },
          date,
          energyBlocks,
          dayExisting,
          workSchedule,
        )

        if (!scheduledTime) {
          if (dayExisting.length > 0) {
            const sorted = [...dayExisting].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
            const last   = sorted[sorted.length - 1]
            scheduledTime = addMinutesToTime(last.scheduled_time, last.duration * 60)
          } else {
            scheduledTime = '09:00'
          }
        }

        const created = await createTask(userId, {
          text:           `Work on: ${goal.text.slice(0, 50)}${goal.text.length > 50 ? '…' : ''}`,
          date:           dateStr,
          scheduled_time: scheduledTime,
          duration:       hoursPerSession,
          category:       goal.category,
          priority:       gi === 0 ? 'high' : 'medium',
          completed:      false,
          goal_id:        goal.id,
        })

        if (created) {
          newTasks.push(created)
          if (!tasksPerDay[dateStr]) tasksPerDay[dateStr] = []
          tasksPerDay[dateStr].push({ scheduled_time: scheduledTime, duration: hoursPerSession })
        }
      }
    }

    setWeekTasks(newTasks)
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
      <div style={{ padding: '56px 16px 16px', background: 'white', borderBottom: '0.5px solid #E5E5EA' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Home
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Weekly Planner</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>Week of {weekLabel}</p>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Available Hours */}
        <div style={{ background: '#F0FFF4', borderRadius: 16, padding: '18px', border: '1px solid #BBF7D0', marginBottom: 14 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 4px' }}>Available Hours</p>
          <p style={{ fontSize: 13, color: '#16A34A', margin: '0 0 12px' }}>
            {plannedHours} of {availableHours} hours planned
          </p>
          <div style={{ background: '#BBF7D0', borderRadius: 6, height: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: '#16A34A', borderRadius: 6, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Must-Move This Week */}
        <div style={{ background: 'white', borderRadius: 16, padding: '18px', border: '0.5px solid #E5E5EA', marginBottom: 14 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px' }}>Must-Move This Week</p>
          {goals.length === 0 ? (
            <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>Add active goals to see priorities here.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {goals.slice(0, 3).map(goal => {
                const catStyle = getCatStyle(goal.category)
                const hrs      = goal.estimated_weekly_hours || 4
                return (
                  <div key={goal.id} style={{ background: '#F8F8FC', borderRadius: 12, padding: '14px' }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E', margin: '0 0 6px' }}>{goal.text}</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, background: catStyle.bg, color: catStyle.color, padding: '2px 8px', borderRadius: 20 }}>{goal.category}</span>
                      <span style={{ fontSize: 12, color: '#8E8E93' }}>{hrs}h allocated</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Suggested Tasks */}
        <div style={{ background: 'white', borderRadius: 16, padding: '18px', border: '0.5px solid #E5E5EA', marginBottom: 14 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px' }}>Suggested Tasks</p>
          {goals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <p style={{ fontSize: 14, color: '#3C3C43', margin: '0 0 4px', fontWeight: 500 }}>No active goals</p>
              <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 14px' }}>Add goals first to get task suggestions.</p>
              <button
                onClick={() => router.push('/dashboard/goals')}
                style={{ background: '#3B7DFF', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Add Goals
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {suggestedGoals.map((goal, i) => {
                const hrs      = Math.max(1, Math.round((goal.estimated_weekly_hours || 4) / 5))
                const catStyle = getCatStyle(goal.category)
                const added    = addedGoalIds.has(goal.id)
                return (
                  <div key={goal.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '13px 0',
                    borderBottom: i < suggestedGoals.length - 1 ? '0.5px solid #F2F2F7' : 'none',
                  }}>
                    <div style={{ flex: 1, marginRight: 12 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: '0 0 4px' }}>
                        {goal.text.length > 48 ? goal.text.slice(0, 48) + '…' : goal.text}
                      </p>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, background: catStyle.bg, color: catStyle.color, padding: '2px 7px', borderRadius: 20 }}>{goal.category}</span>
                        <span style={{ fontSize: 12, color: '#8E8E93' }}>Est. {hrs}h</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddSuggested(goal)}
                      disabled={added}
                      style={{
                        background: added ? '#F0FFF4' : 'none', border: 'none',
                        cursor: added ? 'default' : 'pointer',
                        fontSize: 13, color: added ? '#16A34A' : '#3B7DFF',
                        fontFamily: 'inherit', fontWeight: 600, padding: '4px 8px', borderRadius: 8, flexShrink: 0,
                      }}
                    >
                      {added ? 'Added ✓' : 'Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Build Week */}
        <button
          onClick={handleBuildWeek}
          disabled={building || goals.length === 0}
          title={goals.length === 0 ? 'Add goals first to build your week' : undefined}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, marginBottom: 10,
            background: goals.length === 0 ? '#D1D1D6' : '#3B7DFF',
            border: 'none', color: 'white',
            fontSize: 15, fontWeight: 600,
            cursor: building || goals.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: building ? 0.7 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {building ? 'Building Week…' : goals.length === 0 ? 'Add Goals to Build Week' : 'Build Week'}
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleResetWeek}
            style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Reset Week
          </button>
          <button
            onClick={() => router.push('/dashboard/plan/daily')}
            style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            View Daily
          </button>
        </div>
      </div>
    </div>
  )
}
