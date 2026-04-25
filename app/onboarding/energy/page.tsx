'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BLOCK_TYPES = [
  { id: 'deep', label: 'Deep Work', color: '#3B7DFF', icon: '⚡' },
  { id: 'light', label: 'Light Work', color: '#34C759', icon: '☕' },
  { id: 'creative', label: 'Creative', color: '#AF52DE', icon: '🎨' },
  { id: 'social', label: 'Social/Physical', color: '#FF9500', icon: '👥' },
  { id: 'recovery', label: 'Recovery', color: '#5856D6', icon: '🌙' },
]

const TIME_SLOTS = [
  '6:00','7:00','8:00','9:00','10:00','11:00',
  '12:00','13:00','14:00','15:00','16:00','17:00',
  '18:00','19:00','20:00','21:00','22:00',
]

export default function OnboardingEnergyPage() {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState('deep')
  const [assignments, setAssignments] = useState<Record<string, string>>({})

  const toggleSlot = (slot: string) => {
    setAssignments(prev => {
      if (prev[slot] === selectedType) {
        const updated = { ...prev }
        delete updated[slot]
        return updated
      }
      return { ...prev, [slot]: selectedType }
    })
  }

  const getSlotColor = (slot: string) => {
    const type = assignments[slot]
    if (!type) return { bg: 'white', color: '#3C3C43', border: '#D1D1D6' }
    const block = BLOCK_TYPES.find(b => b.id === type)
    return { bg: block?.color || 'white', color: 'white', border: block?.color || '#D1D1D6' }
  }

  const handleContinue = () => {
    sessionStorage.setItem('onboarding_energy', JSON.stringify(assignments))
    router.push('/onboarding/priorities')
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => router.push('/onboarding/work-schedule')}
        style={{ background: 'none', border: 'none', fontSize: 16, color: '#3C3C43', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        ← Back
      </button>

      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map(step => (
          <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: step <= 3 ? '#3B7DFF' : '#D1D1D6' }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 20 }}>Step 3 of 5</p>

      {/* Heading */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>
        Map your energy rhythm
      </h1>
      <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.5, marginBottom: 24 }}>
        When do you do your best work? Let's align your schedule with your natural energy.
      </p>

      {/* Block Type Selector */}
      <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '0.5px solid #D1D1D6' }}>
        <p style={{ fontSize: 14, color: '#8E8E93', marginBottom: 12 }}>Select block type:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {BLOCK_TYPES.map(block => (
            <button
              key={block.id}
              onClick={() => setSelectedType(block.id)}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: selectedType === block.id ? `2px solid ${block.color}` : '1px solid #D1D1D6',
                background: selectedType === block.id ? `${block.color}15` : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 500,
                color: '#1C1C1E',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 18, width: 24, height: 24, background: block.color, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {block.icon}
              </span>
              {block.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time Slot Grid */}
      <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '0.5px solid #D1D1D6' }}>
        <p style={{ fontSize: 14, color: '#8E8E93', marginBottom: 12 }}>Tap to assign blocks:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {TIME_SLOTS.map(slot => {
            const style = getSlotColor(slot)
            return (
              <button
                key={slot}
                onClick={() => toggleSlot(slot)}
                style={{
                  padding: '10px 4px',
                  borderRadius: 10,
                  border: `1px solid ${style.border}`,
                  background: style.bg,
                  color: style.color,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {slot}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tip */}
      <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '14px 16px', marginBottom: 32, border: '0.5px solid #BFDBFE' }}>
        <p style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 1.5, margin: 0 }}>
          <strong>Tip:</strong> Most people do deep work best in the morning, creative work in the afternoon, and need recovery time in the evening.
        </p>
      </div>

      {/* Bottom Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => router.push('/onboarding/priorities')}
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