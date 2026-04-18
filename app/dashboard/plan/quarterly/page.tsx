'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCatStyle } from '@/lib/planData'
import { supabase } from '@/lib/supabase'

interface GoalRow {
  id: string
  text: string
  category: string
  progress: number
  priority: number
  quarter?: string | null
}

interface KeyEvent {
  id: string
  label: string
  note: string
}

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

const QUARTER_DATES: Record<Quarter, { label: string; months: string }> = {
  Q1: { label: 'Q1 2026', months: 'Jan – Mar' },
  Q2: { label: 'Q2 2026', months: 'Apr – Jun' },
  Q3: { label: 'Q3 2026', months: 'Jul – Sep' },
  Q4: { label: 'Q4 2026', months: 'Oct – Dec' },
}

const QUARTER_THEMES: Record<Quarter, string> = {
  Q1: 'Foundation & Planning',
  Q2: 'Growth & Execution',
  Q3: 'Scale & Optimize',
  Q4: 'Reflect & Accelerate',
}

const QUARTER_FOCUS: Record<Quarter, string> = {
  Q1: 'Build systems and establish habits',
  Q2: 'Launch consulting brand and creative projects',
  Q3: 'Scale what works, cut what doesn\'t',
  Q4: 'Year-end push and 2027 planning',
}

function getCurrentQuarter(): Quarter {
  const m = new Date().getMonth()
  if (m < 3) return 'Q1'
  if (m < 6) return 'Q2'
  if (m < 9) return 'Q3'
  return 'Q4'
}

const SEED_EVENTS: KeyEvent[] = [
  { id: 'e1', label: 'May 15-20: Client project deadline', note: 'Limited availability for other work' },
]

export default function QuarterlyPlannerPage() {
  const router = useRouter()
  const [activeQ, setActiveQ] = useState<Quarter>(getCurrentQuarter())
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [events, setEvents] = useState<KeyEvent[]>(SEED_EVENTS)
  const [newEvent, setNewEvent] = useState('')
  const [addingEvent, setAddingEvent] = useState(false)
  const [locked, setLocked] = useState<Record<Quarter, boolean>>({ Q1: false, Q2: false, Q3: false, Q4: false })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('goals').select('*').eq('user_id', user.id).eq('status', 'active')
        .order('priority', { ascending: true })
      setGoals(data || [])
    }
    load()

    // Load locked state from localStorage
    try {
      const raw = localStorage.getItem('cadence_quarter_locked')
      if (raw) setLocked(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  if (!mounted) return null

  const quarterGoals = goals.filter(g => g.quarter === activeQ || !g.quarter)
  const theme = QUARTER_THEMES[activeQ]
  const focus = QUARTER_FOCUS[activeQ]

  const handleLock = () => {
    const updated = { ...locked, [activeQ]: !locked[activeQ] }
    setLocked(updated)
    localStorage.setItem('cadence_quarter_locked', JSON.stringify(updated))
  }

  const handleAddEvent = () => {
    if (!newEvent.trim()) return
    setEvents(prev => [...prev, { id: `e-${Date.now()}`, label: newEvent.trim(), note: '' }])
    setNewEvent('')
    setAddingEvent(false)
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
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Quarterly Planner</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>Map your goals across the year</p>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Quarter Tabs */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          background: 'white', borderRadius: 14, padding: '4px',
          border: '0.5px solid #E5E5EA', marginBottom: 16,
        }}>
          {(['Q1', 'Q2', 'Q3', 'Q4'] as Quarter[]).map(q => (
            <button
              key={q}
              onClick={() => setActiveQ(q)}
              style={{
                padding: '9px 4px', borderRadius: 10,
                background: activeQ === q ? '#3B7DFF' : 'transparent',
                border: 'none',
                fontSize: 13, fontWeight: activeQ === q ? 600 : 400,
                color: activeQ === q ? 'white' : '#8E8E93',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {QUARTER_DATES[q].label.split(' ')[0]}
              <br />
              <span style={{ fontSize: 10 }}>2026</span>
            </button>
          ))}
        </div>

        {/* Quarter Theme */}
        <div style={{
          background: locked[activeQ]
            ? 'linear-gradient(135deg, #1C1C1E 0%, #3C3C43 100%)'
            : 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
          borderRadius: 18, padding: '20px',
          marginBottom: 14, color: 'white',
        }}>
          <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 4px' }}>Quarter Theme</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>{theme}</h2>
          <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>Focus: {focus}</p>
          {locked[activeQ] && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Quarter locked</span>
            </div>
          )}
        </div>

        {/* Goals */}
        <div style={{
          background: 'white', borderRadius: 16, padding: '18px',
          border: '0.5px solid #E5E5EA', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Goals</p>
            <button
              onClick={() => router.push('/dashboard/goals/evaluate')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#3B7DFF', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Goal
            </button>
          </div>

          {quarterGoals.length === 0 ? (
            <p style={{ fontSize: 14, color: '#8E8E93', margin: 0, textAlign: 'center', padding: '20px 0' }}>
              No active goals for this quarter.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {quarterGoals.map((goal, i) => {
                const catStyle = getCatStyle(goal.category)
                return (
                  <div key={goal.id} style={{ background: '#F8F8FC', borderRadius: 12, padding: '14px' }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E', margin: '0 0 8px' }}>{goal.text}</p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        background: catStyle.bg, color: catStyle.color,
                        padding: '2px 8px', borderRadius: 20,
                      }}>{goal.category}</span>
                      <span style={{ fontSize: 12, color: '#8E8E93', background: '#F2F2F7', padding: '2px 8px', borderRadius: 20 }}>
                        Priority #{i + 1}
                      </span>
                    </div>
                    <div style={{ background: '#E5E5EA', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${goal.progress || 0}%`, background: '#3B7DFF', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Key Events & Blocks */}
        <div style={{
          background: 'white', borderRadius: 16, padding: '18px',
          border: '0.5px solid #E5E5EA', marginBottom: 14,
        }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Key Events & Blocks</p>

          {events.map(ev => (
            <div key={ev.id} style={{
              background: '#FFFBEB', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
              border: '1px solid #FDE68A',
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#92400E', margin: '0 0 2px' }}>{ev.label}</p>
              {ev.note && <p style={{ fontSize: 13, color: '#B45309', margin: 0 }}>{ev.note}</p>}
            </div>
          ))}

          {addingEvent ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={newEvent}
                onChange={e => setNewEvent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
                placeholder="Event description..."
                autoFocus
                style={{
                  flex: 1, border: '0.5px solid #E5E5EA', borderRadius: 8,
                  padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button onClick={handleAddEvent} style={{ padding: '10px 14px', borderRadius: 8, background: '#3B7DFF', border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
              <button onClick={() => setAddingEvent(false)} style={{ padding: '10px 12px', borderRadius: 8, background: '#F2F2F7', border: 'none', color: '#3C3C43', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingEvent(true)}
              style={{
                width: '100%', padding: '12px', borderRadius: 10, marginTop: 4,
                background: 'none', border: '0.5px dashed #D1D1D6', color: '#8E8E93',
                fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Event
            </button>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Generate Plan
          </button>
          <button
            onClick={handleLock}
            style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: locked[activeQ] ? '#1C1C1E' : '#1C1C1E',
              border: 'none', color: 'white',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {locked[activeQ]
                ? <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>
                : <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>
              }
            </svg>
            {locked[activeQ] ? 'Unlock Quarter' : 'Lock Quarter'}
          </button>
        </div>
      </div>
    </div>
  )
}
