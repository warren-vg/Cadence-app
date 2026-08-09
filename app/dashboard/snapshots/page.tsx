'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ensureMonthlySnapshot, getMonthlySnapshots, type DBMonthlySnapshot } from '@/lib/db'

function useIsDark() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

function MiniMomentumBars({ weeks }: { weeks: number[] }) {
  if (!weeks.length) return <div style={{ height: 8 }} />
  const max = Math.max(...weeks, 1)
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28, marginTop: 8 }}>
      {weeks.map((score, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            height: Math.max(4, Math.round((score / max) * 24)),
            background: '#3B7DFF', borderRadius: '3px 3px 0 0',
          }} />
        </div>
      ))}
      {/* pad to 4 bars if fewer */}
      {weeks.length < 4 && Array.from({ length: 4 - weeks.length }).map((_, i) => (
        <div key={`pad-${i}`} style={{ flex: 1, height: 4, background: 'var(--c-border-sub)', borderRadius: '3px 3px 0 0' }} />
      ))}
    </div>
  )
}

export default function SnapshotsPage() {
  const router = useRouter()
  const isDark = useIsDark()
  const [snapshots, setSnapshots] = useState<DBMonthlySnapshot[]>([])
  const [loading, setLoading]     = useState(true)

  // Next snapshot date: last day of current month
  const now            = new Date()
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const nextSnapshotDate = lastDayOfMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Lazy generation: ensure previous month snapshot exists
      await ensureMonthlySnapshot(user.id)

      const data = await getMonthlySnapshots(user.id)
      setSnapshots(data)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--c-text-2)', fontSize: 15 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '56px 16px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 3px' }}>Monthly Snapshots</h1>
        <p style={{ fontSize: 14, color: 'var(--c-text-2)', margin: 0 }}>Your story, month by month.</p>
      </div>

      {/* Coming Soon card — current month hasn't ended */}
      <div style={{
        background: 'var(--c-surface)', borderRadius: 18, padding: '28px 20px',
        border: '0.5px solid var(--c-border)', marginBottom: 14, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#EFF6FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 8px' }}>Coming Soon</p>
        <p style={{ fontSize: 14, color: 'var(--c-text-2)', lineHeight: 1.5, margin: 0 }}>
          Your next snapshot will be ready on <strong style={{ color: 'var(--c-text-1)' }}>{nextSnapshotDate}</strong>.{' '}
          Check back then to see your story.
        </p>
      </div>

      {/* Snapshot list */}
      {snapshots.map(snap => {
        const avgMomentum = snap.momentum_weekly.length > 0
          ? Math.round(snap.momentum_weekly.reduce((s, m) => s + m, 0) / snap.momentum_weekly.length)
          : 0
        const totalTasks = snap.goals_worked > 0 || snap.completion_rate > 0
          ? Math.round((snap.completion_rate > 0 ? snap.hours_logged / snap.completion_rate * 100 : snap.hours_logged) / 1)
          : 0

        return (
          <button
            key={snap.id}
            onClick={() => router.push(`/dashboard/snapshots/${snap.id}`)}
            style={{
              width: '100%', background: 'var(--c-surface)', borderRadius: 16,
              padding: '16px 18px', border: '0.5px solid var(--c-border)',
              marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>{snap.month_label}</p>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#636366' : '#C7C7CC'} strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
            <p style={{ fontSize: 13, color: 'var(--c-text-2)', margin: '0 0 10px' }}>
              {snap.goals_worked} goal{snap.goals_worked !== 1 ? 's' : ''} worked{totalTasks > 0 ? ` · ${snap.hours_logged}h logged` : ''}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
                Weekly Momentum
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>{avgMomentum}</p>
            </div>
            <MiniMomentumBars weeks={snap.momentum_weekly} />
          </button>
        )
      })}

      {snapshots.length === 0 && (
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--c-text-2)', marginTop: 8 }}>
          Your first snapshot will appear here at the end of the month.
        </p>
      )}
    </div>
  )
}
