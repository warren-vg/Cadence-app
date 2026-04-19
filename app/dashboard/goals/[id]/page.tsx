'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateGoalDetails, type Milestone } from '../_utils/generate'
import { getProjects, linkGoalToProject, unlinkGoalFromProject, type Project } from '@/lib/projectData'

interface Goal {
  id: string
  text: string
  category: string
  status: string
  priority: number
  progress: number
  quarter?: string | null
  refined_goal?: string | null
  metric?: string | null
  purpose?: string | null
  steps?: string[] | null
  milestones?: Milestone[] | null
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Career:           { bg: '#EFF6FF', color: '#3B7DFF' },
  Finance:          { bg: '#F0FFF4', color: '#16A34A' },
  Health:           { bg: '#FFF0F5', color: '#EC4899' },
  Creative:         { bg: '#FFF7ED', color: '#EA580C' },
  Travel:           { bg: '#F0F9FF', color: '#0284C7' },
  Relationships:    { bg: '#FDF4FF', color: '#9333EA' },
  Business:         { bg: '#FFFBEB', color: '#D97706' },
  Community:        { bg: '#F0FDF4', color: '#15803D' },
  'Personal Growth':{ bg: '#FDF4FF', color: '#9333EA' },
  Education:        { bg: '#EFF6FF', color: '#3B7DFF' },
}

function getCatStyle(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: '#F2F2F7', color: '#8E8E93' }
}

function statusLabel(status: string): string {
  if (status === 'active')   return 'Active'
  if (status === 'parking' || status === 'parked') return 'Parked'
  if (status === 'archived') return 'Archived'
  return 'Inbox'
}

