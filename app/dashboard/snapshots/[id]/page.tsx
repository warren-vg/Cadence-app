'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getMonthlySnapshot,
  updateSnapshotReflection,
  type DBMonthlySnapshot,
} from '@/lib/db'

const CAT_COLORS: Record<string, string> = {
  Career:        '#3B7DFF',
  Health:        '#34C759',
  Personal:      '#FF9500',
  Learning:      '#AF52DE',
  Finance:       '#FF3B30',
  Relationships: '#FF2D55',
  Wellbeing:     '#30B0C7',
  Creative:      '#FF6B35',
}

function catColor(cat: string): string {
  return CAT_COLORS[cat] ?? 'var(--c-text-2)'
}

function WinIcon({ icon }: { icon: string }) {
  if (icon === 'trophy') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
      </svg>
    )
  }
  if (icon === 'ribbon') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#AF52DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/>
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function winIconBg(icon: string): string {
  if (icon === 'trophy') return '#FFF7ED'
  if (icon === 'ribbon') return '#FDF4FF'
  return '#EFF6FF'
}

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

function MomentumChart({ weeks }: { weeks: number[] }) {
  const isDark = useIsDark()
  if (weeks.length < 2) {
    return (
      <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--c-text-2)', margin: 0 }}>Not enough data yet</p>
      </div>
    )
  }

  const W = 280
  const H = 72
  const PAD = { top: 8, right: 8, bottom: 16, left: 8 }
  const max = Math.max(...weeks, 1)
  const min = Math.min(...weeks)
  const range = max - min || 1

  const pts = weeks.map((v, i) => ({
    x: PAD.left + (i / (weeks.length - 1)) * (W - PAD.left - PAD.right),
    y: PAD.top + (1 - (v - min) / range) * (H - PAD.top - PAD.bottom),
  }))

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${(H - PAD.bottom).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(H - PAD.bottom).toFixed(1)} Z`

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 4}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B7DFF" />
          <stop offset="100%" stopColor="#3B7DFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f, i) => (
        <line key={i}
          x1={PAD.left} x2={W - PAD.right}
          y1={PAD.top + f * (H - PAD.top - PAD.bottom)}
          y2={PAD.top + f * (H - PAD.top - PAD.bottom)}
          stroke={isDark ? '#3A3A3C' : '#F2F2F7'} strokeWidth="1"
        />
      ))}
      <path d={areaD} fill="url(#chartGrad)" opacity="0.25" />
      <path d={pathD} fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={isDark ? '#1C1C1E' : 'white'} stroke="#3B7DFF" strokeWidth="2.5" />
      ))}
      {weeks.map((_, i) => (
        <text key={i}
          x={PAD.left + (i / (weeks.length - 1)) * (W - PAD.left - PAD.right)}
          y={H + 2}
          textAnchor="middle" fontSize="10" fill={isDark ? '#636366' : '#8E8E93'}
        >
          W{i + 1}
        </text>
      ))}
    </svg>
  )
}

export default function SnapshotDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params?.id as string

  const [snap, setSnap]             = useState<DBMonthlySnapshot | null>(null)
  const [loading, setLoading]       = useState(true)
  const [reflection, setReflection] = useState('')
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const saveTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const s = await getMonthlySnapshot(user.id, id)
      if (!s)  { router.push('/dashboard/snapshots'); return }
      setSnap(s)
      setReflection(s.user_reflection ?? '')
      setLoading(false)
    }
    init()
  }, [id, router])

  const handleReflectionChange = (val: string) => {
    setReflection(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!snap) return
      setSaving(true)
      await updateSnapshotReflection(snap.id, snap.user_id, val)
      setSaving(false)
    }, 1000)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleShare = async () => {
    if (!snap) return
    const avgMomentum = snap.momentum_weekly.length > 0
      ? Math.round(snap.momentum_weekly.reduce((s, m) => s + m, 0) / snap.momentum_weekly.length)
      : 0
    const lines = [
      `📅 ${snap.month_label} on Cadence`,
      '',
      `✅ ${snap.goals_worked} goal${snap.goals_worked !== 1 ? 's' : ''} worked`,
      `🎯 ${snap.goals_completed} completed (${snap.completion_rate}%)`,
      `⏱ ${snap.hours_logged}h logged`,
      `⚡ Avg momentum: ${avgMomentum}`,
      ...(snap.top_wins.length > 0 ? ['', '🏆 Top wins:'] : []),
      ...snap.top_wins.map(w => `  • ${w.title}`),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      showToast('Copied to clipboard!')
    } catch {
      showToast('Could not copy — try again')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--c-text-2)', fontSize: 15 }}>Loading…</div>
      </div>
    )
  }

  if (!snap) return null

  const avgMomentum = snap.momentum_weekly.length > 0
    ? Math.round(snap.momentum_weekly.reduce((s, m) => s + m, 0) / snap.momentum_weekly.length)
    : 0

  const catEntries  = Object.entries(snap.category_breakdown).sort((a, b) => b[1] - a[1])
  const maxCatHours = catEntries.length > 0 ? catEntries[0][1] : 1

  return (
    <div style={{ padding: '56px 16px 40px' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: '#1C1C1E', color: 'white', borderRadius: 20,
          padding: '10px 20px', fontSize: 14, fontWeight: 500,
          zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <button
          onClick={() => router.push('/dashboard/snapshots')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Snapshots
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 3px' }}>{snap.month_label}</h1>
        <p style={{ fontSize: 14, color: 'var(--c-text-2)', margin: 0 }}>
          Your {snap.month_label.split(' ')[0]} at a glance.
        </p>
      </div>

      {/* 2×2 Hero Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Goals Worked',    value: snap.goals_worked,              iconKey: 'target', bg: '#F0FFF4', stroke: '#34C759' },
          { label: 'Goals Completed', value: snap.goals_completed,           iconKey: 'check',  bg: '#EFF6FF', stroke: '#3B7DFF' },
          { label: 'Completion Rate', value: `${snap.completion_rate}%`,     iconKey: 'chart',  bg: '#FDF4FF', stroke: '#AF52DE' },
          { label: 'Hours Logged',    value: `${snap.hours_logged}h`,        iconKey: 'clock',  bg: '#FFF7ED', stroke: '#FF9500' },
        ].map(({ label, value, iconKey, bg, stroke }) => (
          <div key={label} style={{
            background: 'var(--c-surface)', borderRadius: 16,
            padding: '16px 14px', border: '0.5px solid var(--c-border)',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: 10,
            }}>
              {iconKey === 'target' && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                </svg>
              )}
              {iconKey === 'check' && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
              {iconKey === 'chart' && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                  <polyline points="16 7 22 7 22 13"/>
                </svg>
              )}
              {iconKey === 'clock' && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              )}
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 2px', lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-2)', margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Top Wins */}
      {snap.top_wins.length > 0 && (
        <div style={{ background: 'var(--c-surface)', borderRadius: 18, padding: '18px 16px', border: '0.5px solid var(--c-border)', marginBottom: 14 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 14px' }}>Top Wins</p>
          {snap.top_wins.map((win, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              paddingBottom: i < snap.top_wins.length - 1 ? 12 : 0,
              borderBottom: i < snap.top_wins.length - 1 ? '0.5px solid var(--c-border-sub)' : 'none',
              marginBottom: i < snap.top_wins.length - 1 ? 12 : 0,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: winIconBg(win.icon),
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <WinIcon icon={win.icon} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)', margin: '0 0 2px' }}>{win.title}</p>
                <p style={{ fontSize: 12, color: 'var(--c-text-2)', margin: 0 }}>{win.description}</p>
              </div>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: catColor(win.category), marginTop: 6,
              }} />
            </div>
          ))}
        </div>
      )}

      {/* Category Breakdown */}
      {catEntries.length > 0 && (
        <div style={{ background: 'var(--c-surface)', borderRadius: 18, padding: '18px 16px', border: '0.5px solid var(--c-border)', marginBottom: 14 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 14px' }}>Category Breakdown</p>
          {catEntries.map(([cat, hours], i) => (
            <div key={cat} style={{ marginBottom: i < catEntries.length - 1 ? 12 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-mid)', margin: 0 }}>{cat}</p>
                <p style={{ fontSize: 13, color: 'var(--c-text-2)', margin: 0 }}>{hours}h</p>
              </div>
              <div style={{ height: 6, background: 'var(--c-border-sub)', borderRadius: 3 }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: catColor(cat),
                  width: `${Math.round((hours / maxCatHours) * 100)}%`,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Momentum Trend */}
      {snap.momentum_weekly.length > 0 && (
        <div style={{ background: 'var(--c-surface)', borderRadius: 18, padding: '18px 16px', border: '0.5px solid var(--c-border)', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Momentum Trend</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#3B7DFF', margin: 0 }}>Avg {avgMomentum}</p>
          </div>
          <div style={{ paddingBottom: 10 }}>
            <MomentumChart weeks={snap.momentum_weekly} />
          </div>
        </div>
      )}

      {/* Reflection */}
      <div style={{ background: 'var(--c-surface)', borderRadius: 18, padding: '18px 16px', border: '0.5px solid var(--c-border)', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>What This Month Meant</p>
          {saving && <p style={{ fontSize: 12, color: 'var(--c-text-2)', margin: 0 }}>Saving…</p>}
        </div>
        <textarea
          value={reflection}
          onChange={e => handleReflectionChange(e.target.value)}
          placeholder="How did this month feel? What did you learn? What would you do differently?"
          style={{
            width: '100%', minHeight: 110, fontSize: 14, color: 'var(--c-text-1)',
            lineHeight: 1.6, padding: '10px 0', border: 'none', outline: 'none',
            resize: 'none', fontFamily: 'inherit', background: 'transparent',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Share */}
      <button
        onClick={handleShare}
        style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
          background: 'linear-gradient(135deg, #3B7DFF 0%, #AF52DE 100%)',
          color: 'white', fontSize: 16, fontWeight: 700, letterSpacing: 0.2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Share This Snapshot
      </button>
    </div>
  )
}
