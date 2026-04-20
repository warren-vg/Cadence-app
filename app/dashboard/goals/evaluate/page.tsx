'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  evaluateGoal,
  getScoreBadgeStyle,
  SMART_GATE_THRESHOLD,
  type SmartEvalResult,
} from '@/lib/smartScore'
import {
  getRemainingCapacity,
  getUsedCapacity,
  CONSTANTS,
} from '@/lib/planData'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoalForCapacity {
  status: string
  estimatedWeeklyHours?: number | null
}

const CATEGORIES = [
  'Career', 'Finance', 'Health', 'Creative', 'Travel',
  'Relationships', 'Business', 'Community', 'Personal Growth', 'Education',
]
const TIMELINES = ['Q1', 'Q2', 'Q3', 'Q4', '2027']

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const { color, bg } = getScoreBadgeStyle(score)
  return (
    <span style={{
      fontSize: 13, fontWeight: 600, color, background: bg,
      padding: '3px 10px', borderRadius: 20,
    }}>
      {score}%
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalEvaluatorPage() {
  const router = useRouter()

  const [goalText, setGoalText]         = useState('')
  const [result, setResult]             = useState<SmartEvalResult | null>(null)
  const [error, setError]               = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [category, setCategory]         = useState('Career')
  const [timeline, setTimeline]         = useState('Q2')
  const [weeklyHours, setWeeklyHours]   = useState('5')
  const [saving, setSaving]             = useState(false)

  const [activeGoals, setActiveGoals]   = useState<GoalForCapacity[]>([])
  const [priorityStack, setPriorityStack] = useState<string[]>([])

  useEffect(() => {
    const loadContext = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: goalsData } = await supabase
        .from('goals')
        .select('status, estimated_weekly_hours')
        .eq('user_id', user.id)
        .eq('status', 'active')

      setActiveGoals(goalsData || [])

      const { data: profileData } = await supabase
        .from('profiles')
        .select('priority_stack')
        .eq('id', user.id)
        .single()

      if (profileData?.priority_stack) {
        setPriorityStack(profileData.priority_stack)
      }
    }
    loadContext()
  }, [])

  const handleEvaluate = () => {
    if (!goalText.trim()) {
      setError('Please enter a goal to evaluate.')
      return
    }
    if (goalText.trim().split(/\s+/).length < 3) {
      setError('Please describe your goal in at least a few words.')
      return
    }
    setError('')

    const remainingCap = getRemainingCapacity(activeGoals)
    const activeCount  = activeGoals.filter(g => g.status === 'active').length

    setResult(evaluateGoal(
      goalText.trim(),
      category,
      priorityStack,
      remainingCap,
      activeCount
    ))
  }

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat)
    if (result && goalText.trim()) {
      const remainingCap = getRemainingCapacity(activeGoals)
      const activeCount  = activeGoals.filter(g => g.status === 'active').length
      setResult(evaluateGoal(goalText.trim(), newCat, priorityStack, remainingCap, activeCount))
    }
  }

  const handleAddGoal = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const hoursValue = parseFloat(weeklyHours)
      const validHours = !isNaN(hoursValue) && hoursValue >= 0.5 && hoursValue <= 40
        ? hoursValue
        : CONSTANTS.DEFAULT_HOURS_PER_GOAL_FALLBACK

      await supabase.from('goals').insert({
        user_id:                user.id,
        text:                   goalText.trim(),
        category,
        quarter:                timeline,
        estimated_weekly_hours: validHours,
        status:                 'inbox',
        priority:               999,
        progress:               0,
      })

      router.push('/dashboard/goals')
    } catch (err) {
      console.error('Add goal error:', err)
      setSaving(false)
    }
  }

  const handleStartOver = () => {
    setGoalText('')
    setResult(null)
    setError('')
    setShowModal(false)
  }

  const usedCap      = getUsedCapacity(activeGoals)
  const totalCap     = CONSTANTS.DEFAULT_WEEKLY_CAPACITY_HOURS
  const remainingCap = totalCap - usedCap
  const newHours     = parseFloat(weeklyHours) || CONSTANTS.DEFAULT_HOURS_PER_GOAL_FALLBACK
  const capacityImpactPct = Math.min(100, Math.round((newHours / totalCap) * 100))
  const wouldOverCapacity = newHours > remainingCap

  const canAddGoal = result !== null && result.overallScore >= SMART_GATE_THRESHOLD

  return (
    <div style={{ padding: '56px 16px 40px' }}>

      <button
        onClick={() => router.push('/dashboard/goals')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 20, padding: 0,
          color: '#3C3C43', fontFamily: 'inherit', fontSize: 15,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Goals
      </button>

      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: '0 0 4px' }}>Goal Evaluator</h1>
      <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 24px' }}>Score your goal before committing</p>

      {/* Category selector */}
      <div style={{
        background: 'white', borderRadius: 16, padding: '16px 18px',
        border: '0.5px solid #E5E5EA', marginBottom: 12,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: '0 0 10px' }}>Category</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                border: '0.5px solid #D1D1D6', cursor: 'pointer', fontFamily: 'inherit',
                background: category === cat ? '#1C1C1E' : 'white',
                color:      category === cat ? 'white'   : '#3C3C43',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Input card */}
      <div style={{
        background: 'white', borderRadius: 16, padding: '18px',
        border: '0.5px solid #E5E5EA', marginBottom: 16,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: '0 0 10px' }}>Describe Your Goal</p>
        <textarea
          value={goalText}
          onChange={e => setGoalText(e.target.value)}
          placeholder="e.g., Launch my freelance consulting business and land 3 clients within 6 months"
          style={{
            width: '100%', minHeight: 90,
            border: '0.5px solid #E5E5EA', borderRadius: 10,
            padding: '12px', fontSize: 15, color: '#1C1C1E',
            fontFamily: 'inherit', resize: 'none', outline: 'none',
            lineHeight: 1.5, boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ fontSize: 13, color: '#DC2626', margin: '6px 0 0' }}>{error}</p>}
        <button
          onClick={handleEvaluate}
          style={{
            width: '100%', marginTop: 12, padding: '14px',
            background: '#1C1C1E', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 600, color: 'white',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Evaluate Goal
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          <div style={{
            background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
            borderRadius: 16, padding: '28px 24px', marginBottom: 12, textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '0 0 6px' }}>Overall SMART Score</p>
            <p style={{ fontSize: 60, fontWeight: 700, color: 'white', margin: '0 0 10px', lineHeight: 1 }}>
              {result.overallScore}
            </p>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>{result.quality}</span>

            {!canAddGoal && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '10px 0 0' }}>
                Score {SMART_GATE_THRESHOLD}+ to enable adding this goal
              </p>
            )}
          </div>

          <div style={{
            background: 'white', borderRadius: 16, padding: '18px',
            border: '0.5px solid #E5E5EA', marginBottom: 12,
          }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 16px' }}>SMART Analysis</p>
            {([
              { label: 'Specific',   data: result.specific   },
              { label: 'Measurable', data: result.measurable },
              { label: 'Achievable', data: result.achievable },
              { label: 'Relevant',   data: result.relevant   },
              { label: 'Time-bound', data: result.timeBound  },
            ] as const).map(({ label, data }, i, arr) => (
              <div key={label} style={{ marginBottom: i < arr.length - 1 ? 16 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E' }}>{label}</span>
                  <ScoreBadge score={data.score} />
                </div>
                <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>{data.feedback}</p>
              </div>
            ))}
          </div>

          {/* Capacity Impact */}
          <div style={{
            background: 'white', borderRadius: 16, padding: '18px',
            border: '0.5px solid #E5E5EA', marginBottom: 20,
          }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 16px' }}>Capacity Impact</p>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#3C3C43' }}>Current used capacity</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{usedCap}h / {totalCap}h/week</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#3C3C43' }}>Remaining capacity</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: remainingCap < 4 ? '#DC2626' : '#16A34A' }}>
                  {remainingCap}h/week
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#3C3C43' }}>This goal would add</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{newHours}h/week ({capacityImpactPct}%)</span>
              </div>
              <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round((usedCap / totalCap) * 100))}%`,
                  background: '#3B7DFF', borderRadius: 4,
                }} />
              </div>
            </div>

            <div style={{
              background: wouldOverCapacity ? '#FFF5F5' : '#EFF6FF',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <p style={{ fontSize: 13, color: wouldOverCapacity ? '#DC2626' : '#3B7DFF', margin: 0 }}>
                {wouldOverCapacity
                  ? `Adding ${newHours}h/week would exceed your ${totalCap}h capacity. Consider pausing a lower-priority goal first.`
                  : `You have sufficient capacity (${remainingCap}h remaining) to take on this goal.`
                }
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => canAddGoal && setShowModal(true)}
              disabled={!canAddGoal}
              style={{
                flex: 2, padding: '15px',
                background: canAddGoal ? '#1C1C1E' : '#D1D1D6',
                border: 'none', borderRadius: 14,
                fontSize: 15, fontWeight: 600, color: 'white',
                cursor: canAddGoal ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              {canAddGoal ? 'Add This Goal' : `Score ${SMART_GATE_THRESHOLD}+ to Add`}
            </button>
            <button
              onClick={handleStartOver}
              style={{
                flex: 1, padding: '15px', background: 'white',
                border: '0.5px solid #E5E5EA', borderRadius: 14,
                fontSize: 15, fontWeight: 500, color: '#3C3C43',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Start Over
            </button>
          </div>
        </>
      )}

      {/* Add Goal Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{
            background: 'white', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 44px', width: '100%', maxWidth: 480,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Confirm Goal Details</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ background: '#F2F2F7', borderRadius: 10, padding: '10px 14px', marginBottom: 22 }}>
              <p style={{ fontSize: 14, color: '#3C3C43', margin: 0, lineHeight: 1.4 }}>{goalText}</p>
            </div>

            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: '0 0 10px' }}>Timeline</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {TIMELINES.map(t => (
                  <button
                    key={t}
                    onClick={() => setTimeline(t)}
                    style={{
                      flex: 1, padding: '9px 8px', borderRadius: 10,
                      fontSize: 13, fontWeight: 500,
                      border: '0.5px solid #D1D1D6', cursor: 'pointer',
                      background: timeline === t ? '#3B7DFF' : 'white',
                      color:      timeline === t ? 'white'   : '#3C3C43',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 26 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: '0 0 6px' }}>
                Estimated Weekly Hours
              </p>
              <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 10px' }}>
                Used to track capacity and your Momentum Score
              </p>
              <input
                type="number"
                min={0.5} max={40} step={0.5}
                value={weeklyHours}
                onChange={e => setWeeklyHours(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '0.5px solid #D1D1D6', borderRadius: 10,
                  fontSize: 15, color: '#1C1C1E',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={handleAddGoal}
              disabled={saving}
              style={{
                width: '100%', padding: '15px',
                background: saving ? '#8E8E93' : '#3B7DFF',
                border: 'none', borderRadius: 14,
                fontSize: 15, fontWeight: 600, color: 'white',
                cursor: saving ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Adding...' : 'Confirm & Add Goal'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
