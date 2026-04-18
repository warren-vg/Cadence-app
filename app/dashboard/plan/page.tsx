'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  toDateStr, getMonday, addDays, getTasksForDate, getTasksForWeek,
  getDayFocusCategories, getCatStyle, formatTime,
  type PlanTask,
} from '@/lib/planData'
import { supabase } from '@/lib/supabase'

type ViewMode = 'Daily' | 'Weekly' | 'Monthly'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface GoalRow {
  id: string
  text: string
  category: string
  progress: number
  quarter?: string | null
  estimated_weekly_hours?: number | null
}

export default function PlanPage() {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>('Weekly')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [dayOffset, setDayOffset] = useState(0)
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'active')
      setGoals(data || [])
    }
    load()
  }, [])

  useEffect(() => {
    if (!mounted) return
    const today = new Date()
    const targetDate = addDays(today, dayOffset)
    const monday = getMonday(addDays(today, weekOffset * 7))

    if (view === 'Daily') {
      setTasks(getTasksForDate(toDateStr(targetDate)))
    } else if (view === 'Weekly') {
      setTasks(getTasksForWeek(monday))
    }
  }, [mounted, view, weekOffset, dayOffset])

  if (!mounted) return null

  const today = new Date()
  const todayStr = toDateStr(today)

  // ── Weekly view helpers ──
  const weekMonday = getMonday(addDays(today, weekOffset * 7))
  const weekSunday = addDays(weekMonday, 6)
  const weekLabel = (() => {
    const ms = MONTHS[weekMonday.getMonth()].slice(0, 3)
    const me = MONTHS[weekSunday.getMonth()].slice(0, 3)
    const ds = weekMonday.getDate()
    const de = weekSunday.getDate()
    return ms === me ? `${ms} ${ds} - ${de}` : `${ms} ${ds} - ${me} ${de}`
  })()

  // ── Daily view helpers ──
  const targetDay = addDays(today, dayOffset)
  const targetDayStr = toDateStr(targetDay)
  const dailyTasks = getTasksForDate(targetDayStr).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
  const dayLabel = targetDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  // ── Monthly view helpers ──
  const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const monthLabel = `${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`

  return (
    <div style={{ padding: '56px 16px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Plan</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', marginTop: 3, marginBottom: 0 }}>Your schedule and timeline</p>
      </div>

      {/* View Switcher */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        background: 'white', borderRadius: 14, padding: '4px',
        border: '0.5px solid #E5E5EA', marginBottom: 20,
      }}>
        {(['Daily', 'Weekly', 'Monthly'] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '9px 0', borderRadius: 10,
              background: view === v ? '#3B7DFF' : 'transparent',
              border: 'none',
              fontSize: 14, fontWeight: view === v ? 600 : 400,
              color: view === v ? 'white' : '#8E8E93',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* ── WEEKLY VIEW ── */}
      {view === 'Weekly' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>This Week</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setWeekOffset(o => o - 1)} style={navBtnStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span style={{ fontSize: 13, color: '#3C3C43', minWidth: 90, textAlign: 'center' }}>{weekLabel}</span>
              <button onClick={() => setWeekOffset(o => o + 1)} style={navBtnStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DAY_FULL.map((dayName, i) => {
              const date = addDays(weekMonday, i)
              const dateStr = toDateStr(date)
              const isToday = dateStr === todayStr
              const dayTasks = getTasksForDate(dateStr)
              const hours = parseFloat(dayTasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
              const focusCats = getDayFocusCategories(dateStr)

              return (
                <button
                  key={i}
                  onClick={() => router.push(`/dashboard/plan/daily?date=${dateStr}`)}
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    padding: '16px 18px',
                    border: isToday ? '2px solid #3B7DFF' : '0.5px solid #E5E5EA',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>{dayName}</span>
                      {isToday && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: '#3B7DFF',
                          background: '#EFF6FF', borderRadius: 20, padding: '2px 8px',
                        }}>Today</span>
                      )}
                    </div>
                    {focusCats.length > 0 ? (
                      <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>
                        Focus:{' '}
                        {focusCats.map((cat, ci) => (
                          <span key={cat} style={{ color: getCatStyle(cat).color }}>
                            {cat}{ci < focusCats.length - 1 ? ' & ' : ''}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p style={{ fontSize: 13, color: '#D1D1D6', margin: 0 }}>No tasks planned</p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>{dayTasks.length}</p>
                    <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>tasks · {hours}h</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Weekly action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={() => router.push('/dashboard/plan/weekly')}
              style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: '#1C1C1E', border: 'none', color: 'white',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Edit Weekly Plan
            </button>
            <button
              onClick={() => router.push('/dashboard/plan/schedule')}
              style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Manage Schedule
            </button>
          </div>
        </>
      )}

      {/* ── DAILY VIEW ── */}
      {view === 'Daily' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Today's Schedule</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setDayOffset(o => o - 1)} style={navBtnStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span style={{ fontSize: 13, color: '#3C3C43', minWidth: 80, textAlign: 'center' }}>{dayLabel}</span>
              <button onClick={() => setDayOffset(o => o + 1)} style={navBtnStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          <div style={{
            background: 'white', borderRadius: 16, overflow: 'hidden',
            border: '0.5px solid #E5E5EA', marginBottom: 16,
          }}>
            {dailyTasks.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8E8E93' }}>
                <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px', color: '#3C3C43' }}>No tasks planned</p>
                <p style={{ fontSize: 13, margin: 0 }}>Build your plan from the Weekly tab.</p>
              </div>
            ) : (
              dailyTasks.map((task, i) => {
                const catStyle = getCatStyle(task.category)
                return (
                  <div key={task.id} style={{
                    padding: '14px 18px',
                    borderBottom: i < dailyTasks.length - 1 ? '0.5px solid #F2F2F7' : 'none',
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                  }}>
                    <span style={{ fontSize: 13, color: '#8E8E93', minWidth: 44, marginTop: 2 }}>
                      {formatTime(task.scheduledTime).replace(' ', '\n')}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E', margin: '0 0 5px' }}>{task.text}</p>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 500,
                          background: catStyle.bg, color: catStyle.color,
                          padding: '2px 8px', borderRadius: 20,
                        }}>{task.category}</span>
                        <span style={{ fontSize: 12, color: '#8E8E93' }}>{task.duration} {task.duration === 1 ? 'hour' : 'hours'}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <button
            onClick={() => router.push(`/dashboard/plan/daily?date=${targetDayStr}`)}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: '#1C1C1E', border: 'none', color: 'white',
              fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            View Detailed Daily Plan
          </button>
        </>
      )}

      {/* ── MONTHLY VIEW ── */}
      {view === 'Monthly' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Goal Timeline</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setMonthOffset(o => o - 1)} style={navBtnStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span style={{ fontSize: 13, color: '#3C3C43', minWidth: 90, textAlign: 'center' }}>{monthLabel}</span>
              <button onClick={() => setMonthOffset(o => o + 1)} style={navBtnStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          {goals.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 16, padding: '40px 20px', textAlign: 'center', border: '0.5px solid #E5E5EA', color: '#8E8E93' }}>
              <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px', color: '#3C3C43' }}>No active goals</p>
              <p style={{ fontSize: 13, margin: 0 }}>Add goals to see your monthly timeline.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {goals.map(goal => {
                const catStyle = getCatStyle(goal.category)
                const weeklyHrs = goal.estimated_weekly_hours || 4
                const targetQ = goal.quarter || 'Q4'
                const targetDate = quarterToDate(targetQ)
                const monthTaskCount = Math.round(weeklyHrs * 4)
                return (
                  <div key={goal.id} style={{
                    background: 'white', borderRadius: 16, padding: '18px',
                    border: '0.5px solid #E5E5EA',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ flex: 1, paddingRight: 12 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px' }}>{goal.text}</p>
                        <span style={{
                          fontSize: 12, fontWeight: 500,
                          background: catStyle.bg, color: catStyle.color,
                          padding: '2px 8px', borderRadius: 20,
                        }}>{goal.category}</span>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="#3B7DFF" />
                      </svg>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                      {[
                        { label: 'This Month', value: `${monthTaskCount}`, sub: 'tasks' },
                        { label: 'Weekly Avg', value: `${weeklyHrs}h`, sub: 'per week' },
                        { label: 'Progress', value: `${goal.progress || 0}%`, sub: 'complete' },
                      ].map(stat => (
                        <div key={stat.label} style={{ background: '#F8F8FC', borderRadius: 10, padding: '10px 8px' }}>
                          <p style={{ fontSize: 11, color: '#8E8E93', margin: '0 0 3px' }}>{stat.label}</p>
                          <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 1px' }}>{stat.value}</p>
                          <p style={{ fontSize: 11, color: '#8E8E93', margin: 0 }}>{stat.sub}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ height: 6, background: '#F2F2F7', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${goal.progress || 0}%`, background: '#3B7DFF', borderRadius: 4 }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                      <span style={{ fontSize: 13, color: '#8E8E93' }}>Target Completion</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', marginLeft: 'auto' }}>{targetDate}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={() => router.push('/dashboard/plan/quarterly')}
            style={{
              width: '100%', marginTop: 16, padding: '14px', borderRadius: 14,
              background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E',
              fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            View Quarterly Planner
          </button>
        </>
      )}
    </div>
  )
}

function quarterToDate(q: string): string {
  const year = new Date().getFullYear()
  if (q === 'Q1') return `Mar 31, ${year}`
  if (q === 'Q2') return `Jun 30, ${year}`
  if (q === 'Q3') return `Sep 30, ${year}`
  if (q === 'Q4') return `Dec 31, ${year}`
  return `Dec 31, ${q}`
}

const navBtnStyle: React.CSSProperties = {
  background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8,
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0,
}
