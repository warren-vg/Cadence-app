'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  toDateStr, getMonday, addDays, getTasksForWeek, getWeekSummary,
  getCatStyle, addTask, getAllTasks, saveTasks,
  type PlanTask,
} from '@/lib/planData'
import { supabase } from '@/lib/supabase'

interface GoalRow {
  id: string
  text: string
  category: string
  progress: number
  priority: number
  estimated_weekly_hours?: number | null
}

const RECOMMENDED: { text: string; category: string; hours: number }[] = [
  { text: 'Finalize portfolio case study', category: 'Career', hours: 3 },
  { text: 'Review monthly budget', category: 'Finance', hours: 1 },
  { text: 'Write blog post draft', category: 'Creative', hours: 2 },
]

const DAILY_MINIMUMS = [
  'Morning run (30 min)',
  'Email inbox to zero (15 min)',
  'Evening reflection (5 min)',
]

export default function WeeklyPlannerPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [mounted, setMounted] = useState(false)
  const [addedRecs, setAddedRecs] = useState<Set<number>>(new Set())
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('priority', { ascending: true })
      setGoals(data || [])
    }
    load()
  }, [])

  if (!mounted) return null

  const today = new Date()
  const monday = getMonday(today)
  const summary = getWeekSummary(monday)
  const weekTasks = getTasksForWeek(monday)
  const plannedHours = summary.totalHours
  const availableHours = 32
  const progressPct = Math.min(100, Math.round((plannedHours / availableHours) * 100))

  const mustMoveGoals = goals.slice(0, 3)

  const weekLabel = (() => {
    const end = addDays(monday, 6)
    return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  })()

  const handleAddRecommended = (idx: number) => {
    const rec = RECOMMENDED[idx]
    if (addedRecs.has(idx)) return
    const todayStr = toDateStr(today)
    const existingToday = getTasksForWeek(monday).filter(t => t.date === todayStr)
    const lastTime = existingToday.length > 0
      ? existingToday[existingToday.length - 1].scheduledTime
      : '09:00'
    addTask({
      text: rec.text,
      date: todayStr,
      scheduledTime: lastTime,
      duration: rec.hours,
      category: rec.category,
      priority: 'medium',
      completed: false,
    })
    setAddedRecs(prev => new Set([...prev, idx]))
  }

  const handleBuildWeek = async () => {
    setBuilding(true)
    // Remove existing seed tasks for this week, keep any user-added tasks
    const allTasks = getAllTasks()
    const weekStart = toDateStr(monday)
    const weekEnd = toDateStr(addDays(monday, 6))
    const keptTasks = allTasks.filter(t => t.date < weekStart || t.date > weekEnd || !t.id.startsWith('seed-'))

    // Build auto-generated tasks from goals
    const newTasks: PlanTask[] = []
    const days = [0, 1, 2, 3, 4] // Mon-Fri
    goals.forEach((goal, gi) => {
      const hoursPerWeek = goal.estimated_weekly_hours || 4
      const sessions = Math.ceil(hoursPerWeek / 2)
      const assignedDays = days.slice(gi % 5, gi % 5 + sessions).concat(days.slice(0, Math.max(0, sessions - (5 - gi % 5))))
      assignedDays.slice(0, sessions).forEach((dayOffset, si) => {
        const date = toDateStr(addDays(monday, dayOffset))
        newTasks.push({
          id: `built-${gi}-${si}-${Date.now()}`,
          text: `Work on: ${goal.text.slice(0, 40)}${goal.text.length > 40 ? '...' : ''}`,
          date,
          scheduledTime: si % 2 === 0 ? '09:00' : '14:00',
          duration: 2,
          category: goal.category,
          priority: gi === 0 ? 'high' : 'medium',
          completed: false,
        })
      })
    })

    saveTasks([...keptTasks, ...newTasks])
    setBuilding(false)
    router.push('/dashboard/plan')
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
        <div style={{
          background: '#F0FFF4', borderRadius: 16, padding: '18px',
          border: '1px solid #BBF7D0', marginBottom: 14,
        }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 4px' }}>Available Hours</p>
          <p style={{ fontSize: 13, color: '#16A34A', margin: '0 0 12px' }}>
            {plannedHours} of {availableHours} hours planned
          </p>
          <div style={{ background: '#BBF7D0', borderRadius: 6, height: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progressPct}%`,
              background: '#16A34A', borderRadius: 6,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Must-Move This Week */}
        <div style={{
          background: 'white', borderRadius: 16, padding: '18px',
          border: '0.5px solid #E5E5EA', marginBottom: 14,
        }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px' }}>Must-Move This Week</p>
          {mustMoveGoals.length === 0 ? (
            <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>Add active goals to see priorities here.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mustMoveGoals.map(goal => {
                const catStyle = getCatStyle(goal.category)
                const hrs = goal.estimated_weekly_hours || 4
                return (
                  <div key={goal.id} style={{
                    background: '#F8F8FC', borderRadius: 12, padding: '14px',
                  }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E', margin: '0 0 6px' }}>{goal.text}</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        background: catStyle.bg, color: catStyle.color,
                        padding: '2px 8px', borderRadius: 20,
                      }}>{goal.category}</span>
                      <span style={{ fontSize: 12, color: '#8E8E93' }}>{hrs} hours allocated</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recommended Tasks */}
        <div style={{
          background: 'white', borderRadius: 16, padding: '18px',
          border: '0.5px solid #E5E5EA', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Recommended Tasks</p>
            <button
              onClick={() => RECOMMENDED.forEach((_, i) => handleAddRecommended(i))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#3B7DFF', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add All
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {RECOMMENDED.map((rec, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '13px 0',
                borderBottom: i < RECOMMENDED.length - 1 ? '0.5px solid #F2F2F7' : 'none',
              }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: '0 0 2px' }}>{rec.text}</p>
                  <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>Est. {rec.hours} {rec.hours === 1 ? 'hour' : 'hours'}</p>
                </div>
                <button
                  onClick={() => handleAddRecommended(i)}
                  style={{
                    background: addedRecs.has(i) ? '#F0FFF4' : 'none',
                    border: 'none', cursor: addedRecs.has(i) ? 'default' : 'pointer',
                    fontSize: 13, color: addedRecs.has(i) ? '#16A34A' : '#3B7DFF',
                    fontFamily: 'inherit', fontWeight: 600, padding: '4px 8px', borderRadius: 8,
                  }}
                >
                  {addedRecs.has(i) ? 'Added ✓' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Minimums */}
        <div style={{
          background: '#EFF6FF', borderRadius: 16, padding: '18px',
          border: '1px solid #DBEAFE', marginBottom: 14,
        }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1D4ED8', margin: '0 0 10px' }}>Daily Minimums</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DAILY_MINIMUMS.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B7DFF', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#1D4ED8' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Build Week */}
        <button
          onClick={handleBuildWeek}
          disabled={building}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, marginBottom: 10,
            background: '#3B7DFF', border: 'none', color: 'white',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: building ? 0.7 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {building ? 'Building Week...' : 'Build Week'}
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              if (confirm('Reset all tasks for this week?')) {
                const allTasks = getAllTasks()
                const weekStart = toDateStr(monday)
                const weekEnd = toDateStr(addDays(monday, 6))
                saveTasks(allTasks.filter(t => t.date < weekStart || t.date > weekEnd))
                router.refresh()
              }
            }}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E',
              fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Reset Week
          </button>
          <button
            onClick={() => router.push('/dashboard/plan/daily')}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E',
              fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            View Daily
          </button>
        </div>
      </div>
    </div>
  )
}
