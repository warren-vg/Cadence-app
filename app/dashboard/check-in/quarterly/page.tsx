'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Goal {
  id: string
  text: string
  category: string
  status: string
  progress: number
  quarter?: string | null
}

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

const QUARTER_DATES: Record<Quarter, { label: string; months: string; year: number }> = {
  Q1: { label: 'Q1 2026', months: 'Jan – Mar', year: 2026 },
  Q2: { label: 'Q2 2026', months: 'Apr – Jun', year: 2026 },
  Q3: { label: 'Q3 2026', months: 'Jul – Sep', year: 2026 },
  Q4: { label: 'Q4 2026', months: 'Oct – Dec', year: 2026 },
}

const QUARTER_THEMES: Record<Quarter, string> = {
  Q1: 'Foundation & Systems',
  Q2: 'Growth & Execution',
  Q3: 'Scale & Optimize',
  Q4: 'Reflect & Accelerate',
}

const QUARTER_FOCUS: Record<Quarter, string> = {
  Q1: 'Build financial stability and establish routines',
  Q2: 'Launch consulting brand and creative projects',
  Q3: 'Scale what works, optimize time and energy',
  Q4: 'Year-end push, reflect and plan for 2027',
}

const NEXT_QUARTER: Record<Quarter, Quarter> = { Q1: 'Q2', Q2: 'Q3', Q3: 'Q4', Q4: 'Q1' }

const PIVOTS: Record<Quarter, string[]> = {
  Q1: [
    'Move "Short story collection" to Q3 — Creative work needs more focus time after consulting brand stabilizes',
    'Increase health goal target: Running habit is solid — consider training for half marathon',
    'Add new focus for Q3: Build professional network through consulting work',
  ],
  Q2: [
    'Move "Short story collection" to Q3 — Creative work needs more focus time after consulting brand stabilizes',
    'Increase health goal target: Running habit is solid — consider training for half marathon',
    'Add new focus for Q3: Build professional network through consulting work',
  ],
  Q3: [
    'Move pending creative goals to Q4 — focus on scaling revenue first',
    'Consolidate health habits into a single daily routine',
    'Begin 2027 goal planning in November',
  ],
  Q4: [
    'Archive goals with less than 20% progress — clear the slate for 2027',
    'Run full year retrospective before setting Q1 goals',
    'Schedule a planning retreat in December',
  ],
}

function getCurrentQuarter(): Quarter {
  const m = new Date().getMonth()
  if (m < 3) return 'Q1'
  if (m < 6) return 'Q2'
  if (m < 9) return 'Q3'
  return 'Q4'
}

const CATEGORY_COLORS: Record<string, string> = {
  Career: '#3B7DFF', Finance: '#16A34A', Health: '#EC4899',
  Creative: '#EA580C', Travel: '#0284C7', Relationships: '#9333EA',
  'Personal Growth': '#9333EA', Education: '#3B7DFF', Business: '#D97706',
}

function getCatColor(cat: string) { return CATEGORY_COLORS[cat] || '#8E8E93' }

