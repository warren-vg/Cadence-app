'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCatStyle } from '@/lib/planData'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/app/dashboard/components/EmptyState'

interface GoalRow {
  id: string
  text: string
  category: string
  progress: number
  priority: number
  quarter?: string | null
}

// D4: structured event type replaces the old { id, label, note } shape
interface KeyEvent {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  type: 'vacation' | 'event' | 'block'
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

// D1: prior-quarter lookup for carry-forward scoring
const PREV_QUARTER: Record<Quarter, Quarter> = { Q1: 'Q4', Q2: 'Q1', Q3: 'Q2', Q4: 'Q3' }

// D4: visual style per event type
const EVENT_STYLE: Record<string, { bg: string; border: string; title: string; sub: string }> = {
  vacation: { bg: '#F0FDF4', border: '#86EFAC', title: '#166534', sub: '#15803D' },
  event:    { bg: '#FFFBEB', border: '#FDE68A', title: '#92400E', sub: '#B45309' },
  block:    { bg: '#FEF2F2', border: '#FECACA', title: '#991B1B', sub: '#DC2626' },
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

function getCurrentQuarter(): Quarter {
  const m = new Date().getMonth()
  if (m < 3) return 'Q1'
  if (m < 6) return 'Q2'
  if (m < 9) return 'Q3'
  return 'Q4'
}

export default function QuarterlyPlannerPage() {
  const router = useRouter()
  const [activeQ, setActiveQ]   = useState<Quarter>(getCurrentQuarter())
  const [goals, setGoals]       = useState<GoalRow[]>([])
  const [userId, setUserId]     = useState<string | null>(null)
  const [mounted, setMounted]   = useState(false)

  // D2: DB-backed lock state
  const [locked, setLocked] = useState<Record<Quarter, boolean>>({ Q1: false, Q2: false, Q3: false, Q4: false })

  // D4: DB-backed events; reloaded per quarter
  const [events, setEvents]           = useState<KeyEvent[]>([])
  const [addingEvent, setAddingEvent] = useState(false)
  const [newTitle, setNewTitle]       = useState('')
  const [newStart, setNewStart]       = useState('')
  const [newEnd, setNewEnd]           = useState('')
  const [newType, setNewType]         = useState<'vacation' | 'event' | 'block'>('event')

  // D1: generate-plan suggestions
  const [suggestions, setSuggestions]         = useState<GoalRow[]>([])
  const [showSuggestModal, setShowSuggestModal] = useState(false)
  const [generatingPlan, setGeneratingPlan]   = useState(false)
  const isDark = useIsDark()

  // Initial load: goals + lock state
  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const [{ data: goalsData }, { data: profileData }] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'active').order('priority', { ascending: true }),
        supabase.from('profiles').select('quarter_locked').eq('id', user.id).single(),
      ])
      setGoals(goalsData || [])
      // D2: hydrate lock from DB, fall back to empty (all unlocked)
      if (profileData?.quarter_locked) setLocked(profileData.quarter_locked as Record<Quarter, boolean>)
    }
    load()
  }, [])

  // D4: reload events whenever the active quarter or userId changes
  useEffect(() => {
    if (!userId) return
    const loadEvents = async () => {
      const { data } = await supabase
        .from('quarterly_events')
        .select('*')
        .eq('user_id', userId)
        .eq('quarter_label', QUARTER_DATES[activeQ].label)
        .order('start_date', { ascending: true })
      setEvents((data || []) as KeyEvent[])
    }
    loadEvents()
  }, [activeQ, userId])

  if (!mounted) return null

  const quarterLabel = QUARTER_DATES[activeQ].label
  const quarterGoals = goals.filter(g => g.quarter === quarterLabel)

  // ── D3: remove goal from quarter ──────────────────────────────────────────
  const handleRemoveGoal = async (goal: GoalRow) => {
    if (!userId) return
    if (!confirm(`Remove "${goal.text}" from ${quarterLabel}? The goal won't be deleted — it just won't be tracked toward this quarter.`)) return
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, quarter: null } : g))
    const { error } = await supabase.from('goals').update({ quarter: null }).eq('id', goal.id)
    if (error) {
      console.error('Remove from quarter:', error.message)
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, quarter: goal.quarter } : g))
    }
  }

  // ── D2: lock/unlock with DB persist and unlock confirmation ───────────────
  const handleLock = async () => {
    if (!userId) return
    if (locked[activeQ] && !confirm('Unlocking allows changes to goals you committed to for this quarter. Continue?')) return
    const updated = { ...locked, [activeQ]: !locked[activeQ] }
    setLocked(updated)
    await supabase.from('profiles').update({ quarter_locked: updated }).eq('id', userId)
  }

  // ── D4: add / delete quarterly events ────────────────────────────────────
  const handleAddEvent = async () => {
    if (!newTitle.trim() || !userId) return
    const { data, error } = await supabase
      .from('quarterly_events')
      .insert({ user_id: userId, quarter_label: quarterLabel, title: newTitle.trim(), start_date: newStart || null, end_date: newEnd || null, type: newType })
      .select().single()
    if (!error && data) {
      setEvents(prev => [...prev, data as KeyEvent].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '')))
    }
    setAddingEvent(false); setNewTitle(''); setNewStart(''); setNewEnd(''); setNewType('event')
  }

  const handleDeleteEvent = async (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
    await supabase.from('quarterly_events').delete().eq('id', id)
  }

  // ── D1: generate plan suggestions ────────────────────────────────────────
  const handleGeneratePlan = async () => {
    if (!userId) return
    setGeneratingPlan(true)
    const prevLabel = QUARTER_DATES[PREV_QUARTER[activeQ]].label
    const { data: profileData } = await supabase.from('profiles').select('priority_stack').eq('id', userId).single()
    const priorityCategories: string[] = (profileData?.priority_stack as string[] | null) || []

    // Score candidates not yet in this quarter:
    // +3 carry-forward from prior quarter; +3/2/1 priority stack position; +1 started but not done
    const candidates = goals.filter(g => g.quarter !== quarterLabel)
    const scored = candidates.map(g => {
      let score = 0
      if (g.quarter === prevLabel) score += 3
      const catIdx = priorityCategories.indexOf(g.category)
      if (catIdx === 0) score += 3
      else if (catIdx === 1) score += 2
      else if (catIdx === 2) score += 1
      if ((g.progress || 0) > 0 && (g.progress || 0) < 100) score += 1
      return { goal: g, score }
    })
    scored.sort((a, b) => b.score - a.score)
    setSuggestions(scored.slice(0, 5).map(s => s.goal))
    setGeneratingPlan(false)
    setShowSuggestModal(true)
  }

  const handleAcceptSuggestion = async (goal: GoalRow) => {
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, quarter: quarterLabel } : g))
    setSuggestions(prev => prev.filter(g => g.id !== goal.id))
    await supabase.from('goals').update({ quarter: quarterLabel }).eq('id', goal.id)
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 0 16px' }}>

      {/* Header */}
      <div style={{ padding: '56px 16px 16px', background: 'var(--c-surface)', borderBottom: '0.5px solid var(--c-border)' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Home
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Quarterly Planner</h1>
        <p style={{ fontSize: 14, color: 'var(--c-text-2)', margin: '3px 0 0' }}>Map your goals across the year</p>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Quarter Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: 'var(--c-surface)', borderRadius: 14, padding: '4px', border: '0.5px solid var(--c-border)', marginBottom: 16 }}>
          {(['Q1', 'Q2', 'Q3', 'Q4'] as Quarter[]).map(q => (
            <button key={q} onClick={() => setActiveQ(q)} style={{ padding: '9px 4px', borderRadius: 10, background: activeQ === q ? '#3B7DFF' : 'transparent', border: 'none', fontSize: 13, fontWeight: activeQ === q ? 600 : 400, color: activeQ === q ? 'white' : 'var(--c-text-2)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {QUARTER_DATES[q].label.split(' ')[0]}<br /><span style={{ fontSize: 10 }}>2026</span>
            </button>
          ))}
        </div>

        {/* Quarter Theme */}
        <div style={{ background: locked[activeQ] ? 'linear-gradient(135deg, #1C1C1E 0%, #3C3C43 100%)' : 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)', borderRadius: 18, padding: '20px', marginBottom: 14, color: 'white' }}>
          <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 4px' }}>Quarter Theme</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>{QUARTER_THEMES[activeQ]}</h2>
          <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>Focus: {QUARTER_FOCUS[activeQ]}</p>
          {locked[activeQ] && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Quarter locked — goals and events are read-only</span>
            </div>
          )}
        </div>

        {/* Goals */}
        <div style={{ background: 'var(--c-surface)', borderRadius: 16, padding: '18px', border: '0.5px solid var(--c-border)', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Goals</p>
            {/* D2: Add Goal hidden when locked */}
            {!locked[activeQ] && (
              <button onClick={() => router.push('/dashboard/goals/evaluate')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#3B7DFF', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add Goal
              </button>
            )}
          </div>

          {quarterGoals.length === 0 ? (
            <EmptyState
              icon="📌"
              iconBg="#EFF6FF"
              title={`No goals for ${quarterLabel}`}
              body="Commit goals to this quarter to track your quarterly progress here."
              ctaLabel="Add Goals"
              onCta={() => router.push('/dashboard/goals')}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {quarterGoals.map((goal, i) => {
                const cs = getCatStyle(goal.category)
                return (
                  <div key={goal.id} style={{ background: 'var(--c-surface-2)', borderRadius: 12, padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--c-text-1)', margin: 0, flex: 1, paddingRight: 8 }}>{goal.text}</p>
                      {/* D3: X button hidden when locked */}
                      {!locked[activeQ] && (
                        <button onClick={() => handleRemoveGoal(goal)} title="Remove from quarter" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--c-text-3)', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, background: cs.bg, color: cs.color, padding: '2px 8px', borderRadius: 20 }}>{goal.category}</span>
                      <span style={{ fontSize: 12, color: 'var(--c-text-2)', background: 'var(--c-border-sub)', padding: '2px 8px', borderRadius: 20 }}>Priority #{i + 1}</span>
                    </div>
                    <div style={{ background: 'var(--c-border)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${goal.progress || 0}%`, background: '#3B7DFF', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* D4: Key Events & Blocks — DB-backed */}
        <div style={{ background: 'var(--c-surface)', borderRadius: 16, padding: '18px', border: '0.5px solid var(--c-border)', marginBottom: 14 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)', margin: '0 0 14px' }}>Key Events & Blocks</p>

          {events.length === 0 && !addingEvent && (
            <p style={{ fontSize: 14, color: 'var(--c-text-2)', textAlign: 'center', padding: '8px 0', margin: '0 0 10px' }}>No events for {quarterLabel}.</p>
          )}

          {events.map(ev => {
            const s = EVENT_STYLE[ev.type] || EVENT_STYLE.event
            const dateRange = ev.start_date
              ? (ev.end_date && ev.end_date !== ev.start_date ? `${ev.start_date} – ${ev.end_date}` : ev.start_date)
              : null
            return (
              <div key={ev.id} style={{ background: s.bg, borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: `1px solid ${s.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: s.title, margin: '0 0 2px' }}>{ev.title}</p>
                  <p style={{ fontSize: 12, color: s.sub, margin: 0, textTransform: 'capitalize' }}>
                    {dateRange ? `${dateRange} · ` : ''}{ev.type}
                  </p>
                </div>
                {!locked[activeQ] && (
                  <button onClick={() => handleDeleteEvent(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--c-text-3)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            )
          })}

          {!locked[activeQ] && (
            addingEvent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, padding: '14px', background: 'var(--c-surface-2)', borderRadius: 12 }}>
                <input
                  value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="Event title…" autoFocus
                  style={{ width: '100%', border: '0.5px solid var(--c-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--c-text-2)', margin: '0 0 4px' }}>Start date</p>
                    <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} style={{ width: '100%', border: '0.5px solid var(--c-border)', borderRadius: 8, padding: '9px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'var(--c-surface)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--c-text-2)', margin: '0 0 4px' }}>End date</p>
                    <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} style={{ width: '100%', border: '0.5px solid var(--c-border)', borderRadius: 8, padding: '9px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'var(--c-surface)' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['event', 'vacation', 'block'] as const).map(t => (
                    <button key={t} onClick={() => setNewType(t)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, background: newType === t ? '#1C1C1E' : 'var(--c-border-sub)', color: newType === t ? 'white' : 'var(--c-text-mid)', textTransform: 'capitalize' }}>{t}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleAddEvent} disabled={!newTitle.trim()} style={{ flex: 1, padding: '11px', borderRadius: 10, background: newTitle.trim() ? '#3B7DFF' : '#D1D1D6', border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: newTitle.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>Save Event</button>
                  <button onClick={() => { setAddingEvent(false); setNewTitle(''); setNewStart(''); setNewEnd(''); setNewType('event') }} style={{ padding: '11px 16px', borderRadius: 10, background: 'var(--c-border-sub)', border: 'none', color: 'var(--c-text-mid)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingEvent(true)} style={{ width: '100%', padding: '12px', borderRadius: 10, marginTop: events.length > 0 ? 4 : 0, background: 'none', border: '0.5px dashed #D1D1D6', color: 'var(--c-text-2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#EBEBF5' : '#8E8E93'} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add Event
              </button>
            )
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {/* D1: Generate Plan — hidden when locked */}
          {!locked[activeQ] && (
            <button
              onClick={handleGeneratePlan} disabled={generatingPlan}
              style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'var(--c-surface)', border: '0.5px solid var(--c-border)', color: 'var(--c-text-1)', fontSize: 14, fontWeight: 600, cursor: generatingPlan ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: generatingPlan ? 0.6 : 1 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#FFFFFF' : '#1C1C1E'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              {generatingPlan ? 'Generating…' : 'Generate Plan'}
            </button>
          )}
          {/* D2: Lock/Unlock — always visible, green when locked */}
          <button
            onClick={handleLock}
            style={{ flex: 1, padding: '14px', borderRadius: 14, background: locked[activeQ] ? '#34C759' : '#1C1C1E', border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            {locked[activeQ] ? 'Unlock Quarter' : 'Lock Quarter'}
          </button>
        </div>
      </div>

      {/* D1: Suggestions bottom-sheet */}
      {showSuggestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowSuggestModal(false)}>
          <div style={{ background: 'var(--c-surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', padding: '24px 20px 40px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>Suggested for {quarterLabel}</h2>
                <p style={{ fontSize: 13, color: 'var(--c-text-2)', margin: '4px 0 0' }}>Based on your priority stack and carry-forwards. Accept or skip each.</p>
              </div>
              <button onClick={() => setShowSuggestModal(false)} style={{ background: 'var(--c-border-sub)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#EBEBF5' : '#3C3C43'} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {suggestions.length === 0 ? (
              <p style={{ fontSize: 15, color: 'var(--c-text-2)', textAlign: 'center', padding: '20px 0' }}>All your active goals are already committed to {quarterLabel}.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestions.map(goal => {
                  const cs = getCatStyle(goal.category)
                  const isCarryForward = goal.quarter === QUARTER_DATES[PREV_QUARTER[activeQ]].label
                  return (
                    <div key={goal.id} style={{ background: 'var(--c-surface-2)', borderRadius: 14, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, background: cs.bg, color: cs.color, padding: '2px 8px', borderRadius: 20 }}>{goal.category}</span>
                        {isCarryForward && <span style={{ fontSize: 11, fontWeight: 500, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 20 }}>Carry-forward</span>}
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--c-text-1)', margin: '0 0 10px' }}>{goal.text}</p>
                      {(goal.progress || 0) > 0 && (
                        <div style={{ background: 'var(--c-border)', borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 10 }}>
                          <div style={{ height: '100%', width: `${goal.progress}%`, background: '#3B7DFF', borderRadius: 4 }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleAcceptSuggestion(goal)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#3B7DFF', border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Add to {quarterLabel}</button>
                        <button onClick={() => setSuggestions(prev => prev.filter(g => g.id !== goal.id))} style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--c-border-sub)', border: 'none', color: 'var(--c-text-mid)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Skip</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
