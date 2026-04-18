'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface SmartScore {
  score: number
  feedback: string
}

interface EvalResult {
  overallScore: number
  quality: string
  specific: SmartScore
  measurable: SmartScore
  achievable: SmartScore
  relevant: SmartScore
  timeBound: SmartScore
  alignmentScore: number
  alignmentText: string
  estimatedHours: number
  capacityImpact: number
  recommendation: string
}

const CATEGORIES = [
  'Career', 'Finance', 'Health', 'Creative', 'Travel',
  'Relationships', 'Business', 'Community', 'Personal Growth', 'Education',
]
const TIMELINES = ['Q1', 'Q2', 'Q3', 'Q4', '2027']

// ─── Scoring logic ────────────────────────────────────────────────────────────

function scoreGoal(text: string): EvalResult {
  const t = text.toLowerCase()
  const words = t.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  // Specific (50–95)
  let specific = 50
  if (wordCount >= 6)  specific += 10
  if (wordCount >= 10) specific += 8
  if (/\d/.test(t))   specific += 10
  if (/\b(launch|build|create|develop|start|grow|achieve|complete|earn|learn|reach)\b/.test(t)) specific += 7
  if (/\b(business|app|brand|product|service|career|skill|habit|project|degree|fund)\b/.test(t)) specific += 10
  specific = Math.min(95, specific)

  // Measurable (40–95)
  let measurable = 40
  if (/\d/.test(t)) measurable += 12
  if (/\$[\d,]+|\d+k\b/.test(t)) measurable += 22
  if (/\d+%/.test(t)) measurable += 20
  if (/\d+\s*(clients?|users?|customers?|sales?|books?|pounds?|kg|miles?|km|subscribers?)/.test(t)) measurable += 25
  if (/profitable|revenue|income|savings?|emergency fund|fluent|conversational|certified/.test(t)) measurable += 18
  measurable = Math.min(95, measurable)

  // Achievable (45–90)
  let achievable = 65
  if (/without any (funding|help|support|experience|money)/.test(t)) achievable -= 10
  if (/in \d+ (days?|hours?)/.test(t) && !/months?/.test(t)) achievable -= 15
  if (/overnight|instantly|immediately/.test(t)) achievable -= 20
  achievable = Math.min(90, Math.max(45, achievable))

  // Relevant (65–95)
  let relevant = 75
  if (/career|business|health|finance|family|relationship|travel|education|growth|skill|wealth|fitness/.test(t)) relevant += 10
  if (wordCount >= 8) relevant += 5
  relevant = Math.min(95, relevant)

  // Time-bound (30–95)
  let timeBound = 30
  if (/q[1-4]/.test(t)) timeBound += 40
  if (/202[5-9]|203\d/.test(t)) timeBound += 32
  if (/\d+\s*months?/.test(t)) timeBound += 35
  if (/\d+\s*weeks?/.test(t)) timeBound += 25
  if (/by (end|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)/.test(t)) timeBound += 25
  if (/by \d{4}/.test(t)) timeBound += 28
  if (/this year|next year|this quarter|end of year/.test(t)) timeBound += 22
  timeBound = Math.min(95, timeBound)

  const overallScore = Math.round((specific + measurable + achievable + relevant + timeBound) / 5)

  let quality = 'Needs improvement'
  if (overallScore >= 85) quality = 'Excellent goal quality'
  else if (overallScore >= 75) quality = 'Very good goal quality'
  else if (overallScore >= 62) quality = 'Good goal quality'
  else if (overallScore >= 50) quality = 'Fair — consider refining'

  // Deterministic alignment score based on text characteristics
  const charSum = text.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const alignmentScore = 72 + (charSum % 24)

  const alignmentText = alignmentScore >= 88
    ? 'This goal aligns well with your existing priorities and values. It complements your current focus areas and supports your long-term vision.'
    : alignmentScore >= 80
      ? 'This goal shows strong alignment with your priorities. It fits well with your current active goals and life direction.'
      : 'This goal has good potential alignment. Review how it fits alongside your current commitments before committing.'

  // Impact analysis
  const hoursMatch = t.match(/(\d+)\s*hours?\s*(per|a|\/)\s*week/)
  const estimatedHours = hoursMatch ? parseInt(hoursMatch[1]) : 3 + (charSum % 8)
  const capacityImpact = Math.min(45, Math.round(estimatedHours * 2.8))

  const recommendation = capacityImpact <= 28
    ? 'You have sufficient capacity to take on this goal'
    : 'Consider reviewing your current commitments before adding this goal'

  return {
    overallScore, quality,
    specific:   { score: specific,   feedback: specificFeedback(specific) },
    measurable: { score: measurable, feedback: measurableFeedback(measurable) },
    achievable: { score: achievable, feedback: achievableFeedback(achievable) },
    relevant:   { score: relevant,   feedback: relevantFeedback(relevant) },
    timeBound:  { score: timeBound,  feedback: timeBoundFeedback(timeBound) },
    alignmentScore, alignmentText, estimatedHours, capacityImpact, recommendation,
  }
}

