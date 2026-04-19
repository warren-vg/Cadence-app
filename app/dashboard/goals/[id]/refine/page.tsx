'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateGoalDetails } from '../../_utils/generate'

interface Goal {
  id: string
  text: string
  category: string
  status: string
  quarter?: string | null
  refined_goal?: string | null
  metric?: string | null
  purpose?: string | null
  steps?: string[] | null
}

export default function GoalRefinePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [goal, setGoal]       = useState<Goal | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  // Editable refinement fields
  const [refinedGoal, setRefinedGoal] = useState('')
  const [metric, setMetric]           = useState('')
  const [purpose, setPurpose]         = useState('')
  const [whyItWorks, setWhyItWorks]   = useState<{ key: string; explanation: string }[]>([])

  // Track which variant is being shown (for "Generate Different Version")
  const [variant, setVariant] = useState(1)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error || !data) { router.push('/dashboard/goals'); return }

      setGoal(data)
      applyGeneration(data, variant)
      setLoading(false)
    }
    load()
  }, [id])

  const applyGeneration = (g: Goal, v: number) => {
    const quarter = g.quarter || 'Q4 2026'
    const generated = generateGoalDetails(g.text, g.category, quarter, g.id, v)
    setRefinedGoal(generated.refinedGoal)
    setMetric(generated.metric)
    setPurpose(generated.purpose)
    setWhyItWorks(generated.whyItWorks)
  }

  const handleGenerateDifferent = () => {
    if (!goal) return
    const next = variant + 1
    setVariant(next)
    applyGeneration(goal, next)
  }

  const handleAcceptAndSave = async () => {
    if (!goal) return
    setSaving(true)
    try {
      await supabase.from('goals').update({
        refined_goal: refinedGoal,
        metric,
        purpose,
      }).eq('id', id)
      router.push(`/dashboard/goals/${id}`)
    } catch (err) {
      console.error('Save refinement error:', err)
      setSaving(false)
    }
  }

  if (loading || !goal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '56px 16px 40px' }}>

      {/* Back */}
      <button
        onClick={() => router.push(`/dashboard/goals/${id}`)}
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
        Back
      </button>

      {/* AI tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#3B7DFF' }}>AI-Generated Refinement</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px' }}>Refine Your Goal</h1>
      <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 24px' }}>
        We've analyzed your goal and suggested improvements
      </p>

      {/* Original Goal (read-only) */}
      <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #E5E5EA', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: '#8E8E93', fontWeight: 500, margin: '0 0 6px' }}>Original Goal</p>
        <p style={{ fontSize: 14, color: '#3C3C43', margin: 0, lineHeight: 1.5 }}>{goal.text}</p>
      </div>

      {/* Editable refinement card */}
      <div style={{ background: 'white', borderRadius: 14, padding: '18px 16px', border: '0.5px solid #E5E5EA', marginBottom: 14 }}>

        {/* Refined Goal Statement */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#8E8E93', fontWeight: 500, margin: '0 0 8px' }}>Refined Goal Statement</p>
          <textarea
            value={refinedGoal}
            onChange={e => setRefinedGoal(e.target.value)}
            style={{
              width: '100%', minHeight: 72,
              background: '#F9F9F9', border: '1px solid #E5E5EA',
              borderRadius: 10, padding: '12px',
              fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit',
              resize: 'none', outline: 'none', lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Success Metric */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#8E8E93', fontWeight: 500, margin: '0 0 8px' }}>Success Metric</p>
          <textarea
            value={metric}
            onChange={e => setMetric(e.target.value)}
            style={{
              width: '100%', minHeight: 54,
              background: '#F9F9F9', border: '1px solid #E5E5EA',
              borderRadius: 10, padding: '12px',
              fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit',
              resize: 'none', outline: 'none', lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Purpose */}
        <div>
          <p style={{ fontSize: 12, color: '#8E8E93', fontWeight: 500, margin: '0 0 8px' }}>Purpose</p>
          <textarea
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            style={{
              width: '100%', minHeight: 54,
              background: '#F9F9F9', border: '1px solid #E5E5EA',
              borderRadius: 10, padding: '12px',
              fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit',
              resize: 'none', outline: 'none', lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Why This Refinement Works */}
      {whyItWorks.length > 0 && (
        <div style={{
          background: '#EFF6FF', borderRadius: 14, padding: '16px',
          border: '0.5px solid #BFDBFE', marginBottom: 20,
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1D4ED8', margin: '0 0 12px' }}>
            Why This Refinement Works
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {whyItWorks.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#3B7DFF', flexShrink: 0, marginTop: 6,
                }} />
                <p style={{ fontSize: 13, color: '#1D4ED8', margin: 0, lineHeight: 1.5 }}>
                  <strong>{item.key}</strong> {item.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate Different Version */}
      <button
        onClick={handleGenerateDifferent}
        style={{
          width: '100%', padding: '14px',
          background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 14, fontWeight: 500, color: '#3C3C43',
          cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" />
          <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" />
        </svg>
        Generate Different Version
      </button>

      {/* Skip / Accept */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => router.push(`/dashboard/goals/${id}`)}
          style={{
            flex: 1, padding: '15px',
            background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 14,
            fontSize: 15, fontWeight: 500, color: '#3C3C43',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Skip
        </button>
        <button
          onClick={handleAcceptAndSave}
          disabled={saving}
          style={{
            flex: 2, padding: '15px',
            background: saving ? '#8E8E93' : '#3B7DFF',
            border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 600, color: 'white',
            cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving...' : 'Accept & Save'}
        </button>
      </div>

    </div>
  )
}
