'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toDateStr, getMonday, getMomentumScore } from '@/lib/planData'
import {
  getTasksForDate, getTasksForWeek, getWeekStreakFromDB,
  upsertDailyReflection, getDailyReflectionForDate,
} from '@/lib/db'

export default function EveningTouchpointPage() {
  const router = useRouter()
  const [loaded, setLoaded]               = useState(false)
  const [visible, setVisible]             = useState(false)
  const [userId, setUserId]               = useState<string | null>(null)
  const [firstName, setFirstName]         = useState('there')
  const [tasksCompleted, setTasksCompleted] = useState(0)
  const [totalTasks, setTotalTasks]       = useState(0)
  const [hoursLogged, setHoursLogged]     = useState(0)
  const [momentumScore, setMomentumScore] = useState(0)
  const [learned, setLearned]             = useState('')
  const [intention, setIntention]         = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [submitted, setSubmitted]         = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const today = toDateStr(new Date())
      localStorage.setItem('cadence_tp_evening_' + today, '1')
      const monday = getMonday(new Date())

      const [{ data: profile }, todayTasks, weekTasks, streak, existing] = await Promise.all([
        supabase.from('profiles').select('full_name, weekly_capacity').eq('id', user.id).single(),
        getTasksForDate(user.id, today),
        getTasksForWeek(user.id, monday),
        getWeekStreakFromDB(user.id),
        getDailyReflectionForDate(user.id, today),
      ])

      setUserId(user.id)
      setFirstName((profile?.full_name ?? '').split(' ')[0] || 'there')

      const done = todayTasks.filter(t => t.completed)
      setTasksCompleted(done.length)
      setTotalTasks(todayTasks.length)
      const hours = parseFloat(done.reduce((s, t) => s + t.duration, 0).toFixed(1))
      setHoursLogged(hours)

      const { data: goalsData } = await supabase
        .from('goals').select('status, progress, estimated_weekly_hours').eq('user_id', user.id)
      const score = getMomentumScore(
        (goalsData ?? []).map(g => ({ status: g.status, progress: g.progress, estimatedWeeklyHours: g.estimated_weekly_hours ?? null })),
        weekTasks,
        streak,
        profile?.weekly_capacity ?? 0,
      )
      setMomentumScore(score)

      if (existing?.evening_completed) {
        setLearned(existing.one_thing_learned ?? '')
        setIntention(existing.tomorrow_intention ?? '')
        setSubmitted(true)
      }

      setLoaded(true)
      requestAnimationFrame(() => setVisible(true))
    }
    init()
  }, [])

  const handleSubmit = async () => {
    if (!userId || submitting) return
    setSubmitting(true)
    const today = toDateStr(new Date())
    const ok = await upsertDailyReflection(userId, today, {
      evening_completed: true,
      one_thing_learned: learned.trim() || null,
      tomorrow_intention: intention.trim() || null,
      tasks_completed: tasksCompleted,
      hours_logged: hoursLogged,
    })
    if (ok) {
      setSubmitted(true)
      setTimeout(() => router.push('/dashboard'), 1400)
    } else {
      setSubmitting(false)
    }
  }

  const momentumColor = momentumScore >= 75 ? '#34C759' : momentumScore >= 50 ? '#FF9500' : '#FF3B30'

  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #9333EA 0%, #6B21A8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: '_tp_spin 0.8s linear infinite' }} />
        <style>{`@keyframes _tp_spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #9333EA 0%, #6B21A8 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      <style>{`
        @keyframes _tp_fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
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
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: '0 0 6px', fontWeight: 500 }}>
            Evening reflection
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: 'white', margin: 0, lineHeight: 1.15 }}>
            {submitted
              ? `Well done, ${firstName}.`
              : `Close out your day, ${firstName}.`}
          </h1>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'flex', gap: 12,
          opacity: visible ? 1 : 0,
          animation: visible ? '_tp_fadeUp 0.5s ease 0.1s forwards' : 'none',
        }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', borderRadius: 16, padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{tasksCompleted}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>
              {totalTasks > 0 ? `of ${totalTasks} done` : 'tasks done'}
            </p>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', borderRadius: 16, padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{hoursLogged}h</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>logged</p>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', borderRadius: 16, padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: momentumColor, margin: '0 0 4px' }}>{momentumScore}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>momentum</p>
          </div>
        </div>

        {/* Reflection Form */}
        <div style={{
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 20, padding: '20px',
          opacity: visible ? 1 : 0,
          animation: visible ? '_tp_fadeUp 0.5s ease 0.2s forwards' : 'none',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9333EA', letterSpacing: 0.8, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              One thing I learned today
            </label>
            <textarea
              value={learned}
              onChange={e => setLearned(e.target.value)}
              disabled={submitted}
              placeholder="What did today teach you?"
              rows={3}
              style={{
                width: '100%', border: '1.5px solid var(--c-border)', borderRadius: 12,
                padding: '12px', fontSize: 15, color: 'var(--c-text-1)',
                fontFamily: 'inherit', resize: 'none', outline: 'none',
                background: submitted ? '#F9F9F9' : 'var(--c-surface)',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9333EA', letterSpacing: 0.8, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              My intention for tomorrow
            </label>
            <textarea
              value={intention}
              onChange={e => setIntention(e.target.value)}
              disabled={submitted}
              placeholder="What matters most tomorrow?"
              rows={3}
              style={{
                width: '100%', border: '1.5px solid var(--c-border)', borderRadius: 12,
                padding: '12px', fontSize: 15, color: 'var(--c-text-1)',
                fontFamily: 'inherit', resize: 'none', outline: 'none',
                background: submitted ? '#F9F9F9' : 'var(--c-surface)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 48px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {submitted ? (
          <div style={{
            width: '100%', padding: '18px', borderRadius: 16,
            background: 'rgba(255,255,255,0.25)', textAlign: 'center',
          }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0 }}>
              ✓ Logged — rest well.
            </p>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%', padding: '18px', border: 'none', borderRadius: 16,
              background: 'var(--c-surface)', color: '#9333EA',
              fontSize: 17, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
              fontFamily: 'inherit', opacity: submitting ? 0.7 : 1,
              animation: visible ? '_tp_pulse 2.5s ease-in-out 1s infinite' : 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            {submitting ? 'Saving…' : 'Log today →'}
          </button>
        )}
      </div>
    </div>
  )
}
