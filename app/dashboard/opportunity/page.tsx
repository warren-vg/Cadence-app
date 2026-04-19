'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Criterion {
  key: string
  label: string
  description: string
  weight: number
  icon: string
  positiveLabel: string
  negativeLabel: string
  inverted?: boolean
}

const CRITERIA: Criterion[] = [
  { key: 'upside', label: 'Expected Upside', description: 'Potential value or impact', weight: 1, icon: '📈', positiveLabel: 'High upside', negativeLabel: 'Low upside' },
  { key: 'time', label: 'Time Cost', description: 'Hours required per week', weight: 1, icon: '⏱', positiveLabel: 'High cost', negativeLabel: 'Low cost', inverted: true },
  { key: 'energy', label: 'Energy Cost', description: 'Mental/physical drain', weight: 1, icon: '⚡', positiveLabel: 'High drain', negativeLabel: 'Low drain', inverted: true },
  { key: 'alignment', label: 'Alignment with Goals', description: 'Supports your current priorities', weight: 1.5, icon: '🎯', positiveLabel: 'Well aligned', negativeLabel: 'Misaligned' },
  { key: 'urgency', label: 'Urgency', description: 'Time-sensitivity of the decision', weight: 0.75, icon: '🚨', positiveLabel: 'Very urgent', negativeLabel: 'Not urgent' },
]

function getVerdict(score: number): { label: string; color: string; bg: string; icon: string; advice: string } {
  if (score >= 75) return { label: 'Strong Yes', color: '#16A34A', bg: '#DCFCE7', icon: '✅', advice: 'This opportunity aligns well with your goals and offers strong potential. Consider prioritizing it.' }
  if (score >= 55) return { label: 'Worth Exploring', color: '#3B7DFF', bg: '#EFF6FF', icon: '🔍', advice: 'Promising but not a slam dunk. Do more research before committing significant time.' }
  if (score >= 40) return { label: 'Proceed Carefully', color: '#D97706', bg: '#FFFBEB', icon: '⚠️', advice: 'Mixed signals. Consider whether you can reduce the cost before committing.' }
  return { label: 'Pass on This', color: '#FF3B30', bg: '#FFF0F0', icon: '🚫', advice: "This opportunity costs more than it gives back right now. Your time is better spent elsewhere." }
}

function Slider({ label, sublabel, value, onChange, inverted }: {
  label: string; sublabel: string; value: number; onChange: (v: number) => void; inverted?: boolean
}) {
  const displayColor = inverted
    ? value > 60 ? '#FF3B30' : value > 35 ? '#FF9500' : '#34C759'
    : value > 60 ? '#34C759' : value > 35 ? '#FF9500' : '#FF3B30'

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>{label}</p>
          <p style={{ fontSize: 12, color: '#8E8E93', margin: '1px 0 0' }}>{sublabel}</p>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: displayColor }}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: displayColor, cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 10, color: '#C7C7CC' }}>{inverted ? 'Low cost' : 'Low'}</span>
        <span style={{ fontSize: 10, color: '#C7C7CC' }}>{inverted ? 'High cost' : 'High'}</span>
      </div>
    </div>
  )
}

