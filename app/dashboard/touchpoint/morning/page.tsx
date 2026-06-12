'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toDateStr } from '@/lib/planData'
import { getTasksForDate, getMorningStreak, upsertDailyReflection, type DBTask } from '@/lib/db'

export default function MorningTouchpointPage() {
  const router = useRouter()
  const [loaded, setLoaded]       = useState(false)
  const [visible, setVisible]     = useState(false)
  const [userId, setUserId]       = useState<string | null>(null)
  const [firstName, setFirstName] = useState('there')
  const [oneTask, setOneTask]     = useState<DBTask | null>(null)
  const [taskCount, setTaskCount] = useState(0)
  const [totalHours, setTotalHours] = useState(0)
  const [streak, setStreak]       = useState(0)
  const [displayStreak, setDisplayStreak] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const streakRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const today = toDateStr(new Date())
      const [{ data: profile }, tasks, s] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        getTasksForDate(user.id, today),
        getMorningStreak(user.id),
      ])

      setUserId(user.id)
      setFirstName((profile?.full_name ?? '').split(' ')[0] || 'there')
      setStreak(s)

      const incomplete = tasks.filter(t => !t.completed)
      const sorted = [...incomplete].sort((a, b) =>
        (a.scheduled_time || '99:99').localeCompare(b.scheduled_time || '99:99')
      )
      setOneTask(sorted[0] ?? tasks[0] ?? null)
      setTaskCount(tasks.length)
      setTotalHours(parseFloat(tasks.reduce((acc, t) => acc + t.duration, 0).toFixed(1)))

      setLoaded(true)
      requestAnimationFrame(() => setVisible(true))
    }
    init()
  }, [])

  // Count-up animation for streak
  useEffect(() => {
    if (!visible || streak === 0) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { setDisplayStreak(streak); return }

    let current = 0
    const step = Math.max(1, Math.floor(streak / 20))
    streakRef.current = setInterval(() => {
      current = Math.min(current + step, streak)
      setDisplayStreak(current)
      if (current >= streak && streakRef.current) clearInterval(streakRef.current)
    }, 40)
    return () => { if (streakRef.current) clearInterval(streakRef.current) }
  }, [visible, streak])

  const handleStart = async () => {
    if (!userId || submitting) return
    setSubmitting(true)
    await upsertDailyReflection(userId, toDateStr(new Date()), { morning_completed: true })
    router.push('/dashboard/plan/daily')
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FF9A56 0%, #FF6B35 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: '_tp_spin 0.8s linear infinite' }} />
        <style>{`@keyframes _tp_spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #FF9A56 0%, #FF6B35 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes _tp_fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes _tp_fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes _tp_pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.03); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div style={{ flex: 1, padding: '64px 20px 32px', maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{
          opacity: visible ? 1 : 0,
          animation: visible ? '_tp_fadeUp 0.5s ease forwards' : 'none',
        }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: '0 0 6px', fontWeight: 500, letterSpacing: 0.3 }}>
            {greeting}, {firstName}
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'white', margin: 0, lineHeight: 1.1 }}>
            Let's make today count.
          </h1>
        </div>

        {/* One Thing Card */}
        <div style={{
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 20,
          padding: '22px 20px',
          border: '1px solid rgba(255,255,255,0.6)',
          opacity: visible ? 1 : 0,
          animation: visible ? '_tp_fadeUp 0.5s ease 0.1s forwards' : 'none',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#FF6B35', letterSpacing: 1.2, margin: '0 0 10px', textTransform: 'uppercase' }}>
            Today's one thing
          </p>
          {oneTask ? (
            <>
              <p style={{ fontSize: 19, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px', lineHeight: 1.3 }}>
                {oneTask.text}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {oneTask.scheduled_time && (
                  <span style={{ fontSize: 13, color: '#8E8E93', background: '#F2F2F7', borderRadius: 8, padding: '4px 10px' }}>
                    {oneTask.scheduled_time}
                  </span>
                )}
                {oneTask.duration > 0 && (
                  <span style={{ fontSize: 13, color: '#8E8E93', background: '#F2F2F7', borderRadius: 8, padding: '4px 10px' }}>
                    {oneTask.duration}h
                  </span>
                )}
                {oneTask.category && (
                  <span style={{ fontSize: 13, color: '#8E8E93', background: '#F2F2F7', borderRadius: 8, padding: '4px 10px' }}>
                    {oneTask.category}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 16, color: '#8E8E93', margin: 0 }}>
              No tasks scheduled yet — add some from your daily plan.
            </p>
          )}
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'flex', gap: 12,
          opacity: visible ? 1 : 0,
          animation: visible ? '_tp_fadeUp 0.5s ease 0.2s forwards' : 'none',
        }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.25)', borderRadius: 16, padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{taskCount}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0, fontWeight: 500 }}>tasks today</p>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.25)', borderRadius: 16, padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{totalHours}h</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0, fontWeight: 500 }}>planned</p>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.25)', borderRadius: 16, padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{displayStreak}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0, fontWeight: 500 }}>day streak</p>
          </div>
        </div>

        {/* Streak message */}
        {streak > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 14, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            opacity: visible ? 1 : 0,
            animation: visible ? '_tp_fadeIn 0.5s ease 0.3s forwards' : 'none',
          }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <p style={{ fontSize: 14, color: 'white', margin: 0, fontWeight: 500 }}>
              {streak === 1
                ? 'First check-in! Keep it going tomorrow.'
                : `${streak}-day morning rhythm — you're building something real.`}
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 48px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <button
          onClick={handleStart}
          disabled={submitting}
          style={{
            width: '100%', padding: '18px', border: 'none', borderRadius: 16,
            background: 'white', color: '#FF6B35',
            fontSize: 17, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
            opacity: submitting ? 0.7 : 1,
            animation: visible ? '_tp_pulse 2.5s ease-in-out 1s infinite' : 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          {submitting ? 'Starting…' : 'Start my day →'}
        </button>
      </div>
    </div>
  )
}
