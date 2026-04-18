'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  toDateStr, getMonday, getWeekSummary, saveReflection, getAllReflections,
} from '@/lib/planData'

const AI_INSIGHTS = [
  "You're most productive on Tue/Wed mornings — protect this time",
  'Creative work is getting squeezed — consider blocking Friday afternoons',
  'Your health goal has strong momentum — keep the streak going',
]

export default function WeeklyReviewPage() {
  const router = useRouter()
  const [wins, setWins] = useState('')
  const [challenges, setChallenges] = useState('')
  const [learnings, setLearnings] = useState('')
  const [nextFocus, setNextFocus] = useState('')
  const [showInsights, setShowInsights] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load existing reflection for this week if any
    try {
      const monday = getMonday(new Date())
      const weekOf = toDateStr(monday)
      const existing = getAllReflections().find(r => r.weekOf === weekOf)
      if (existing) {
        setWins(existing.wins)
        setChallenges(existing.challenges)
        setLearnings(existing.learnings)
        setNextFocus(existing.nextWeekFocus)
      }
    } catch { /* ignore */ }
  }, [])

  if (!mounted) return null

  const today = new Date()
  const monday = getMonday(today)
  const summary = getWeekSummary(monday)
  const weekScore = summary.totalTasks > 0
    ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
    : 0

  const streak = 4 // mock streak

  const handleSave = () => {
    const weekOf = toDateStr(monday)
    saveReflection({
      weekOf,
      wins,
      challenges,
      learnings,
      nextWeekFocus: nextFocus,
      weekScore,
    })
    setSubmitted(true)
  }

  const handleBuildNext = () => {
    router.push('/dashboard/plan/weekly')
  }

  if (submitted) {
    return (
      <div style={{ padding: '0 0 16px' }}>
        <div style={{ padding: '56px 16px 16px', background: 'white', borderBottom: '0.5px solid #E5E5EA' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Review Saved</h1>
        </div>
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F0FFF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>Week logged!</p>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 32px' }}>Your reflection has been saved.</p>
          <button
            onClick={handleBuildNext}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: '#3B7DFF', border: 'none', color: 'white',
              fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Build Next Week
          </button>
        </div>
      </div>
    )
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
          Plan
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Weekly Review</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>
          Week of {monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
          {new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Week Score Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
          borderRadius: 18, padding: '20px',
          marginBottom: 14, color: 'white',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 13, opacity: 0.8, margin: '0 0 4px' }}>Week Score</p>
              <p style={{ fontSize: 44, fontWeight: 800, margin: '0 0 12px', lineHeight: 1 }}>{weekScore}</p>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: 'Completed', value: `${summary.completedTasks}/${summary.totalTasks}` },
                  { label: 'Goals Moved', value: '3/4' },
                  { label: 'Streak', value: `${streak} weeks` },
                ].map(s => (
                  <div key={s.label}>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 1px' }}>{s.value}</p>
                    <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
          </div>
        </div>

        {/* Reflection Forms */}
        {[
          { label: 'What went well this week?', placeholder: 'Celebrate your wins, big and small...', value: wins, setter: setWins },
          { label: 'What blocked your progress?', placeholder: 'What got in the way?', value: challenges, setter: setChallenges },
          { label: 'What did you learn?', placeholder: 'Key insights and lessons...', value: learnings, setter: setLearnings },
          { label: 'Next week focus', placeholder: 'What\'s the one thing to prioritize?', value: nextFocus, setter: setNextFocus },
        ].map(field => (
          <div key={field.label} style={{
            background: 'white', borderRadius: 14, padding: '16px',
            border: '0.5px solid #E5E5EA', marginBottom: 10,
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: '0 0 10px' }}>{field.label}</p>
            <textarea
              value={field.value}
              onChange={e => field.setter(e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              style={{
                width: '100%', border: '0.5px solid #E5E5EA', borderRadius: 10,
                padding: '12px', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit',
                resize: 'none', outline: 'none', boxSizing: 'border-box',
                background: '#F8F8FC',
              }}
            />
          </div>
        ))}

        {/* AI Insights */}
        {showInsights && (
          <div style={{
            background: '#EFF6FF', borderRadius: 14, padding: '16px',
            border: '1px solid #DBEAFE', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1D4ED8', margin: 0 }}>AI Insights</p>
            </div>
            {AI_INSIGHTS.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < AI_INSIGHTS.length - 1 ? 8 : 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3B7DFF', marginTop: 7, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 1.5 }}>{ins}</span>
              </div>
            ))}
          </div>
        )}

        {/* Generate Insights Button */}
        <button
          onClick={() => setShowInsights(v => !v)}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, marginBottom: 10,
            background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {showInsights ? 'Hide Insights' : 'Generate Insights'}
        </button>

        {/* Save Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              background: 'white', border: '0.5px solid #E5E5EA', color: '#3C3C43',
              fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
            onClick={() => router.back()}
          >
            Skip Reflection
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 2, padding: '13px', borderRadius: 12,
              background: '#3B7DFF', border: 'none', color: 'white',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Save & Continue
          </button>
        </div>

        <button
          onClick={handleBuildNext}
          style={{
            width: '100%', padding: '15px', borderRadius: 14,
            background: '#1C1C1E', border: 'none', color: 'white',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Build Next Week
        </button>
      </div>
    </div>
  )
}
