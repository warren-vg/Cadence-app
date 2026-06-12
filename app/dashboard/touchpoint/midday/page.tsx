'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toDateStr } from '@/lib/planData'
import { getTasksForDate, type DBTask } from '@/lib/db'

function CircularRing({ pct, size = 140 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={10} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="white" strokeWidth={10} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  )
}

export default function MiddayTouchpointPage() {
  const router = useRouter()
  const [visible, setVisible]             = useState(false)
  const [loaded, setLoaded]               = useState(false)
  const [firstName, setFirstName]         = useState('there')
  const [morningDone, setMorningDone]     = useState(0)
  const [morningTotal, setMorningTotal]   = useState(0)
  const [afternoonCount, setAfternoonCount] = useState(0)
  const [afternoonHours, setAfternoonHours] = useState(0)
  const [completionPct, setCompletionPct] = useState(0)
  const [displayPct, setDisplayPct]       = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const today = toDateStr(new Date())
      const [{ data: profile }, tasks] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
        getTasksForDate(user.id, today),
      ])

      setFirstName((profile?.full_name ?? '').split(' ')[0] || 'there')

      const morning: DBTask[] = tasks.filter(t => {
        const h = parseInt((t.scheduled_time || '12:00').split(':')[0], 10)
        return h < 12
      })
      const afternoon: DBTask[] = tasks.filter(t => {
        const h = parseInt((t.scheduled_time || '12:00').split(':')[0], 10)
        return h >= 12
      })

      const mDone = morning.filter(t => t.completed).length
      const mTotal = morning.length
      const aftCount = afternoon.filter(t => !t.completed).length
      const aftHours = parseFloat(
        afternoon.filter(t => !t.completed).reduce((s, t) => s + t.duration, 0).toFixed(1)
      )

      const totalDone = tasks.filter(t => t.completed).length
      const pct = tasks.length > 0 ? Math.round((totalDone / tasks.length) * 100) : 0

      setMorningDone(mDone)
      setMorningTotal(mTotal)
      setAfternoonCount(aftCount)
      setAfternoonHours(aftHours)
      setCompletionPct(pct)
      setLoaded(true)
      requestAnimationFrame(() => setVisible(true))
    }
    init()
  }, [])

  // Animate ring pct
  useEffect(() => {
    if (!visible) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { setDisplayPct(completionPct); return }
    let current = 0
    const id = setInterval(() => {
      current = Math.min(current + 2, completionPct)
      setDisplayPct(current)
      if (current >= completionPct) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [visible, completionPct])

  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #48B4E0 0%, #3B7DFF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: '_tp_spin 0.8s linear infinite' }} />
        <style>{`@keyframes _tp_spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #48B4E0 0%, #3B7DFF 100%)',
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

      <div style={{ flex: 1, padding: '64px 20px 32px', maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>

        {/* Header */}
        <div style={{
          width: '100%',
          opacity: visible ? 1 : 0,
          animation: visible ? '_tp_fadeUp 0.5s ease forwards' : 'none',
        }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: '0 0 6px', fontWeight: 500 }}>
            Midday check-in
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: 'white', margin: 0, lineHeight: 1.1 }}>
            How's your day going, {firstName}?
          </h1>
        </div>

        {/* Progress Ring */}
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: visible ? 1 : 0,
          animation: visible ? '_tp_fadeUp 0.5s ease 0.1s forwards' : 'none',
        }}>
          <CircularRing pct={displayPct} size={160} />
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <p style={{ fontSize: 36, fontWeight: 800, color: 'white', margin: 0, lineHeight: 1 }}>{displayPct}%</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0', fontWeight: 500 }}>done</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'flex', gap: 12, width: '100%',
          opacity: visible ? 1 : 0,
          animation: visible ? '_tp_fadeUp 0.5s ease 0.2s forwards' : 'none',
        }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '18px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>
              {morningDone}/{morningTotal}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0, fontWeight: 500 }}>morning tasks</p>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '18px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{afternoonCount}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0, fontWeight: 500 }}>afternoon left</p>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '18px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{afternoonHours}h</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0, fontWeight: 500 }}>remaining</p>
          </div>
        </div>

        {/* Insight */}
        <div style={{
          width: '100%',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 14, padding: '14px 16px',
          opacity: visible ? 1 : 0,
          animation: visible ? '_tp_fadeUp 0.5s ease 0.3s forwards' : 'none',
        }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.5 }}>
            {completionPct >= 75
              ? '🎉 Strong morning! You\'re well on track for today.'
              : completionPct >= 40
              ? '⚡ Good pace. Your afternoon has real potential.'
              : afternoonCount > 0
              ? `📋 ${afternoonCount} task${afternoonCount !== 1 ? 's' : ''} ahead — adjust your plan if needed.`
              : '✓ No afternoon tasks — you\'re free to focus.'}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 48px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <button
          onClick={() => router.push('/dashboard/plan/daily')}
          style={{
            width: '100%', padding: '18px', border: 'none', borderRadius: 16,
            background: 'white', color: '#3B7DFF',
            fontSize: 17, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
            animation: visible ? '_tp_pulse 2.5s ease-in-out 1s infinite' : 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          Adjust afternoon →
        </button>
      </div>
    </div>
  )
}
