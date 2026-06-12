'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toDateStr, getMonday, formatTime, getMomentumScore, CONSTANTS } from '@/lib/planData'
import {
  getTasksForDate, getTasksForWeek, toggleTask as dbToggleTask,
  getWeekStreakFromDB, getFirstRunCompleted, type DBTask,
} from '@/lib/db'
import { evaluateRewards } from '@/lib/rewards'
import { useRewards } from './components/RewardContext'
import NotificationBell from './components/NotificationBell'
import EmptyState from './components/EmptyState'
import { useTour } from './components/TourContext'

interface Goal {
  id: string
  text: string
  category: string
  status: string
  priority: number
  progress: number
  estimated_weekly_hours?: number | null
}

interface Profile {
  full_name: string | null
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

type ReviewState = 'countdown' | 'open' | 'complete' | 'hidden'

function getReviewState(hasReflection: boolean): { state: ReviewState; daysUntilFriday?: number } {
  if (hasReflection) return { state: 'complete' }
  const now = new Date()
  const day = now.getDay()  // 0=Sun 1=Mon … 6=Sat
  const h   = now.getHours()
  if (day === 0 && h >= 21) return { state: 'hidden' }      // Sun after 9 pm — window closed
  if (day === 5 || day === 6 || day === 0) return { state: 'open' }  // Fri / Sat / Sun before 9 pm
  return { state: 'countdown', daysUntilFriday: 5 - day }   // Mon(4) Tue(3) Wed(2) Thu(1)
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
  const { startTour } = useTour()
  const { queueRewards, loadUnseenRewards } = useRewards()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [todayTasks, setTodayTasks] = useState<DBTask[]>([])
  const [weekTasks, setWeekTasks] = useState<DBTask[]>([])
  const [streak, setStreak] = useState(0)
  const [weeklyCapacity, setWeeklyCapacity] = useState(CONSTANTS.DEFAULT_WEEKLY_CAPACITY_HOURS)
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')
  const [dateLabel, setDateLabel] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [hasThisWeekReflection, setHasThisWeekReflection] = useState(false)

  useEffect(() => {
    setGreeting(getGreeting())
    setDateLabel(getDateLabel())

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const todayStr = toDateStr(new Date())
      const monday   = getMonday(new Date())

      const weekOf = toDateStr(monday)
      const [{ data: profileData }, { data: goalsData }, todayData, weekData, currentStreak, { data: reflData }, firstRunDone] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url, weekly_capacity').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id).order('priority', { ascending: true }),
        getTasksForDate(user.id, todayStr),
        getTasksForWeek(user.id, monday),
        getWeekStreakFromDB(user.id),
        supabase.from('weekly_reflections').select('week_of').eq('user_id', user.id).eq('week_of', weekOf).maybeSingle(),
        getFirstRunCompleted(user.id),
      ])

      setUserId(user.id)
      setProfile(profileData)
      setGoals(goalsData || [])
      setTodayTasks(todayData)
      setWeekTasks(weekData)
      setStreak(currentStreak)
      setHasThisWeekReflection(!!reflData)
      if (profileData?.weekly_capacity) setWeeklyCapacity(profileData.weekly_capacity)
      setLoading(false)

      // Auto-launch the guided tour for new users who haven't seen it yet
      if (!firstRunDone) {
        startTour(user.id, true)
      }

      // Reward reconciliation: check for missed full_day / perfect_week from yesterday,
      // then surface any unseen rewards earned in other contexts.
      const earned = await evaluateRewards(user.id, {
        trigger: 'app_opened',
        ctx: { date: todayStr },
      })
      if (earned.length > 0) queueRewards(earned)
      await loadUnseenRewards(user.id)
    }