function statusColors(status: string): { bg: string; color: string } {
  if (status === 'active')   return { bg: '#F0FFF4', color: '#16A34A' }
  if (status === 'parking' || status === 'parked') return { bg: '#FFFBEB', color: '#D97706' }
  if (status === 'archived') return { bg: '#F5F5F5', color: '#8E8E93' }
  return { bg: '#EFF6FF', color: '#3B7DFF' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionActions({ onAdd, onEdit, onRegenerate }: {
  onAdd?: () => void
  onEdit: () => void
  onRegenerate: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {onAdd && (
        <button onClick={onAdd} style={actionBtnStyle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      )}
      <button onClick={onEdit} style={actionBtnStyle}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit
      </button>
      <button onClick={onRegenerate} style={actionBtnStyle}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10" />
          <path d="M17 7l5-5-5-5" />
        </svg>
        Regenerate
      </button>
    </div>
  )
}

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  display: 'flex', alignItems: 'center', gap: 4,
  fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', fontWeight: 500,
}

function MilestoneRow({ milestone, onToggle }: {
  milestone: Milestone
  onToggle: (id: string) => void
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}
      onClick={() => onToggle(milestone.id)}
    >
      {milestone.completed ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, cursor: 'pointer' }}>
          <circle cx="12" cy="12" r="10" fill="#F0FFF4" stroke="#16A34A" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ) : (
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          border: '1.5px solid #D1D1D6', flexShrink: 0, cursor: 'pointer',
        }} />
      )}
      <span style={{
        fontSize: 14, color: milestone.completed ? '#8E8E93' : '#1C1C1E',
        textDecoration: milestone.completed ? 'line-through' : 'none',
        cursor: 'pointer',
      }}>
        {milestone.text}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [goal, setGoal]             = useState<Goal | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refinedGoal, setRefinedGoal] = useState('')
  const [metric, setMetric]         = useState('')
  const [purpose, setPurpose]       = useState('')
  const [steps, setSteps]           = useState<string[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])

  // Inline edit states
  const [editingRefined, setEditingRefined] = useState(false)
  const [editRefinedVal, setEditRefinedVal] = useState('')
  const [editingMetric, setEditingMetric]   = useState(false)
  const [editMetricVal, setEditMetricVal]   = useState('')
  const [editingPurpose, setEditingPurpose] = useState(false)
  const [editPurposeVal, setEditPurposeVal] = useState('')
  const [editingSteps, setEditingSteps]     = useState(false)
  const [editStepsVal, setEditStepsVal]     = useState('')

  // Details inline edit
  const [editingDetails, setEditingDetails] = useState(false)
  const [editCategory, setEditCategory]     = useState('')
  const [editQuarter, setEditQuarter]       = useState('')
  const [editProjectId, setEditProjectId]   = useState<string>('')
  const [projects, setProjects]             = useState<Project[]>([])

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    setProjects(getProjects().filter(p => p.status !== 'archived'))
  }, [])

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

      const quarter = data.quarter || 'Q4 2026'

      // Use stored details if they exist, otherwise generate
      if (data.refined_goal) {
        setRefinedGoal(data.refined_goal)
        setMetric(data.metric || '')
        setPurpose(data.purpose || '')
        setSteps(data.steps || [])
        setMilestones(data.milestones || [])
      } else {
        const generated = generateGoalDetails(data.text, data.category, quarter, data.id)
        setRefinedGoal(generated.refinedGoal)
        setMetric(generated.metric)
        setPurpose(generated.purpose)
        setSteps(generated.steps)
        setMilestones(generated.milestones)

        // Persist generated details (ignore column-not-found errors gracefully)
        supabase.from('goals').update({
          refined_goal: generated.refinedGoal,
          metric: generated.metric,
          purpose: generated.purpose,
          steps: generated.steps,
          milestones: generated.milestones,
        }).eq('id', id).then(({ error }) => {
          if (error) console.warn('Could not persist generated details:', error.message)
        })
      }

      setLoading(false)
    }
    load()
  }, [id])

  const persist = async (updates: Record<string, unknown>) => {
    const { error } = await supabase.from('goals').update(updates).eq('id', id)
    if (error) console.warn('Persist error:', error.message)
  }

  const toggleMilestone = async (milestoneId: string) => {
    const updated = milestones.map(m =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    )
    setMilestones(updated)
    await persist({ milestones: updated })
  }

  const saveRefined = async () => {
    setRefinedGoal(editRefinedVal)
    setEditingRefined(false)
    await persist({ refined_goal: editRefinedVal })
  }

  const saveMetric = async () => {
    setMetric(editMetricVal)
    setEditingMetric(false)
    await persist({ metric: editMetricVal })
  }

  const savePurpose = async () => {
    setPurpose(editPurposeVal)
    setEditingPurpose(false)
    await persist({ purpose: editPurposeVal })
  }

  const saveSteps = async () => {
    const parsed = editStepsVal.split('\n').map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
    setSteps(parsed)
    setEditingSteps(false)
    await persist({ steps: parsed })
  }

  const updateStatus = async (newStatus: string) => {
    setGoal(prev => prev ? { ...prev, status: newStatus } : prev)
    await supabase.from('goals').update({ status: newStatus }).eq('id', id)
  }

  const deleteGoal = async () => {
    setDeleting(true)
    await supabase.from('goals').delete().eq('id', id)
    router.push('/dashboard/goals')
  }

  if (loading || !goal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const catStyle = getCatStyle(goal.category)
  const sStyle   = statusColors(goal.status)
  const quarter  = goal.quarter || 'Q4 2026'

  return (
    <div style={{ padding: '56px 16px 40px' }}>

      {/* Back nav */}
      <button
        onClick={() => router.push('/dashboard/goals')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 16, padding: 0,
          color: '#3C3C43', fontFamily: 'inherit', fontSize: 15,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Goals
      </button>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 500, background: catStyle.bg, color: catStyle.color, padding: '4px 10px', borderRadius: 20 }}>
          {goal.category}
        </span>
        {goal.quarter && (
          <span style={{ fontSize: 12, color: '#8E8E93', background: '#F2F2F7', padding: '4px 8px', borderRadius: 20 }}>
            {goal.quarter}
          </span>
        )}
        <span style={{ fontSize: 12, fontWeight: 500, background: sStyle.bg, color: sStyle.color, padding: '4px 10px', borderRadius: 20 }}>
          {statusLabel(goal.status)}
        </span>
      </div>

      {/* Goal title */}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: '0 0 20px', lineHeight: 1.25 }}>
        {goal.text}
      </h1>

      {/* Progress card */}
      <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>Progress</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#3B7DFF' }}>{goal.progress || 0}%</span>
        </div>
        <div style={{ background: '#E5E5EA', borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${goal.progress || 0}%`,
            background: '#1C1C1E', borderRadius: 6,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Refined Goal card */}
      <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>Refined Goal</span>
          <SectionActions
            onEdit={() => { setEditRefinedVal(refinedGoal); setEditingRefined(true) }}
            onRegenerate={() => router.push(`/dashboard/goals/${id}/refine`)}
          />
        </div>

        {editingRefined ? (
          <>
            <textarea
              value={editRefinedVal}
              onChange={e => setEditRefinedVal(e.target.value)}
              style={{
                width: '100%', minHeight: 72, border: '0.5px solid #E5E5EA',
                borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#1C1C1E',
                fontFamily: 'inherit', resize: 'none', outline: 'none',
                lineHeight: 1.5, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={saveRefined} style={saveBtn}>Save</button>
              <button onClick={() => setEditingRefined(false)} style={cancelBtn}>Cancel</button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 14, color: '#3B7DFF', margin: '0 0 14px', lineHeight: 1.5 }}>{refinedGoal}</p>
        )}

        <div style={{ borderTop: '0.5px solid #F2F2F7', paddingTop: 12 }}>
          {/* Success Metric */}
          <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 4px', fontWeight: 500 }}>Success Metric</p>
          {editingMetric ? (
            <>
              <textarea
                value={editMetricVal}
                onChange={e => setEditMetricVal(e.target.value)}
                style={{ width: '100%', minHeight: 54, border: '0.5px solid #E5E5EA', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 12 }}>
                <button onClick={saveMetric} style={saveBtn}>Save</button>
                <button onClick={() => setEditingMetric(false)} style={cancelBtn}>Cancel</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <p style={{ fontSize: 14, color: '#1C1C1E', margin: 0, lineHeight: 1.5, flex: 1 }}>{metric}</p>
              <button onClick={() => { setEditMetricVal(metric); setEditingMetric(true) }} style={{ ...actionBtnStyle, marginLeft: 8, flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          )}

          {/* Purpose */}
          <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 4px', fontWeight: 500 }}>Purpose</p>
          {editingPurpose ? (
            <>
              <textarea
                value={editPurposeVal}
                onChange={e => setEditPurposeVal(e.target.value)}
                style={{ width: '100%', minHeight: 54, border: '0.5px solid #E5E5EA', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={savePurpose} style={saveBtn}>Save</button>
                <button onClick={() => setEditingPurpose(false)} style={cancelBtn}>Cancel</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ fontSize: 14, color: '#1C1C1E', margin: 0, lineHeight: 1.5, flex: 1 }}>{purpose}</p>
              <button onClick={() => { setEditPurposeVal(purpose); setEditingPurpose(true) }} style={{ ...actionBtnStyle, marginLeft: 8, flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Milestones card */}
      <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>Milestones</span>
          <SectionActions
            onAdd={() => {
              const text = prompt('New milestone:')
              if (!text?.trim()) return
              const newM: Milestone = { id: `${id}-m${Date.now()}`, text: text.trim(), completed: false }
              const updated = [...milestones, newM]
              setMilestones(updated)
              persist({ milestones: updated })
            }}
            onEdit={() => {
              const text = milestones.map(m => m.text).join('\n')
              const updated = prompt('Edit milestones (one per line):', text)
              if (updated === null) return
              const newMilestones: Milestone[] = updated.split('\n').filter(Boolean).map((t, i) => ({
                id: milestones[i]?.id || `${id}-m${Date.now()}-${i}`,
                text: t.trim(),
                completed: milestones[i]?.completed ?? false,
              }))
              setMilestones(newMilestones)
              persist({ milestones: newMilestones })
            }}
            onRegenerate={() => router.push(`/dashboard/goals/${id}/refine`)}
          />
        </div>
        {milestones.length === 0 ? (
          <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>No milestones yet.</p>
        ) : (
          milestones.map(m => (
            <MilestoneRow key={m.id} milestone={m} onToggle={toggleMilestone} />
          ))
        )}
      </div>

      {/* Action Steps card */}
      <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>Action Steps</span>
          <SectionActions
            onAdd={() => {
              const text = prompt('New action step:')
              if (!text?.trim()) return
              const updated = [...steps, text.trim()]
              setSteps(updated)
              persist({ steps: updated })
            }}
            onEdit={() => {
              setEditStepsVal(steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
              setEditingSteps(true)
            }}
            onRegenerate={() => router.push(`/dashboard/goals/${id}/refine`)}
          />
        </div>

        {editingSteps ? (
          <>
            <textarea
              value={editStepsVal}
              onChange={e => setEditStepsVal(e.target.value)}
              style={{
                width: '100%', minHeight: 140, border: '0.5px solid #E5E5EA',
                borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#1C1C1E',
                fontFamily: 'inherit', resize: 'none', outline: 'none',
                lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={saveSteps} style={saveBtn}>Save</button>
              <button onClick={() => setEditingSteps(false)} style={cancelBtn}>Cancel</button>
            </div>
          </>
        ) : steps.length === 0 ? (
          <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>No action steps yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#EFF6FF', color: '#3B7DFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
                }}>
                  {i + 1}
                </div>
                <p style={{ fontSize: 14, color: '#1C1C1E', margin: 0, lineHeight: 1.5 }}>{step}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details card */}
      <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>Details</span>
          {!editingDetails ? (
            <button
              onClick={() => {
                setEditCategory(goal.category)
                setEditQuarter(goal.quarter || 'Q2 2026')
                const linked = getProjects().find(p => (p.linkedGoalIds || []).includes(id))
                setEditProjectId(linked?.id || '')
                setEditingDetails(true)
              }}
              style={actionBtnStyle}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          ) : null}
        </div>

        {editingDetails ? (
          <>
            {/* Category dropdown */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <span style={{ fontSize: 13, color: '#8E8E93' }}>Category</span>
              </div>
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', background: '#F9F9FB', appearance: 'none', boxSizing: 'border-box' }}
              >
                {['Career','Finance','Health','Creative','Travel','Relationships','Business','Personal Growth','Education'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Timeline / Quarter dropdown */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <span style={{ fontSize: 13, color: '#8E8E93' }}>Timeline / Quarter</span>
              </div>
              <select
                value={editQuarter}
                onChange={e => setEditQuarter(e.target.value)}
                style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', background: '#F9F9FB', appearance: 'none', boxSizing: 'border-box' }}
              >
                {['Q1 2026','Q2 2026','Q3 2026','Q4 2026','Q1 2027','Q2 2027'].map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            {/* Project dropdown */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="6" height="6" rx="1"/><rect x="2" y="15" width="6" height="6" rx="1"/><rect x="10" y="3" width="12" height="6" rx="1"/><rect x="10" y="15" width="12" height="6" rx="1"/>
                </svg>
                <span style={{ fontSize: 13, color: '#8E8E93' }}>Project</span>
              </div>
              <select
                value={editProjectId}
                onChange={e => setEditProjectId(e.target.value)}
                style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', background: '#F9F9FB', appearance: 'none', boxSizing: 'border-box' }}
              >
                <option value="">None</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  setSaving(true)
                  // Update goal in Supabase
                  setGoal(prev => prev ? { ...prev, category: editCategory, quarter: editQuarter } : prev)
                  await persist({ category: editCategory, quarter: editQuarter })

                  // Handle project linking
                  const prevLinked = getProjects().find(p => (p.linkedGoalIds || []).includes(id))
                  if (prevLinked && prevLinked.id !== editProjectId) {
                    unlinkGoalFromProject(prevLinked.id, id)
                  }
                  if (editProjectId) {
                    linkGoalToProject(editProjectId, id)
                  }

                  setSaving(false)
                  setEditingDetails(false)
                }}
                disabled={saving}
                style={saveBtn}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingDetails(false)} style={cancelBtn}>Cancel</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '0.5px solid #F2F2F7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <span style={{ fontSize: 14, color: '#8E8E93' }}>Category</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{goal.category}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 12, borderBottom: '0.5px solid #F2F2F7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <span style={{ fontSize: 14, color: '#8E8E93' }}>Timeline</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{quarter}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="6" height="6" rx="1"/><rect x="2" y="15" width="6" height="6" rx="1"/><rect x="10" y="3" width="12" height="6" rx="1"/><rect x="10" y="15" width="12" height="6" rx="1"/>
                </svg>
                <span style={{ fontSize: 14, color: '#8E8E93' }}>Project</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>
                {getProjects().find(p => (p.linkedGoalIds || []).includes(id))?.title || '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Goal Status card */}
      <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Goal Status</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {(goal.status === 'active') && (
            <button
              onClick={() => updateStatus('parking')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#3C3C43', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              Pause Goal
            </button>
          )}
          {(goal.status === 'parking' || goal.status === 'parked') && (
            <button
              onClick={() => updateStatus('active')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#3C3C43', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Activate Goal
            </button>
          )}
          {goal.status !== 'archived' && (
            <button
              onClick={() => updateStatus('archived')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#3C3C43', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
              Archive
            </button>
          )}
          {goal.status === 'archived' && (
            <button
              onClick={() => updateStatus('active')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#16A34A', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Restore to Active
            </button>
          )}
        </div>
      </div>

      {/* Delete */}
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{
            width: '100%', padding: '14px', background: 'white',
            border: '0.5px solid #E5E5EA', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 14, fontWeight: 500, color: '#DC2626',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
          Delete Goal
        </button>
      ) : (
        <div style={{ background: '#FFF5F5', borderRadius: 14, padding: '16px 20px', border: '1px solid #FECACA' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#DC2626', margin: '0 0 4px' }}>Delete this goal?</p>
          <p style={{ fontSize: 13, color: '#7F1D1D', margin: '0 0 14px' }}>This action cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={deleteGoal}
              disabled={deleting}
              style={{ flex: 1, padding: '10px', background: '#DC2626', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1 }}
            >
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{ flex: 1, padding: '10px', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#3C3C43', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

const saveBtn: React.CSSProperties = {
  padding: '7px 16px', background: '#1C1C1E', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit',
}
const cancelBtn: React.CSSProperties = {
  padding: '7px 16px', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8,
  fontSize: 13, fontWeight: 500, color: '#3C3C43', cursor: 'pointer', fontFamily: 'inherit',
}