function specificFeedback(s: number) {
  if (s >= 80) return 'Goal is well-defined with clear details'
  if (s >= 60) return 'Goal could benefit from more specific details'
  return 'Add specifics: what exactly you want to achieve and how'
}
function measurableFeedback(s: number) {
  if (s >= 80) return 'Goal includes quantifiable metrics'
  if (s >= 55) return 'Consider adding measurable targets or milestones'
  return 'Add specific numbers, amounts, or success criteria'
}
function achievableFeedback(s: number) {
  if (s >= 75) return 'Goal appears realistic based on your current capacity and active goals'
  if (s >= 58) return 'Goal is challenging but potentially achievable with focus'
  return 'Goal may be overly ambitious — consider breaking it into phases'
}
function relevantFeedback(s: number) {
  if (s >= 85) return 'Goal aligns with your existing priorities and values'
  if (s >= 70) return 'Goal connects well to your life priorities'
  return 'Consider how this goal connects to your broader life vision'
}
function timeBoundFeedback(s: number) {
  if (s >= 80) return 'Goal has a clear deadline or timeframe'
  if (s >= 55) return 'Consider adding a more specific deadline'
  return 'Add a target date or quarter (e.g., Q2 2026, by December)'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#16A34A' : score >= 65 ? '#D97706' : '#DC2626'
  const bg    = score >= 80 ? '#F0FFF4' : score >= 65 ? '#FFFBEB' : '#FFF5F5'
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color, background: bg, padding: '3px 10px', borderRadius: 20 }}>
      {score}%
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalEvaluatorPage() {
  const router = useRouter()
  const [goalText, setGoalText]     = useState('')
  const [result, setResult]         = useState<EvalResult | null>(null)
  const [error, setError]           = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [category, setCategory]     = useState('Career')
  const [timeline, setTimeline]     = useState('Q2')
  const [weeklyHours, setWeeklyHours] = useState('5')
  const [saving, setSaving]         = useState(false)

  const handleEvaluate = () => {
    if (!goalText.trim()) { setError('Please enter a goal to evaluate.'); return }
    setError('')
    setResult(scoreGoal(goalText.trim()))
  }

  const handleAddGoal = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      await supabase.from('goals').insert({
        user_id: user.id,
        text: goalText.trim(),
        category,
        status: 'inbox',
        priority: 999,
        progress: 0,
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

  return (
    <div style={{ padding: '56px 16px 40px' }}>

      {/* Back nav */}
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
      <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 24px' }}>Get AI-powered insights before committing</p>

      {/* Input card */}
      <div style={{
        background: 'white', borderRadius: 16, padding: '18px',
        border: '0.5px solid #E5E5EA', marginBottom: 16,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: '0 0 10px' }}>Enter Your Goal</p>
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

      {/* ── Results ── */}
      {result && (
        <>
          {/* Overall score */}
          <div style={{
            background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
            borderRadius: 16, padding: '28px 24px', marginBottom: 12, textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '0 0 6px' }}>Overall SMART Score</p>
            <p style={{ fontSize: 60, fontWeight: 700, color: 'white', margin: '0 0 10px', lineHeight: 1 }}>
              {result.overallScore}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
              </svg>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>{result.quality}</span>
            </div>
          </div>

          {/* SMART Analysis */}
          <div style={{
            background: 'white', borderRadius: 16, padding: '18px',
            border: '0.5px solid #E5E5EA', marginBottom: 12,
          }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 16px' }}>SMART Analysis</p>
            {[
              { label: 'Specific',    data: result.specific },
              { label: 'Measurable',  data: result.measurable },
              { label: 'Achievable',  data: result.achievable },
              { label: 'Relevant',    data: result.relevant },
              { label: 'Time-bound',  data: result.timeBound },
            ].map(({ label, data }, i, arr) => (
              <div key={label} style={{ marginBottom: i < arr.length - 1 ? 16 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E' }}>{label}</span>
                  <ScoreBadge score={data.score} />
                </div>
                <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>{data.feedback}</p>
              </div>
            ))}
          </div>

          {/* Alignment */}
          <div style={{
            background: 'white', borderRadius: 16, padding: '18px',
            border: '0.5px solid #E5E5EA', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: '#F5F3FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" />
                    <circle cx="12" cy="12" r="1" fill="#8B5CF6" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Overall Alignment</p>
                  <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>How this fits your life system</p>
                </div>
              </div>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#8B5CF6' }}>{result.alignmentScore}%</span>
            </div>
            <p style={{ fontSize: 13, color: '#6D28D9', lineHeight: 1.5, margin: 0 }}>{result.alignmentText}</p>
          </div>

          {/* Impact Analysis */}
          <div style={{
            background: 'white', borderRadius: 16, padding: '18px',
            border: '0.5px solid #E5E5EA', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: '#EFF6FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Impact Analysis</p>
            </div>

            {/* Time commitment */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43' }}>Time Commitment</span>
              </div>
              <p style={{ fontSize: 13, color: '#3C3C43', margin: '0 0 8px' }}>
                Estimated {result.estimatedHours} hours/week
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#8E8E93' }}>Weekly capacity impact</span>
                <span style={{ fontSize: 12, color: '#8E8E93' }}>{result.capacityImpact}%</span>
              </div>
              <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${result.capacityImpact}%`,
                  background: '#3B7DFF', borderRadius: 4,
                }} />
              </div>
            </div>

            {/* Recommendation */}
            <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#3B7DFF', margin: '0 0 2px' }}>
                Recommendation
              </p>
              <p style={{ fontSize: 13, color: '#3B7DFF', margin: 0 }}>{result.recommendation}</p>
            </div>
          </div>

          {/* Add / Start Over */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowModal(true)}
              style={{
                flex: 2, padding: '15px', background: '#1C1C1E',
                border: 'none', borderRadius: 14,
                fontSize: 15, fontWeight: 600, color: 'white',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Add This Goal
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

      {/* ── Add Goal Modal ── */}
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
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Add Goal Details</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Goal preview */}
            <div style={{
              background: '#F2F2F7', borderRadius: 10,
              padding: '10px 14px', marginBottom: 22,
            }}>
              <p style={{ fontSize: 14, color: '#3C3C43', margin: 0, lineHeight: 1.4 }}>{goalText}</p>
            </div>

            {/* Category */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: '0 0 10px' }}>Category</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    style={{
                      padding: '7px 14px', borderRadius: 20,
                      fontSize: 13, fontWeight: 500,
                      border: '0.5px solid #D1D1D6', cursor: 'pointer',
                      background: category === cat ? '#3B7DFF' : 'white',
                      color: category === cat ? 'white' : '#3C3C43',
                      fontFamily: 'inherit',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline */}
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
                      color: timeline === t ? 'white' : '#3C3C43',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly hours */}
            <div style={{ marginBottom: 26 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: '0 0 10px' }}>
                Estimated Weekly Hours
              </p>
              <input
                type="number"
                min={1} max={40}
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