    load()
  }, [startTour, queueRewards, loadUnseenRewards])

  const handleToggleTask = async (task: DBTask) => {
    setTodayTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
    setWeekTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
    const ok = await dbToggleTask(task.id, task.completed)
    if (!ok) {
      setTodayTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t))
      setWeekTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t))
      return
    }
    // Reward evaluation for completions — non-blocking.
    // goal_complete is intentionally skipped here (no recalc on dashboard); it fires from the daily plan.
    if (!task.completed && userId) {
      const goalTitle = task.goal_id
        ? (goals.find(g => g.id === task.goal_id)?.text ?? null)
        : null
      evaluateRewards(userId, {
        trigger: 'task_completed',
        ctx: {
          taskId:        task.id,
          taskDate:      task.date,
          taskCreatedAt: task.created_at ?? new Date().toISOString(),
          taskCategory:  task.category,
          goalId:        task.goal_id ?? null,
          goalTitle,
          goalProgress:  null,
        },
      }).then(earned => { if (earned.length > 0) queueRewards(earned) })
    }
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const topPriorities = activeGoals.slice(0, CONSTANTS.TOP_PRIORITIES_LIMIT)
  const completedToday = todayTasks.filter(t => t.completed).length
  const totalToday = todayTasks.length
  const momentumScore = getMomentumScore(
    goals.map(g => ({ status: g.status, progress: g.progress, estimatedWeeklyHours: g.estimated_weekly_hours ?? null })),
    weekTasks,
    streak,
    weeklyCapacity,
  )
  const completedInWeek = weekTasks.filter(t => t.completed).length
  const weekSummary = {
    totalTasks:     weekTasks.length,
    completedTasks: completedInWeek,
    totalHours:     Math.round(weekTasks.reduce((s, t) => s + t.duration, 0) * 10) / 10,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const firstName   = profile?.full_name?.split(' ')[0] || 'there'
  const capacityPct = weekSummary.totalHours > 0
    ? Math.min(100, Math.round((weekSummary.totalHours / weeklyCapacity) * 100))
    : 0
  const reviewState = getReviewState(hasThisWeekReflection)

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
          <NotificationBell />
          <button
            onClick={() => router.push('/dashboard/settings')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Today's Focus Card */}
      <div
        data-tour="home-today-card"
        style={{
          background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
          borderRadius: 20, padding: '20px', marginBottom: 14, color: 'white',
        }}
      >
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
                    onClick={() => handleToggleTask(task)}
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
                  <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}>{formatTime(task.scheduled_time)}</span>
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

      {/* Top Priorities / First Goal */}
      {activeGoals.length === 0 ? (
        <div style={{ marginBottom: 14 }}>
          <EmptyState
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="#3B7DFF" />
              </svg>
            }
            iconBg="#EFF6FF"
            title="Set your first goal"
            body="Goals are the foundation of your Cadence. Define what matters most and start building real momentum."
            ctaLabel="Create My First Goal"
            onCta={() => router.push('/dashboard/goals')}
          />
        </div>
      ) : (
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
        </div>
      )}

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
          <DonutChart planned={weekSummary.totalHours} total={weeklyCapacity} />
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

      {/* Weekly Review Card — state-driven */}
      {reviewState.state === 'countdown' && (
        <div style={{ background: '#F8F8FC', borderRadius: 20, padding: '14px 18px', marginBottom: 14, border: '0.5px solid #E5E5EA', display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>
            Weekly Review opens in <strong style={{ color: '#1C1C1E' }}>{reviewState.daysUntilFriday} day{reviewState.daysUntilFriday !== 1 ? 's' : ''}</strong>
          </p>
        </div>
      )}
      {reviewState.state === 'open' && (
        <div style={{ background: '#FFFBEB', borderRadius: 20, padding: '18px 20px', marginBottom: 14, border: '1px solid #FDE68A' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#92400E', margin: 0 }}>Weekly Review Open</p>
              <p style={{ fontSize: 13, color: '#B45309', margin: '4px 0 12px' }}>Reflect on this week&apos;s progress and set your focus for next week.</p>
              <button
                onClick={() => router.push('/dashboard/check-in/weekly')}
                style={{ background: 'white', border: '1px solid #D97706', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#D97706', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Start Review
              </button>
            </div>
          </div>
        </div>
      )}
      {reviewState.state === 'complete' && (
        <div style={{ background: '#F0FFF4', borderRadius: 20, padding: '14px 18px', marginBottom: 14, border: '0.5px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p style={{ fontSize: 13, color: '#16A34A', fontWeight: 600, margin: 0 }}>Weekly Review complete</p>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowQuickAdd(true)}
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

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div
          onClick={() => setShowQuickAdd(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'white', borderRadius: '20px 20px 0 0', padding: '0 16px 40px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5EA' }} />
            </div>
            <p style={{ fontSize: 13, color: '#8E8E93', textAlign: 'center', margin: '0 0 16px' }}>What would you like to add?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  label: 'New Project',
                  sub: 'Track a campaign, study, or creative work',
                  bg: '#EFF6FF', color: '#3B7DFF',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="6" height="6" rx="1"/><rect x="2" y="15" width="6" height="6" rx="1"/>
                      <rect x="10" y="3" width="12" height="6" rx="1"/><rect x="10" y="15" width="12" height="6" rx="1"/>
                    </svg>
                  ),
                  onClick: () => { setShowQuickAdd(false); router.push('/dashboard/projects') },
                },
                {
                  label: 'New Goal',
                  sub: 'Add a goal to your priorities',
                  bg: '#F5F3FF', color: '#8B5CF6',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="#8B5CF6"/>
                    </svg>
                  ),
                  onClick: () => { setShowQuickAdd(false); router.push('/dashboard/goals') },
                },
                {
                  label: 'New Task',
                  sub: 'Add a task to your daily plan',
                  bg: '#F0FFF4', color: '#16A34A',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  ),
                  onClick: () => { setShowQuickAdd(false); router.push(`/dashboard/plan/daily?date=${toDateStr(new Date())}`) },
                },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 16,
                    background: 'white', border: '0.5px solid #E5E5EA',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: '#8E8E93', margin: '2px 0 0' }}>{item.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
