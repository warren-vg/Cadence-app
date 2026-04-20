'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  evaluateOpportunity,
  type OpportunityInputs,
  type OpportunityResult,
} from '@/lib/opportunityScore'

// ─── Slider component ─────────────────────────────────────────────────────────

function Slider({
  label, sublabel, value, onChange, inverted,
}: {
  label: string; sublabel: string; value: number
  onChange: (v: number) => void; inverted?: boolean
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
        type="range" min={0} max={100} value={value}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_INPUTS: OpportunityInputs = {
  upside: 50, alignment: 50, urgency: 50,
  timeCost: 50, energyCost: 50, moneyCost: 50,
}

export default function OpportunityFilterPage() {
  const router = useRouter()

  const [title, setTitle]   = useState('')
  const [inputs, setInputs] = useState<OpportunityInputs>(DEFAULT_INPUTS)
  const [result, setResult] = useState<OpportunityResult | null>(null)
  const [running, setRunning] = useState(false)
  const [saving, setSaving]   = useState(false)

  const setField = (key: keyof OpportunityInputs) => (v: number) =>
    setInputs(prev => ({ ...prev, [key]: v }))

  const handleRun = () => {
    setRunning(true)
    setTimeout(() => {
      setResult(evaluateOpportunity(inputs))
      setRunning(false)
    }, 800)
  }

  const handleReset = () => {
    setTitle('')
    setInputs(DEFAULT_INPUTS)
    setResult(null)
  }

  const handleDecision = async (override?: 'accept') => {
    if (!result) return
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const decision = override ?? result.decision

        await supabase.from('opportunity_evaluations').insert({
          user_id:     user.id,
          title:       title.trim() || 'Untitled Opportunity',
          upside:      inputs.upside,
          alignment:   inputs.alignment,
          urgency:     inputs.urgency,
          time_cost:   inputs.timeCost,
          energy_cost: inputs.energyCost,
          money_cost:  inputs.moneyCost,
          score:       result.score,
          decision,
        })

        if (decision === 'accept') {
          await supabase.from('projects').insert({
            user_id: user.id,
            title:   title.trim() || 'New Opportunity',
            type:    'opportunity',
            status:  'planning',
          })
        }
      }
    } catch (err) {
      console.error('Save opportunity error:', err)
    }

    setSaving(false)
    router.push('/dashboard/projects')
  }

  return (
    <div style={{ padding: '56px 16px 40px', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>Projects</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Opportunity Filter</h1>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>Not every opportunity deserves your time</p>
        </div>
      </div>

      {/* Title */}
      <div style={{
        background: 'white', borderRadius: 16, border: '0.5px solid #E5E5EA',
        padding: '14px 16px', marginTop: 16, marginBottom: 14,
      }}>
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

      {/* Sliders — all 6 inputs */}
      <div style={{
        background: 'white', borderRadius: 16, border: '0.5px solid #E5E5EA',
        padding: '18px 16px', marginBottom: 14,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Benefits
        </p>
        <Slider label="Expected Upside"        sublabel="Potential value or impact"          value={inputs.upside}    onChange={setField('upside')}    />
        <Slider label="Alignment with Goals"   sublabel="Supports your current priorities"   value={inputs.alignment} onChange={setField('alignment')} />
        <Slider label="Urgency"                sublabel="Time-sensitivity of the decision"   value={inputs.urgency}   onChange={setField('urgency')}   />

        <div style={{ borderTop: '0.5px solid #F2F2F7', margin: '4px 0 16px' }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Costs
        </p>
        <Slider label="Time Cost"   sublabel="Hours required per week"     value={inputs.timeCost}   onChange={setField('timeCost')}   inverted />
        <Slider label="Energy Cost" sublabel="Mental / physical drain"     value={inputs.energyCost} onChange={setField('energyCost')} inverted />
        <Slider label="Money Cost"  sublabel="Financial investment needed"  value={inputs.moneyCost}  onChange={setField('moneyCost')}  inverted />
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
          {running ? 'Analyzing…' : 'Run Filter'}
        </button>
      )}

      {/* Result */}
      {result && (
        <>
          {/* Score card */}
          <div style={{
            background: result.bg, borderRadius: 18, padding: '22px 20px',
            marginBottom: 14, border: `1.5px solid ${result.color}33`, textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, margin: '0 0 4px' }}>{result.icon}</p>
            <p style={{ fontSize: 44, fontWeight: 800, color: result.color, margin: '0 0 4px', lineHeight: 1 }}>
              {result.score}
            </p>
            <p style={{ fontSize: 11, color: result.color, margin: '0 0 8px', opacity: 0.7 }}>out of 100</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: result.color, margin: '0 0 8px' }}>{result.label}</p>
            {title && <p style={{ fontSize: 13, color: '#3C3C43', margin: '0 0 8px', fontStyle: 'italic' }}>"{title}"</p>}
            <p style={{ fontSize: 13, color: '#3C3C43', margin: 0, lineHeight: 1.5 }}>{result.advice}</p>
          </div>

          {/* Rationale bullets */}
          {result.rationale.length > 0 && (
            <div style={{
              background: 'white', borderRadius: 16, padding: '16px 18px',
              border: '0.5px solid #E5E5EA', marginBottom: 14,
            }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px' }}>Key Signals</p>
              {result.rationale.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < result.rationale.length - 1 ? 8 : 0 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: result.color, marginTop: 7, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#3C3C43', lineHeight: 1.5 }}>{r}</span>
                </div>
              ))}
            </div>
          )}

          {/* Score breakdown */}
          <div style={{
            background: 'white', borderRadius: 18, padding: '18px 20px',
            marginBottom: 14, border: '0.5px solid #E5E5EA',
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Score Breakdown</p>
            {([
              { label: 'Upside',      effective: inputs.upside,          weight: '40%' },
              { label: 'Alignment',   effective: inputs.alignment,        weight: '35%' },
              { label: 'Urgency',     effective: inputs.urgency,          weight: '10%' },
              { label: 'Time Cost',   effective: 100 - inputs.timeCost,   weight: '40%' },
              { label: 'Energy Cost', effective: 100 - inputs.energyCost, weight: '35%' },
              { label: 'Money Cost',  effective: 100 - inputs.moneyCost,  weight: '10%' },
            ] as const).map(({ label, effective, weight }) => {
              const color = effective > 60 ? '#34C759' : effective > 35 ? '#FF9500' : '#FF3B30'
              return (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, color: '#3C3C43' }}>
                      {label} <span style={{ fontSize: 11, color: '#C7C7CC' }}>({weight})</span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color }}>{effective}</span>
                  </div>
                  <div style={{ background: '#F2F2F7', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${effective}%`, background: color, borderRadius: 4 }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {result.decision === 'accept' && (
              <button
                onClick={() => handleDecision()}
                disabled={saving}
                style={{
                  flex: 1, padding: '13px', borderRadius: 12,
                  background: '#16A34A', border: 'none',
                  fontSize: 14, fontWeight: 700, color: 'white',
                  cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Saving…' : 'Accept & Create Project'}
              </button>
            )}
            {result.decision === 'defer' && (
              <>
                <button
                  onClick={() => handleDecision()}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '13px', borderRadius: 12,
                    background: '#D97706', border: 'none',
                    fontSize: 14, fontWeight: 600, color: 'white',
                    cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Defer
                </button>
                <button
                  onClick={() => handleDecision('accept')}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '13px', borderRadius: 12,
                    background: '#16A34A', border: 'none',
                    fontSize: 14, fontWeight: 600, color: 'white',
                    cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Accept Anyway
                </button>
              </>
            )}
            {result.decision === 'reject' && (
              <button
                onClick={() => handleDecision()}
                disabled={saving}
                style={{
                  flex: 1, padding: '13px', borderRadius: 12,
                  background: '#DC2626', border: 'none',
                  fontSize: 14, fontWeight: 700, color: 'white',
                  cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Saving…' : 'Pass on This'}
              </button>
            )}
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
          </div>
        </>
      )}
    </div>
  )
}