export default function QuarterlyReviewPage() {
  const router = useRouter()
  const [activeQ] = useState<Quarter>(getCurrentQuarter())
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [workedWell, setWorkedWell] = useState('')
  const [needsChange, setNeedsChange] = useState('')
  const [generated, setGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('goals')
        .select('id, text, category, status, progress, quarter')
        .eq('user_id', user.id)
        .order('priority', { ascending: true })
      setGoals(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const qGoals = goals.filter(g => g.quarter === activeQ || g.status === 'active')
  const completed = qGoals.filter(g => g.progress >= 100).length
  const avgProgress = qGoals.length > 0
    ? Math.round(qGoals.reduce((s, g) => s + g.progress, 0) / qGoals.length)
    : 0
  const momentum = avgProgress >= 70 ? 'High' : avgProgress >= 40 ? 'Medium' : 'Low'
  const momentumColor = momentum === 'High' ? '#34C759' : momentum === 'Medium' ? '#FF9500' : '#FF3B30'

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => { setGenerating(false); setGenerated(true) }, 1800)
  }

  const handleAccept = () => {
    setAccepted(true)
    setTimeout(() => router.push('/dashboard/plan/quarterly'), 1200)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const nq = NEXT_QUARTER[activeQ]

  return (
    <div style={{ padding: '0 0 32px' }}>

      {/* Header */}
      <div style={{ padding: '56px 16px 16px', background: 'white', borderBottom: '0.5px solid #E5E5EA' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Home
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Quarterly Review</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>
          {QUARTER_DATES[activeQ].label} — Time to reflect and pivot
        </p>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Quarter Performance Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #6B21A8 0%, #9B59B6 100%)',
          borderRadius: 20, padding: '20px', marginBottom: 14, color: 'white',
        }}>
          <p style={{ fontSize: 13, opacity: 0.8, margin: '0 0 4px' }}>Quarter Performance</p>
          <p style={{ fontSize: 48, fontWeight: 800, margin: '0 0 14px', lineHeight: 1 }}>{avgProgress}%</p>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Goals Complete', value: `${completed}/${qGoals.length}` },
              { label: 'Avg Progress', value: `${avgProgress}%` },
              { label: 'Momentum', value: momentum },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 1px' }}>{s.value}</p>
                <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Goal Status */}
        <div style={{ background: 'white', borderRadius: 18, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Goal Status</h3>
          {qGoals.length === 0 ? (
            <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>No active goals for this quarter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {qGoals.slice(0, 5).map(goal => (
                <div key={goal.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                      {goal.text}
                    </p>
                    <span style={{ fontSize: 13, fontWeight: 600, color: getCatColor(goal.category), flexShrink: 0 }}>
                      {goal.progress}%
                    </span>
                  </div>
                  <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${goal.progress}%`, background: getCatColor(goal.category), borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reflection */}
        <div style={{ background: 'white', borderRadius: 18, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Reflection</h3>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', margin: '0 0 6px' }}>What worked well this quarter?</p>
            <textarea
              value={workedWell}
              onChange={e => setWorkedWell(e.target.value)}
              placeholder="Key wins and successful strategies..."
              rows={3}
              style={{
                width: '100%', border: '1px solid #E5E5EA', borderRadius: 10,
                padding: '10px 12px', fontSize: 14, color: '#1C1C1E',
                background: '#F9F9FB', fontFamily: 'inherit', resize: 'none',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', margin: '0 0 6px' }}>What needs to change?</p>
            <textarea
              value={needsChange}
              onChange={e => setNeedsChange(e.target.value)}
              placeholder="Adjustments and pivots to consider..."
              rows={3}
              style={{
                width: '100%', border: '1px solid #E5E5EA', borderRadius: 10,
                padding: '10px 12px', fontSize: 14, color: '#1C1C1E',
                background: '#F9F9FB', fontFamily: 'inherit', resize: 'none',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Generate Check-In */}
        {!generated && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: generating ? '#9B8FFF' : 'linear-gradient(135deg, #6B21A8 0%, #9B59B6 100%)',
              border: 'none', color: 'white', fontSize: 15, fontWeight: 700,
              cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 14,
            }}
          >
            {generating ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0" />
                </svg>
                Analyzing your quarter…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Generate Check-In
              </>
            )}
          </button>
        )}

        {/* AI-Generated Results */}
        {generated && (
          <>
            {/* Recommended Pivots */}
            <div style={{ background: 'white', borderRadius: 18, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Recommended Pivot</h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PIVOTS[activeQ].map((p, i) => (
                  <li key={i} style={{ fontSize: 13, color: '#3C3C43', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600 }}>{p.split(':')[0]}:</span>
                    {p.includes(':') ? p.slice(p.indexOf(':') + 1) : ''}
                  </li>
                ))}
              </ul>
            </div>

            {/* New Quarter Theme */}
            <div style={{
              background: 'linear-gradient(135deg, #6B21A8 0%, #9B59B6 100%)',
              borderRadius: 18, padding: '18px 20px', marginBottom: 14, color: 'white',
            }}>
              <p style={{ fontSize: 11, opacity: 0.8, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>New {QUARTER_DATES[nq].label} Theme</p>
              <p style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{QUARTER_THEMES[nq]}</p>
              <p style={{ fontSize: 13, opacity: 0.85, margin: 0 }}>{QUARTER_FOCUS[nq]}</p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <button
                onClick={() => router.push('/dashboard/plan/quarterly')}
                style={{
                  flex: 1, padding: '13px', borderRadius: 12,
                  border: '1.5px solid #E5E5EA', background: 'white',
                  fontSize: 14, fontWeight: 600, color: '#1C1C1E',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Keep Current Plan
              </button>
              <button
                onClick={handleAccept}
                disabled={accepted}
                style={{
                  flex: 1, padding: '13px', borderRadius: 12,
                  background: accepted ? '#34C759' : '#3B7DFF',
                  border: 'none', fontSize: 14, fontWeight: 700, color: 'white',
                  cursor: accepted ? 'default' : 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.3s',
                }}
              >
                {accepted ? 'Applied ✓' : 'Accept Pivot'}
              </button>
            </div>

            <button
              onClick={() => router.push('/dashboard/plan/quarterly')}
              style={{
                width: '100%', padding: '13px', borderRadius: 12,
                background: '#F2F2F7', border: 'none',
                fontSize: 14, fontWeight: 600, color: '#3C3C43',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Rebuild Next 60 Days
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
