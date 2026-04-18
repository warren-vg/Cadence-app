'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  toDateStr, getMonday, getTasksForDate, getWeekSummary, getMomentumScore,
  toggleTask, formatTime,
  type PlanTask,
} from '@/lib/planData'

interface Goal {
  id: string
  text: string
  category: string
  status: string
  priority: number
  progress: number
}

interface Profile {
  username: string
  avatar_url: string | null
}

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

function getDateLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function getMomentumText(score: number) {
  if (score >= 80) return "Excellent! You're crushing it this week."
  if (score >= 60) return "Strong week! Keep pushing toward your goals."
  if (score >= 40) return "Good progress. Stay consistent and build momentum."
  if (score > 0) return "Just getting started. Every step counts."
  return "Complete tasks to build your momentum score."
}

function CircularProgress({ pct, size = 52 }: { pct: number; size?: number }) {
  const strokeWidth = 5
  const r = (size - strokeWidth * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(pct, 100) / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#DBEAFE" strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3B7DFF" strokeWidth={strokeWidth}
          strokeDasharray={`${circ}`} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1C1C1E' }}>
        {pct}%
      </div>
    </div>
  )
}

function DonutChart({ planned, total, size = 96 }: { planned: number; total: number; size?: number }) {
  const strokeWidth = 10
  const r = (size - strokeWidth * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const ratio = total > 0 ? Math.min(planned / total, 1) : 0
  const dash = circ * ratio

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E5EA" strokeWidth={strokeWidth} />
      {ratio > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3B7DFF" strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`} />
      )}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1C1C1E">
        {planned}h
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#8E8E93">planned</text>
    </svg>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [todayTasks, setTodayTasks] = useState<PlanTask[]>([])
  const [momentumScore, setMomentumScore] = useState(0)
  const [weekSummary, setWeekSummary] = useState({ totalTasks: 0, completedTasks: 0, totalHours: 0 })
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')
  const [dateLabel, setDateLabel] = useState('')

  useEffect(() => {
    setGreeting(getGreeting())
    setDateLabel(getDateLabel())

    const loadPlanData = () => {
      const todayStr = toDateStr(new Date())
      const tasks = getTasksForDate(todayStr)
      setTodayTasks(tasks)
      setMomentumScore(getMomentumScore())
      const monday = getMonday(new Date())
      setWeekSummary(getWeekSummary(monday))
    }

    const loadSupabase = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: profileData }, { data: goalsData }] = await Promise.all([
        supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id).order('priority', { ascending: true }),
      ])

      setProfile(profileData)
      setGoals(goalsData || [])
      setLoading(false)
    }

    loadPlanData()
    loadSupabase()
  }, [])

  const handleToggleTask = (id: string) => {
    const updated = toggleTask(id)
    const todayStr = toDateStr(new Date())
    setTodayTasks(updated.filter(t => t.date === todayStr).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)))
    setMomentumScore(getMomentumScore())
    const monday = getMonday(new Date())
    setWeekSummary(getWeekSummary(monday))
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const topPriorities = activeGoals.slice(0, 3)
  const completedToday = todayTasks.filter(t => t.completed).length
  const totalToday = todayTasks.length

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const firstName = profile?.username?.split(' ')[0] || 'there'
  const capacityPct = weekSummary.totalHours > 0
    ? Math.min(100, Math.round((weekSummary.totalHours / 40) * 100))
    : 0

  return (
    <div style={{ padding: '56px 16px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ fontSize: 14, color: '#8E8E93', marginTop: 3 }}>
            Today only needs one meaningful move.
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/settings')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: 2 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Today's Focus Card */}
      <div style={{
        background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
        borderRadius: 20, padding: '20px', marginBottom: 14, color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>{dateLabel}</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>Today's Focus</h2>
          </div>
          <span style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 20,
            padding: '4px 10px', fontSize: 12, fontWeight: 600,
          }}>
            {completedToday}/{totalToday} Done
          </span>
        </div>

        {totalToday === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '14px 16px',
            marginBottom: 12, textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, opacity: 0.85, margin: 0 }}>No tasks scheduled yet.</p>
            <p style={{ fontSize: 12, opacity: 0.65, margin: '4px 0 0' }}>Build your daily plan in the Plan tab.</p>
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {todayTasks.slice(0, 4).map((task, i) => {
              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    paddingTop: i > 0 ? 10 : 0,
                    paddingBottom: i < Math.min(todayTasks.length, 4) - 1 ? 10 : 0,
                    borderBottom: i < Math.min(todayTasks.length, 4) - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
                  }}
                >
                  <button
                    onClick={() => handleToggleTask(task.id)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: task.completed ? 'white' : 'transparent',
                      border: task.completed ? 'none' : '2px solid rgba(255,255,255,0.5)',
                      cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {task.completed && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 500, margin: 0,
                      color: 'white', opacity: task.completed ? 0.5 : 1,
                      textDecoration: task.completed ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {task.text}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}>{formatTime(task.scheduledTime)}</span>
                </div>
              )
            })}
            {todayTasks.length > 4 && (
              <p style={{ fontSize: 12, opacity: 0.65, margin: '10px 0 0', textAlign: 'center' }}>
                +{todayTasks.length - 4} more tasks
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => router.push(`/dashboard/plan/daily?date=${toDateStr(new Date())}`)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.15)', border: 'none',
            borderRadius: 10, padding: '10px', color: 'white', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, fontFamily: 'inherit',
          }}
        >
          View Full Day
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Momentum Score Card */}
      <div style={{ background: 'white', borderRadius: 20, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF9500" stroke="none">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>Momentum Score</p>
              <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>Tasks completed vs planned</p>
            </div>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#FF9500' }}>{momentumScore}</span>
        </div>

        <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, marginBottom: 10, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${momentumScore}%`,
            background: momentumScore >= 60 ? '#34C759' : momentumScore >= 30 ? '#FF9500' : '#FF3B30',
            borderRadius: 4, transition: 'width 0.6s ease',
          }} />
        </div>

        <p style={{ fontSize: 13, color: '#3C3C43', margin: 0 }}>{getMomentumText(momentumScore)}</p>
      </div>

      {/* Top Priorities Card */}
      <div style={{ background: 'white', borderRadius: 20, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="#3B7DFF" />
            </svg>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Top Priorities</h2>
          </div>
          <button onClick={() => router.push('/dashboard/goals')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', padding: 0 }}>
            View All
          </button>
        </div>

        {topPriorities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#8E8E93' }}>
            <p style={{ fontSize: 14, margin: 0 }}>No active goals yet.</p>
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>Add goals to see your priorities here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topPriorities.map(goal => (
              <button
                key={goal.id}
                onClick={() => router.push(`/dashboard/goals/${goal.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%', fontFamily: 'inherit' }}
              >
                <CircularProgress pct={goal.progress || 0} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {goal.text}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#3B7DFF', background: '#EFF6FF', padding: '2px 8px', borderRadius: 20 }}>
                      {goal.category}
                    </span>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D1D6" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* This Week Card */}
      <div style={{ background: 'white', borderRadius: 20, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>This Week</h2>
          </div>
          <button onClick={() => router.push('/dashboard/plan')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', padding: 0 }}>
            Edit Plan
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <DonutChart planned={weekSummary.totalHours} total={40} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B7DFF' }} />
                <span style={{ fontSize: 13, color: '#3C3C43' }}>Tasks Planned</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>
                {weekSummary.totalTasks > 0 ? `${weekSummary.totalTasks} tasks` : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34C759' }} />
                <span style={{ fontSize: 13, color: '#3C3C43' }}>Completed</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>
                {weekSummary.completedTasks} tasks
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#3C3C43' }}>Hours Planned</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>
                {weekSummary.totalHours > 0 ? `${weekSummary.totalHours}h` : '—'}
              </span>
            </div>
          </div>
        </div>

        {weekSummary.totalTasks > 0 && (
          <div style={{ background: '#F0FFF4', borderRadius: 10, padding: '10px 12px', marginTop: 14 }}>
            <p style={{ fontSize: 12, color: '#16A34A', margin: 0 }}>
              {weekSummary.completedTasks}/{weekSummary.totalTasks} tasks done · {capacityPct}% of weekly capacity used
            </p>
          </div>
        )}

        {weekSummary.totalTasks === 0 && (
          <div style={{ background: '#F0FFF4', borderRadius: 10, padding: '10px 12px', marginTop: 14 }}>
            <p style={{ fontSize: 12, color: '#16A34A', margin: 0 }}>
              No tasks planned yet. Build your weekly plan to stay on track.
            </p>
          </div>
        )}
      </div>

      {/* Weekly Review Due Card */}
      <div style={{ background: '#FFFBEB', borderRadius: 20, padding: '18px 20px', marginBottom: 14, border: '1px solid #FDE68A' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#92400E', margin: 0 }}>Weekly Review Due</p>
            <p style={{ fontSize: 13, color: '#B45309', margin: '4px 0 12px' }}>
              Reflect on last week's progress and plan the week ahead.
            </p>
            <button
              onClick={() => router.push('/dashboard/check-in/weekly')}
              style={{ background: 'white', border: '1px solid #D97706', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#D97706', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Start Review
            </button>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/dashboard/goals')}
        style={{
          position: 'fixed', bottom: 80, right: 20, width: 52, height: 52, borderRadius: '50%',
          background: '#3B7DFF', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(59, 125, 255, 0.4)', zIndex: 99,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
