'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface GoalEntry {
  text: string
  category: string
}

export default function OnboardingPrioritiesPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<GoalEntry[]>([])
  const [parked, setParked] = useState<GoalEntry[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('onboarding_goals')
    if (stored) {
      const all: GoalEntry[] = JSON.parse(stored)
      setGoals(all.slice(0, 4))
      setParked(all.slice(4))
    }
  }, [])

  const moveUp = (index: number) => {
    if (index === 0) return
    const updated = [...goals]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setGoals(updated)
  }

  const moveDown = (index: number) => {
    if (index === goals.length - 1) return
    const updated = [...goals]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    setGoals(updated)
  }

const handleAccept = async () => {
  setSaving(true)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Save goals to database
    const storedGoals = sessionStorage.getItem('onboarding_goals')
    if (storedGoals && storedGoals !== '[]') {
      try {
        const allGoals: GoalEntry[] = JSON.parse(storedGoals)
        if (allGoals.length > 0) {
          const goalsToInsert = allGoals.map((g, i) => ({
            user_id: user.id,
            text: g.text,
            category: g.category,
            status: i < 4 ? 'active' : 'parking',
            priority: i,
            progress: 0,
          }))
          const { error: goalsError } = await supabase
            .from('goals')
            .insert(goalsToInsert)
          if (goalsError) console.error('Goals insert error:', goalsError)
        }
      } catch (e) {
        console.error('Goals parse error:', e)
      }
    }

    // Save energy blocks
    const storedEnergy = sessionStorage.getItem('onboarding_energy')
    if (storedEnergy) {
      const assignments: Record<string, string> = JSON.parse(storedEnergy)
      const blocksToInsert = Object.entries(assignments).map(([time, type]) => ({
        user_id: user.id,
        type,
        start_time: time,
        end_time: time,
        day_of_week: 'Monday',
      }))
      if (blocksToInsert.length > 0) {
        await supabase.from('energy_blocks').insert(blocksToInsert)
      }
    }

    // Save priority stack
    if (goals.length > 0) {
      const priorityInsert = goals.map((g, i) => ({
        user_id: user.id,
        category: g.category,
        rank: i + 1,
      }))
      await supabase.from('priority_stack').insert(priorityInsert)
    }

    // Mark onboarding complete
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', user.id)

    // Clear session storage
    sessionStorage.removeItem('onboarding_goals')
    sessionStorage.removeItem('onboarding_energy')

    router.push('/dashboard')
  } catch (err) {
    console.error('Onboarding save error:', err)
  } finally {
    setSaving(false)
  }
}

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => router.push('/onboarding/energy')}
        style={{ background: 'none', border: 'none', fontSize: 16, color: '#3C3C43', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        ← Back
      </button>

      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[1, 2, 3].map(step => (
          <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: '#3B7DFF' }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 20 }}>Step 3 of 3</p>

      {/* Heading */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>
        Build your priority stack
      </h1>
      <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.5, marginBottom: 28 }}>
        Focus on what matters most. Reorder your goals by priority.
      </p>

      {/* Top Priorities */}
      {goals.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1C1C1E' }}>Top Priorities</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {goals.map((goal, i) => (
              <div
                key={i}
                style={{
                  background: 'white',
                  borderRadius: 14,
                  padding: '14px 16px',
                  border: '0.5px solid #D1D1D6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {/* Rank number */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#3B7DFF', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {i + 1}
                </div>

                {/* Goal text */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E', margin: 0 }}>{goal.text}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#3B7DFF', background: '#EFF6FF', padding: '2px 8px', borderRadius: 20 }}>{goal.category}</span>
                    <span style={{ fontSize: 12, color: '#8E8E93' }}>Impact: High</span>
                  </div>
                </div>

                {/* Up/Down controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button onClick={() => moveUp(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: i === 0 ? '#D1D1D6' : '#8E8E93', padding: '2px 6px' }}>▲</button>
                  <button onClick={() => moveDown(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: i === goals.length - 1 ? '#D1D1D6' : '#8E8E93', padding: '2px 6px' }}>▼</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Parked Goals */}
      {parked.length > 0 && (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1C1C1E', marginBottom: 12 }}>Parked Goals</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {parked.map((goal, i) => (
              <div
                key={i}
                style={{
                  background: '#F9F9F9',
                  borderRadius: 14,
                  padding: '14px 16px',
                  border: '0.5px solid #E5E5EA',
                }}
              >
                <p style={{ fontSize: 15, color: '#3C3C43', margin: 0 }}>{goal.text}</p>
                <span style={{ fontSize: 12, color: '#8E8E93', background: '#F2F2F7', padding: '2px 8px', borderRadius: 20, marginTop: 6, display: 'inline-block' }}>{goal.category}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {goals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8E8E93' }}>
          <p style={{ fontSize: 15 }}>No goals added yet.</p>
          <p style={{ fontSize: 13 }}>Go back and add some goals first.</p>
        </div>
      )}

      {/* Accept Stack Button */}
      <button
        onClick={handleAccept}
        disabled={saving}
        style={{
          width: '100%',
          padding: '16px',
          background: '#3B7DFF',
          border: 'none',
          borderRadius: 16,
          fontSize: 16,
          fontWeight: 600,
          color: 'white',
          cursor: 'pointer',
          fontFamily: 'inherit',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Accept Stack'}
      </button>
    </div>
  )
}