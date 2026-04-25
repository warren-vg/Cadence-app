'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Career', 'Finance', 'Health', 'Creative', 'Travel', 'Relationships', 'Business', 'Community']

interface GoalEntry {
  text: string
  category: string
}

export default function OnboardingGoalsPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<GoalEntry[]>([{ text: '', category: 'Career' }])

  const updateGoal = (index: number, field: keyof GoalEntry, value: string) => {
    const updated = [...goals]
    updated[index] = { ...updated[index], [field]: value }
    setGoals(updated)
  }

  const addGoal = () => {
    setGoals([...goals, { text: '', category: 'Career' }])
  }

  const removeGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index))
  }

  const handleContinue = () => {
    const filled = goals.filter(g => g.text.trim())
    if (filled.length > 0) {
      sessionStorage.setItem('onboarding_goals', JSON.stringify(filled))
    }
    router.push('/onboarding/work-schedule')
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => router.push('/')}
        style={{ background: 'none', border: 'none', fontSize: 16, color: '#3C3C43', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        ← Back
      </button>

      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map(step => (
          <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: step === 1 ? '#3B7DFF' : '#D1D1D6' }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 20 }}>Step 1 of 5</p>

      {/* Heading */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>
        What are your goals?
      </h1>
      <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.5, marginBottom: 28 }}>
        Share your goals in plain English. We'll help you refine them later.
      </p>

      {/* Goal Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        {goals.map((goal, i) => (
          <div
            key={i}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '16px',
              border: '0.5px solid #D1D1D6',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <textarea
                placeholder="E.g., Launch my consulting business, Save $10k for travel..."
                value={goal.text}
                onChange={e => updateGoal(i, 'text', e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 15,
                  color: '#1C1C1E',
                  resize: 'none',
                  height: 72,
                  background: 'transparent',
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                }}
              />
              {goals.length > 1 && (
                <button
                  onClick={() => removeGoal(i)}
                  style={{ background: 'none', border: 'none', fontSize: 20, color: '#8E8E93', cursor: 'pointer', padding: '0 0 0 8px' }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => updateGoal(i, 'category', cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 500,
                    border: '0.5px solid #D1D1D6',
                    cursor: 'pointer',
                    background: goal.category === cat ? '#3B7DFF' : 'white',
                    color: goal.category === cat ? 'white' : '#3C3C43',
                    fontFamily: 'inherit',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Another Goal */}
      <button
        onClick={addGoal}
        style={{
          width: '100%',
          padding: '16px',
          background: 'white',
          border: '1.5px dashed #D1D1D6',
          borderRadius: 16,
          fontSize: 15,
          color: '#3C3C43',
          cursor: 'pointer',
          marginBottom: 32,
          fontFamily: 'inherit',
        }}
      >
        + Add Another Goal
      </button>

      {/* Bottom Actions */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={() => router.push('/onboarding/energy')}
          style={{
            flex: 1,
            padding: '16px',
            background: 'white',
            border: '0.5px solid #D1D1D6',
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 500,
            color: '#3C3C43',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Skip for now
        </button>
        <button
          onClick={handleContinue}
          style={{
            flex: 2,
            padding: '16px',
            background: '#3B7DFF',
            border: 'none',
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 600,
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}