export default function OpportunityFilterPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [values, setValues] = useState<Record<string, number>>({
    upside: 50, time: 50, energy: 50, alignment: 50, urgency: 50,
  })
  const [result, setResult] = useState<null | { score: number; verdict: ReturnType<typeof getVerdict> }>(null)
  const [running, setRunning] = useState(false)

  const computeScore = () => {
    let total = 0
    let weightSum = 0
    CRITERIA.forEach(c => {
      const v = c.inverted ? (100 - values[c.key]) : values[c.key]
      total += v * c.weight
      weightSum += c.weight
    })
    return Math.round(total / weightSum)
  }

  const handleRun = () => {
    setRunning(true)
    setTimeout(() => {
      const score = computeScore()
      setResult({ score, verdict: getVerdict(score) })
      setRunning(false)
    }, 1000)
  }

  const handleReset = () => {
    setTitle('')
    setValues({ upside: 50, time: 50, energy: 50, alignment: 50, urgency: 50 })
    setResult(null)
  }

  return (
    <div style={{ padding: '56px 16px 40px', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>Projects</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Opportunity Filter</h1>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>Not every opportunity deserves your time</p>
        </div>
      </div>

      {/* Opportunity Title */}
      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #E5E5EA', padding: '14px 16px', marginTop: 16, marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 6px' }}>Opportunity Title</p>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="E.g., Speaking engagement, Contract work, Partnership…"
          style={{
            width: '100%', border: 'none', outline: 'none', fontSize: 15,
            color: '#1C1C1E', background: 'transparent', fontFamily: 'inherit',
            padding: 0, boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Sliders */}
      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #E5E5EA', padding: '18px 16px', marginBottom: 14 }}>
        {CRITERIA.map(c => (
          <Slider
            key={c.key}
            label={c.label}
            sublabel={c.description}
            value={values[c.key]}
            onChange={v => setValues(prev => ({ ...prev, [c.key]: v }))}
            inverted={c.inverted}
          />
        ))}
      </div>

      {/* Run Button */}
      {!result && (
        <button
          onClick={handleRun}
          disabled={running}
          style={{
            width: '100%', padding: '15px', borderRadius: 14,
            background: running ? '#9B8FFF' : '#3B7DFF',
            border: 'none', color: 'white', fontSize: 16, fontWeight: 700,
            cursor: running ? 'default' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 14,
          }}
        >
          {running ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0" />
              </svg>
              Analyzing…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 9 11 13 15 22 22 3"/></svg>
              Run Filter
            </>
          )}
        </button>
      )}

      {/* Result */}
      {result && (
        <>
          {/* Score Card */}
          <div style={{
            background: result.verdict.bg,
            borderRadius: 18, padding: '22px 20px', marginBottom: 14,
            border: `1.5px solid ${result.verdict.color}22`,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, margin: '0 0 4px' }}>{result.verdict.icon}</p>
            <p style={{ fontSize: 44, fontWeight: 800, color: result.verdict.color, margin: '0 0 4px', lineHeight: 1 }}>
              {result.score}
            </p>
            <p style={{ fontSize: 11, color: result.verdict.color, margin: '0 0 8px', opacity: 0.7 }}>out of 100</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: result.verdict.color, margin: '0 0 8px' }}>
              {result.verdict.label}
            </p>
            {title && (
              <p style={{ fontSize: 13, color: '#3C3C43', margin: '0 0 8px', fontStyle: 'italic' }}>"{title}"</p>
            )}
            <p style={{ fontSize: 13, color: '#3C3C43', margin: 0, lineHeight: 1.5 }}>
              {result.verdict.advice}
            </p>
          </div>

          {/* Breakdown */}
          <div style={{ background: 'white', borderRadius: 18, padding: '18px 20px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Score Breakdown</h3>
            {CRITERIA.map(c => {
              const raw = values[c.key]
              const effective = c.inverted ? 100 - raw : raw
              const color = effective > 60 ? '#34C759' : effective > 35 ? '#FF9500' : '#FF3B30'
              return (
                <div key={c.key} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#3C3C43' }}>{c.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color }}>{effective}</span>
                  </div>
                  <div style={{ background: '#F2F2F7', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${effective}%`, background: color, borderRadius: 4 }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleReset}
              style={{
                flex: 1, padding: '13px', borderRadius: 12,
                border: '1.5px solid #E5E5EA', background: 'white',
                fontSize: 14, fontWeight: 600, color: '#1C1C1E',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Evaluate Another
            </button>
            <button
              onClick={() => router.push('/dashboard/goals/evaluate')}
              style={{
                flex: 1, padding: '13px', borderRadius: 12,
                background: '#3B7DFF', border: 'none',
                fontSize: 14, fontWeight: 700, color: 'white',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Add as Goal
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
