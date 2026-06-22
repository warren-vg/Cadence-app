'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toDateStr, getMonday, formatTime, addMinutes, getMomentumScore, CONSTANTS, CATEGORY_COLORS } from '@/lib/planData'
import {
  getTasksForDate, getTasksForWeek, toggleTask as dbToggleTask,
  getWeekStreakFromDB, getFirstRunCompleted, recalcGoalProgressFromTasks, type DBTask,
} from '@/lib/db'
import { evaluateRewards } from '@/lib/rewards'
import { dailyVariant, COPY } from '@/lib/copy'
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

type MeaningfulMove = {
  taskId: string
  taskText: string
  category: string
  scheduledTime: string
  duration: number
  completed: boolean
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
  if (day === 0 && h >= 21) return { state: 'hidden' }
  if (day === 5 || day === 6 || day === 0) return { state: 'open' }
  return { state: 'countdown', daysUntilFriday: 5 - day }
}

function getMomentumText(score: number, userId: string) {
  if (score >= 80) return dailyVariant(COPY.momentum_high, userId)
  if (score >= 60) return dailyVariant(COPY.momentum_good, userId)
  if (score >= 40) return dailyVariant(COPY.momentum_building, userId)
  if (score > 0)   return dailyVariant(COPY.momentum_starting, userId)
  return dailyVariant(COPY.momentum_zero, userId)
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

const MOVE_KEY = (d: string) => `cadence_move_${d}`
const SKIP_KEY = (d: string) => `cadence_move_skipped_${d}`
const EVE_KEY  = (d: string) => `cadence_evening_${d}`

export default function DashboardPage() {
  const router = useRouter()
  const { startTour } = useTour()
  const { queueRewards, loadUnseenRewards } = useRewards()

  // ── Core data ──────────────────────────────────────────────────────────────
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

  // ── Meaningful Move ─────────────────────────────────────────────────────────
  const [meaningfulMove, setMeaningfulMove] = useState<MeaningfulMove | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [moveSkipped, setMoveSkipped] = useState(false)
  const [eveningLearned, setEveningLearned] = useState('')
  const [eveningIntention, setEveningIntention] = useState('')
  const [eveningLogged, setEveningLogged] = useState(false)
  const [currentHour] = useState(() => new Date().getHours())
  const carouselRef = useRef<HTMLDivElement>(null)

  // Load Meaningful Move state from localStorage
  useEffect(() => {
    const d = toDateStr(new Date())
    try {
      const raw = localStorage.getItem(MOVE_KEY(d))
      if (raw) setMeaningfulMove(JSON.parse(raw) as MeaningfulMove)
    } catch {}
    if (localStorage.getItem(SKIP_KEY(d))) setMoveSkipped(true)
    try {
      const ev = localStorage.getItem(EVE_KEY(d))
      if (ev) {
        const p = JSON.parse(ev)
        setEveningLearned(p.learned || '')
        setEveningIntention(p.intention || '')
        setEveningLogged(p.logged || false)
      }
    } catch {}
  }, [])

  // Sync carousel scroll position when index changes programmatically
  useEffect(() => {
    if (!carouselRef.current || meaningfulMove || moveSkipped || todayTasks.length === 0) return
    const el = carouselRef.current
    // Each card is ~88% of container width; gap is 12px. Approximate step per card.
    const step = el.clientWidth * 0.88 + 6
    el.scrollTo({ left: carouselIndex * step, behavior: 'smooth' })
  }, [carouselIndex, meaningfulMove, moveSkipped, todayTasks.length])

  useEffect(() => {
    setGreeting(getGreeting())
    setDateLabel(getDateLabel())

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const todayStr = toDateStr(new Date())
      const monday   = getMonday(new Date())
      const weekOf   = toDateStr(monday)

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

      if (!firstRunDone) {
        startTour(user.id, true)
      }

      const earned = await evaluateRewards(user.id, {
        trigger: 'app_opened',
        ctx: { date: todayStr },
      })
      if (earned.length > 0) queueRewards(earned)
      await loadUnseenRewards(user.id)
    }

    load()
  }, [startTour, queueRewards, loadUnseenRewards])

  // ── Meaningful Move helpers ─────────────────────────────────────────────────

  const saveMeaningfulMove = (move: MeaningfulMove) =>
    localStorage.setItem(MOVE_KEY(toDateStr(new Date())), JSON.stringify(move))

  const selectMove = (task: DBTask) => {
    const move: MeaningfulMove = {
      taskId:       task.id,
      taskText:     task.text,
      category:     task.category,
      scheduledTime: task.scheduled_time,
      duration:     task.duration,
      completed:    task.completed,
    }
    saveMeaningfulMove(move)
    setMeaningfulMove(move)
  }

  const skipMove = () => {
    localStorage.setItem(SKIP_KEY(toDateStr(new Date())), '1')
    setMoveSkipped(true)
  }

  // ── Task toggle ─────────────────────────────────────────────────────────────

  const handleToggleTask = async (task: DBTask) => {
    setTodayTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
    setWeekTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
    const ok = await dbToggleTask(task.id, task.completed)
    if (!ok) {
      setTodayTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t))
      setWeekTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t))
      return
    }

    let goalProgress: number | null = null
    if (task.goal_id && userId) {
      const newProgress = await recalcGoalProgressFromTasks(task.goal_id, userId)
      goalProgress = newProgress
      if (newProgress !== null) {
        setGoals(prev => prev.map(g => g.id === task.goal_id ? { ...g, progress: newProgress } : g))
      }
    }

    // Detect Meaningful Move completion — surface STATE 3 modal
    if (!task.completed && meaningfulMove?.taskId === task.id) {
      const updated = { ...meaningfulMove, completed: true }
      saveMeaningfulMove(updated)
      setMeaningfulMove(updated)
      setShowCompletionModal(true)
    }

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
          goalProgress,
        },
      }).then(earned => { if (earned.length > 0) queueRewards(earned) })
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const activeGoals     = goals.filter(g => g.status === 'active')
  const topPriorities   = activeGoals.slice(0, CONSTANTS.TOP_PRIORITIES_LIMIT)
  const completedToday  = todayTasks.filter(t => t.completed).length
  const totalToday      = todayTasks.length
  const todayPlannedHours = Math.round(todayTasks.reduce((s, t) => s + t.duration, 0) * 10) / 10
  const momentumScore   = getMomentumScore(
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
  const reviewState  = getReviewState(hasThisWeekReflection)
  const showCarousel = !meaningfulMove && !moveSkipped && todayTasks.length > 0
  const isEvening    = currentHour >= 17
  const moveTask     = meaningfulMove ? (todayTasks.find(t => t.id === meaningfulMove.taskId) ?? null) : null
  const moveCat      = meaningfulMove ? (CATEGORY_COLORS[meaningfulMove.category] ?? { bg: '#F2F2F7', color: '#8E8E93' }) : null
  const selectedTask = todayTasks[carouselIndex] ?? null

  return (
    <div style={{ padding: '56px 16px 16px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0, letterSpacing: '-0.4px' }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ fontSize: 14, color: '#8E8E93', marginTop: 3 }}>
            {dateLabel}
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
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Morning Touchpoint stat cards (always visible) ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'TASKS TODAY', value: String(totalToday) },
          { label: 'PLANNED',     value: `${todayPlannedHours}h` },
          { label: 'DAY STREAK',  value: streak > 0 ? `${streak} 🔥` : '—' },
        ].map(card => (
          <div key={card.label} style={{
            background: 'white', borderRadius: 14, padding: '12px 8px',
            border: '0.5px solid #E5E5EA', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.05)',
          }}>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#8E8E93', letterSpacing: 0.5, margin: 0, textTransform: 'uppercase' }}>
              {card.label}
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', margin: '4px 0 0', lineHeight: 1, fontFamily: 'var(--font-geist-sans)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.3px' }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Choose Your Move carousel (inline below stat cards) ──────────── */}
      {showCarousel && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', margin: '0 0 14px' }}>
            Choose your move
          </p>

          <div style={{ overflow: 'hidden', marginBottom: 4 }}>
            <div
              ref={carouselRef}
              style={{
                display: 'flex',
                overflowX: 'scroll',
                scrollSnapType: 'x mandatory',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
                paddingLeft: '6%',
                paddingRight: '6%',
                paddingBottom: 20,
                marginBottom: -20,
                gap: 12,
                marginLeft: -16,
                marginRight: -16,
                paddingTop: 4,
              } as React.CSSProperties}
              onScroll={e => {
                const el = e.currentTarget
                const step = el.clientWidth * 0.88 + 6
                const idx  = Math.round(el.scrollLeft / step)
                setCarouselIndex(Math.max(0, Math.min(idx, todayTasks.length - 1)))
              }}
            >
              {todayTasks.map((task, i) => {
                const tCat     = CATEGORY_COLORS[task.category] ?? { bg: '#F2F2F7', color: '#8E8E93' }
                const isActive = i === carouselIndex
                const endTime  = task.scheduled_time && task.duration
                  ? addMinutes(task.scheduled_time, Math.round(task.duration * 60))
                  : null
                return (
                  <div
                    key={task.id}
                    onClick={() => setCarouselIndex(i)}
                    style={{
                      minWidth: 'calc(88% - 6px)',
                      maxWidth: 'calc(88% - 6px)',
                      scrollSnapAlign: 'center',
                      flexShrink: 0,
                      background: 'white',
                      borderRadius: 20,
                      padding: '20px 18px 18px',
                      border: isActive ? '2px solid #3B7DFF' : '1.5px solid #E5E5EA',
                      boxShadow: isActive ? '0 4px 20px rgba(59,125,255,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                  >
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: tCat.bg, color: tCat.color, display: 'inline-block', marginBottom: 12,
                    }}>
                      {task.category || 'Task'}
                    </span>
                    <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px', lineHeight: 1.35 }}>
                      {task.text}
                    </p>
                    {task.scheduled_time && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span style={{ fontSize: 13, color: '#8E8E93' }}>
                          {formatTime(task.scheduled_time)}
                          {endTime ? ` – ${formatTime(endTime)}` : ''}
                        </span>
                      </div>
                    )}
                    <div style={{
                      height: 3, borderRadius: 2,
                      background: isActive ? '#3B7DFF' : '#E5E5EA',
                      width: isActive ? '40%' : '20%',
                      transition: 'width 0.3s ease, background 0.3s ease',
                    }} />
                  </div>
                )
              })}
            </div>
          </div>

          {todayTasks.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16, paddingTop: 8 }}>
              {todayTasks.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCarouselIndex(i)}
                  style={{
                    width: i === carouselIndex ? 20 : 6,
                    height: 6, borderRadius: 3,
                    background: i === carouselIndex ? '#3B7DFF' : '#D1D1D6',
                    border: 'none', cursor: 'pointer', padding: 0,
                    transition: 'width 0.2s ease, background 0.2s ease',
                  }}
                />
              ))}
            </div>
          )}

          <p style={{ fontSize: 15, color: '#3C3C43', textAlign: 'center', lineHeight: 1.65, margin: '0 0 16px' }}>
            {dailyVariant(COPY.carousel_prompt_main, userId || '')}{' '}
            <span style={{ color: '#8E8E93' }}>{dailyVariant(COPY.carousel_prompt_sub, userId || '')}</span>
          </p>

          <button
            onClick={() => selectedTask && selectMove(selectedTask)}
            disabled={!selectedTask}
            style={{
              width: '100%', background: '#3B7DFF', border: 'none', borderRadius: 14,
              padding: '16px', color: 'white', fontSize: 16, fontWeight: 700,
              cursor: selectedTask ? 'pointer' : 'default', fontFamily: 'inherit',
              marginBottom: 10, opacity: selectedTask ? 1 : 0.5,
            }}
          >
            Make this my move
          </button>

          <button
            onClick={skipMove}
            style={{
              width: '100%', background: 'none', border: 'none',
              color: '#8E8E93', fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit', padding: '8px', marginBottom: 6,
            }}
          >
            Skip for now
          </button>
        </>
      )}

      {/* ── One Meaningful Move hero card (shows after move is selected) ── */}
      {meaningfulMove && (
        <div
          data-tour="home-meaningful-move"
          style={{
            background: 'white', borderRadius: 20, padding: '20px 20px 20px 24px',
            marginBottom: 14, border: '1.5px solid #3B7DFF',
            boxShadow: '0 4px 20px rgba(59,125,255,0.10)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: 'linear-gradient(180deg, #3B7DFF 0%, #2D7DFF 100%)',
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#3B7DFF', textTransform: 'uppercase', margin: 0 }}>
              One Meaningful Move
            </p>
            {moveCat && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: moveCat.bg, color: moveCat.color,
              }}>
                {meaningfulMove.category}
              </span>
            )}
          </div>

          <h2 style={{
            fontSize: 20, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px',
            textDecoration: meaningfulMove.completed ? 'line-through' : 'none',
            opacity: meaningfulMove.completed ? 0.45 : 1,
          }}>
            {meaningfulMove.taskText}
          </h2>

          <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 16px' }}>
            {dailyVariant(COPY.move_card_subtitle, userId || '')}
          </p>

          {!meaningfulMove.completed ? (
            <button
              onClick={() => moveTask && handleToggleTask(moveTask)}
              disabled={!moveTask}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#3B7DFF', border: 'none', borderRadius: 10,
                padding: '10px 18px', color: 'white', fontSize: 14, fontWeight: 600,
                cursor: moveTask ? 'pointer' : 'default', fontFamily: 'inherit',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Mark complete
            </button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#34C759',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#34C759' }}>Move complete</span>
            </div>
          )}
        </div>
      )}

      {/* ── Evening Touchpoint (5 pm+, requires move selected) ───────────── */}
      {isEvening && meaningfulMove && !eveningLogged && (
        <div style={{
          background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
          borderRadius: 20, padding: '20px', marginBottom: 14,
          border: '1px solid rgba(221,214,254,0.7)',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(124,58,237,0.10), 0 1px 4px rgba(124,58,237,0.06)',
        }}>
          <div className="card-glass-shimmer-light" />
          <p style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 4px' }}>
            Evening reflection
          </p>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px' }}>
            How did today go, {firstName}?
          </h3>
          <p style={{ fontSize: 13, color: '#6D28D9', margin: '0 0 16px' }}>
            {meaningfulMove.completed
              ? dailyVariant(COPY.evening_completed, userId || '')
              : dailyVariant(COPY.evening_incomplete, userId || '')}
          </p>

          {/* Summary stats */}
          <div style={{ background: 'white', borderRadius: 14, padding: '16px', marginBottom: 12 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#8E8E93', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 12px' }}>
              Today&apos;s summary
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
              {[
                { value: `${completedToday}/${totalToday}`, label: 'Tasks' },
                { value: `${todayPlannedHours}h`,           label: 'Planned' },
                { value: `${momentumScore}`,                 label: 'Momentum', color: '#34C759' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: s.color || '#1C1C1E', margin: 0 }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: '#8E8E93', margin: '2px 0 0' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Meaningful Move Insight card */}
          <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#7C3AED', letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 10px' }}>
              Meaningful Move Insight
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: 0, flex: 1, lineHeight: 1.4 }}>
                {meaningfulMove.taskText}
              </p>
              <span style={{
                fontSize: 11, fontWeight: 600, flexShrink: 0,
                color: meaningfulMove.completed ? '#34C759' : '#FF9500',
                background: meaningfulMove.completed ? 'rgba(52,199,89,0.12)' : 'rgba(255,149,0,0.12)',
                padding: '3px 10px', borderRadius: 20,
              }}>
                {meaningfulMove.completed ? 'Complete' : 'In progress'}
              </span>
            </div>
            {moveCat && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: moveCat.bg, color: moveCat.color, display: 'inline-block', marginTop: 8 }}>
                {meaningfulMove.category}
              </span>
            )}
          </div>

          {/* Reflection inputs */}
          <p style={{ fontSize: 13, color: '#4C1D95', fontWeight: 500, margin: '0 0 8px' }}>
            What&apos;s one thing you learned today?
          </p>
          <textarea
            value={eveningLearned}
            onChange={e => setEveningLearned(e.target.value)}
            placeholder="Your biggest insight or lesson..."
            rows={3}
            style={{
              width: '100%', borderRadius: 12, padding: '12px 14px',
              border: '1px solid #DDD6FE', fontSize: 14, color: '#1C1C1E',
              background: 'white', resize: 'none', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box', marginBottom: 12,
            }}
          />
          <p style={{ fontSize: 13, color: '#4C1D95', fontWeight: 500, margin: '0 0 8px' }}>
            Set tomorrow&apos;s intention
          </p>
          <input
            type="text"
            value={eveningIntention}
            onChange={e => setEveningIntention(e.target.value)}
            placeholder="One thing to focus on tomorrow..."
            style={{
              width: '100%', borderRadius: 12, padding: '12px 14px',
              border: '1px solid #DDD6FE', fontSize: 14, color: '#1C1C1E',
              background: 'white', fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box', marginBottom: 16,
            }}
          />

          <button
            onClick={() => {
              const d = toDateStr(new Date())
              localStorage.setItem(EVE_KEY(d), JSON.stringify({ learned: eveningLearned, intention: eveningIntention, logged: true }))
              setEveningLogged(true)
            }}
            style={{
              width: '100%', background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
              border: 'none', borderRadius: 14, padding: '14px',
              color: 'white', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
            }}
          >
            Log today
          </button>
          <button
            onClick={() => {
              const d = toDateStr(new Date())
              localStorage.setItem(EVE_KEY(d), JSON.stringify({ learned: '', intention: '', logged: true }))
              setEveningLogged(true)
            }}
            style={{
              width: '100%', background: 'none', border: 'none',
              color: '#8E8E93', fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit', padding: '4px',
            }}
          >
            Skip tonight
          </button>
        </div>
      )}

          {/* ── Today's Focus Card ──────────────────────────────────────────── */}
          <div
            data-tour="home-today-card"
            style={{
              background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
              borderRadius: 20, padding: '20px', marginBottom: 14, color: 'white',
              position: 'relative', overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 4px 24px rgba(59,82,255,0.22), 0 1px 4px rgba(59,82,255,0.12)',
            }}
          >
            <div className="card-glass-shimmer" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>{dateLabel}</p>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>Today&apos;s Focus</h2>
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
                {todayTasks.slice(0, 4).map((task, i) => (
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
                ))}
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

          {/* ── Momentum Score Card ─────────────────────────────────────────── */}
          <div style={{ background: 'white', borderRadius: 20, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(255,149,0,0.20), 0 1px 2px rgba(0,0,0,0.06)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF9500" stroke="none">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>Momentum Score</p>
                  <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>Tasks completed vs planned</p>
                </div>
              </div>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#FF9500', fontFamily: 'var(--font-geist-sans)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{momentumScore}</span>
            </div>

            <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${momentumScore}%`,
                background: momentumScore >= 60 ? '#34C759' : momentumScore >= 30 ? '#FF9500' : '#FF3B30',
                borderRadius: 4, transition: 'width 0.6s ease',
              }} />
            </div>

            <p style={{ fontSize: 13, color: '#3C3C43', margin: 0 }}>{getMomentumText(momentumScore, userId || '')}</p>
          </div>

          {/* ── Top Priorities ──────────────────────────────────────────────── */}
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
                body={dailyVariant(COPY.goals_empty_body, userId || '')}
                ctaLabel="Create My First Goal"
                onCta={() => router.push('/dashboard/goals')}
              />
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: 20, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.05)' }}>
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

          {/* ── This Week Card ──────────────────────────────────────────────── */}
          <div style={{ background: 'white', borderRadius: 20, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA', boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.05)' }}>
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

          {/* ── Weekly Review Card ──────────────────────────────────────────── */}
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

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
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

      {/* ── Quick Add Modal ───────────────────────────────────────────────────── */}
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
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 8px ${item.color}30, 0 1px 2px rgba(0,0,0,0.06)` }}>
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

      {/* ═══════════════════════════════════════════════════════════════════════
          STATE 3 — Completion Reward Modal
          ═══════════════════════════════════════════════════════════════════════ */}
      {showCompletionModal && meaningfulMove && (
        <div
          onClick={() => setShowCompletionModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(160deg, #3B52FF 0%, #1D3399 100%)',
              borderRadius: 28, padding: '32px 24px 28px',
              width: '100%', maxWidth: 400,
              textAlign: 'center', position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 24px 60px rgba(59,82,255,0.40)',
            }}
          >
            <div className="card-glass-shimmer" />
            {/* Close button */}
            <button
              onClick={() => setShowCompletionModal(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* "1" circle */}
            <div style={{
              width: 76, height: 76, borderRadius: '50%',
              background: 'rgba(255,255,255,0.10)',
              border: '2.5px solid rgba(255,255,255,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 22px',
            }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: 'white' }}>1</span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'white', margin: '0 0 8px', lineHeight: 1.25 }}>
              {dailyVariant(COPY.completion_heading, userId || '')}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.60)', margin: '0 0 24px' }}>
              {dailyVariant(COPY.completion_subtext, userId || '')}
            </p>

            {/* Task recap card */}
            <div style={{
              background: 'rgba(255,255,255,0.10)',
              borderRadius: 18, padding: '16px',
              marginBottom: 24, textAlign: 'left',
            }}>
              {moveCat && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: moveCat.bg, color: moveCat.color,
                  display: 'inline-block', marginBottom: 10,
                }}>
                  {meaningfulMove.category}
                </span>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0, flex: 1 }}>
                  {meaningfulMove.taskText}
                </p>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#34C759',
                  background: 'rgba(52,199,89,0.18)',
                  padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34C759' }} />
                  Complete
                </span>
              </div>
              {meaningfulMove.scheduledTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    {formatTime(meaningfulMove.scheduledTime)}
                    {meaningfulMove.duration
                      ? ` – ${formatTime(addMinutes(meaningfulMove.scheduledTime, Math.round(meaningfulMove.duration * 60)))}`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            {/* View My Cadence */}
            <button
              onClick={() => { setShowCompletionModal(false); router.push(`/dashboard/plan/daily?date=${toDateStr(new Date())}`) }}
              style={{
                width: '100%', background: 'white', border: 'none', borderRadius: 14,
                padding: '14px', color: '#3B52FF', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12,
              }}
            >
              View My Cadence
            </button>
            <button
              onClick={() => setShowCompletionModal(false)}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)',
                fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: '4px',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
