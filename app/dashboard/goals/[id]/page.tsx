'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateGoalDetails } from '../_utils/generate'
import {
  getProjects, DEFAULT_WORK_SCHEDULE, recalcGoalProgressFromTasks, createRecurringTask,
  type DBProject, type DBMilestone,
  getMilestonesForGoal, createMilestone, updateMilestone, deleteMilestone,
  toggleMilestoneCompleted, replaceMilestonesForGoal,
} from '@/lib/db'
import { generateTasksForGoalV2 } from '@/lib/goalTemplates'
import { getCatStyle } from '@/lib/planData'

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
  project_id?: string | null
}

function currentQuarterLabel(): string {
  const now = new Date()
  return `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`
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
  onEdit?: () => void
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
      {onEdit && (
        <button onClick={onEdit} style={actionBtnStyle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </button>
      )}
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

function MilestoneRow({ milestone, onToggle, onEdit }: {
  milestone: DBMilestone
  onToggle: (id: string) => void
  onEdit: (milestone: DBMilestone) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
      <button
        onClick={() => onToggle(milestone.id)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, display: 'flex' }}
      >
        {milestone.completed ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" fill="#F0FFF4" stroke="#16A34A" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        ) : (
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #D1D1D6' }} />
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 14, color: milestone.completed ? '#8E8E93' : '#1C1C1E',
          textDecoration: milestone.completed ? 'line-through' : 'none',
        }}>
          {milestone.text}
        </span>
        {milestone.target_date && (
          <p style={{ fontSize: 12, color: '#8E8E93', margin: '2px 0 0' }}>
            Due {new Date(milestone.target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>
      <button
        onClick={() => onEdit(milestone)}
        style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', flexShrink: 0, color: '#C7C7CC' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
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
  const [milestones, setMilestones] = useState<DBMilestone[]>([])

  // Inline edit states
  const [editingRefined, setEditingRefined] = useState(false)
  const [editRefinedVal, setEditRefinedVal] = useState('')
  const [editingMetric, setEditingMetric]   = useState(false)
  const [editMetricVal, setEditMetricVal]   = useState('')
  const [editingPurpose, setEditingPurpose] = useState(false)
  const [editPurposeVal, setEditPurposeVal] = useState('')
  const [editingSteps, setEditingSteps]     = useState(false)
  const [editStepsVal, setEditStepsVal]     = useState('')

  const [userId, setUserId]                 = useState<string | null>(null)

  // Variant counters so each Regenerate click produces a different result
  const [refinedVariant, setRefinedVariant]       = useState(0)
  const [milestonesVariant, setMilestonesVariant] = useState(0)
  const [stepsVariant, setStepsVariant]           = useState(0)

  // Details inline edit
  const [editingDetails, setEditingDetails] = useState(false)
  const [editCategory, setEditCategory]     = useState('')
  const [editQuarter, setEditQuarter]       = useState('')
  const [editProjectId, setEditProjectId]   = useState<string>('')
  const [projects, setProjects]             = useState<DBProject[]>([])
  const [linkedProject, setLinkedProject]   = useState<DBProject | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [saving, setSaving]         = useState(false)

  // Milestone edit modal
  const [milestoneModal, setMilestoneModal] = useState<{ mode: 'add' | 'edit'; milestone?: DBMilestone } | null>(null)
  const [milestoneText, setMilestoneText]   = useState('')
  const [milestoneDate, setMilestoneDate]   = useState('')
  const [savingMilestone, setSavingMilestone] = useState(false)

  const refreshProgress = useCallback(async (uid: string) => {
    const { data } = await supabase.from('goals').select('progress').eq('id', id).eq('user_id', uid).single()
    if (data) setGoal(prev => prev ? { ...prev, progress: data.progress } : prev)
  }, [id])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const projs = await getProjects(user.id)
      setProjects(projs.filter(p => p.status !== 'archived'))

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error || !data) { router.push('/dashboard/goals'); return }

      setGoal(data)
      setLinkedProject(projs.find(p => p.id === data.project_id) || null)

      const quarter = data.quarter || currentQuarterLabel()
      const dbMilestones = await getMilestonesForGoal(id, user.id)

      if (data.refined_goal) {
        setRefinedGoal(data.refined_goal)
        setMetric(data.metric || '')
        setPurpose(data.purpose || '')
        setSteps(data.steps || [])
        setMilestones(dbMilestones)
      } else {
        const generated = generateGoalDetails(data.text, data.category, quarter, data.id)
        setRefinedGoal(generated.refinedGoal)
        setMetric(generated.metric)
        setPurpose(generated.purpose)
        setSteps(data.steps && data.steps.length > 0 ? data.steps : generated.steps)

        if (dbMilestones.length > 0) {
          setMilestones(dbMilestones)
        } else {
          const ok = await replaceMilestonesForGoal(
            user.id, id,
            generated.milestones.map(m => ({ text: m.text, completed: m.completed }))
          )
          if (ok) setMilestones(await getMilestonesForGoal(id, user.id))
        }

        const stepsToSave = data.steps && data.steps.length > 0 ? data.steps : generated.steps
        supabase.from('goals').update({
          refined_goal: generated.refinedGoal,
          metric:       generated.metric,
          purpose:      generated.purpose,
          steps:        stepsToSave,
        }).eq('id', id).then(({ error: e }) => {
          if (e) console.warn('Could not persist generated details:', e.message)
        })
      }

      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!userId) return
    const onVisible = () => { if (document.visibilityState === 'visible') refreshProgress(userId) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, refreshProgress])

  const persist = async (updates: Record<string, unknown>) => {
    const { error } = await supabase.from('goals').update(updates).eq('id', id)
    if (error) console.warn('Persist error:', error.message)
  }

  const toggleMilestone = async (milestoneId: string) => {
    const target = milestones.find(m => m.id === milestoneId)
    if (!target) return
    const newCompleted = !target.completed
    setMilestones(prev => prev.map(m => m.id === milestoneId ? { ...m, completed: newCompleted } : m))
    await toggleMilestoneCompleted(milestoneId, newCompleted)
    // Progress is driven by tasks, not milestones — no goal progress update here
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

  const regenerateRefined = async () => {
    if (!goal) return
    const nextVariant = refinedVariant + 1
    setRefinedVariant(nextVariant)
    const q = goal.quarter || currentQuarterLabel()
    const gen = generateGoalDetails(goal.text, goal.category, q, id, nextVariant)
    setRefinedGoal(gen.refinedGoal)
    setMetric(gen.metric)
    setPurpose(gen.purpose)
    await persist({ refined_goal: gen.refinedGoal, metric: gen.metric, purpose: gen.purpose })
  }

  const regenerateMilestones = async () => {
    if (!goal || !userId) return
    const nextVariant = milestonesVariant + 1
    setMilestonesVariant(nextVariant)
    const q = goal.quarter || currentQuarterLabel()
    const gen = generateGoalDetails(goal.text, goal.category, q, id, nextVariant)
    const ok = await replaceMilestonesForGoal(userId, id, gen.milestones.map(m => ({ text: m.text, completed: false })))
    if (ok) setMilestones(await getMilestonesForGoal(id, userId))
  }

  const regenerateSteps = async () => {
    if (!goal) return
    const nextVariant = stepsVariant + 1
    setStepsVariant(nextVariant)
    const q = goal.quarter || currentQuarterLabel()
    const gen = generateGoalDetails(goal.text, goal.category, q, id, nextVariant)
    setSteps(gen.steps)
    await persist({ steps: gen.steps })
  }

  const openAddMilestone = () => {
    setMilestoneText('')
    setMilestoneDate('')
    setMilestoneModal({ mode: 'add' })
  }

  const openEditMilestone = (milestone: DBMilestone) => {
    setMilestoneText(milestone.text)
    setMilestoneDate(milestone.target_date ?? '')
    setMilestoneModal({ mode: 'edit', milestone })
  }

  const closeMilestoneModal = () => {
    setMilestoneModal(null)
    setMilestoneText('')
    setMilestoneDate('')
  }

  const handleSaveMilestone = async () => {
    if (!milestoneText.trim() || !userId) return
    setSavingMilestone(true)
    if (milestoneModal?.mode === 'add') {
      const created = await createMilestone(userId, id, milestoneText.trim())
      if (created) {
        if (milestoneDate) {
          await updateMilestone(created.id, { target_date: milestoneDate })
        }
        setMilestones(await getMilestonesForGoal(id, userId))
      }
    } else if (milestoneModal?.mode === 'edit' && milestoneModal.milestone) {
      const ok = await updateMilestone(milestoneModal.milestone.id, {
        text:        milestoneText.trim(),
        target_date: milestoneDate || null,
      })
      if (ok) setMilestones(await getMilestonesForGoal(id, userId))
    }
    setSavingMilestone(false)
    closeMilestoneModal()
  }

  const handleDeleteMilestone = async () => {
    if (!milestoneModal?.milestone) return
    setSavingMilestone(true)
    const ok = await deleteMilestone(milestoneModal.milestone.id)
    if (ok) setMilestones(prev => prev.filter(m => m.id !== milestoneModal.milestone!.id))
    setSavingMilestone(false)
    closeMilestoneModal()
  }

  const updateStatus = async (newStatus: string) => {
    const prevStatus = goal?.status
    setGoal(prev => prev ? { ...prev, status: newStatus } : prev)
    await supabase.from('goals').update({ status: newStatus }).eq('id', id)

    if (newStatus === 'active' && prevStatus !== 'active' && goal && userId) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('energy_blocks, work_schedule')
          .eq('id', userId)
          .single()
        const energyBlocks  = (profile?.energy_blocks  as Record<string, string>) || {}
        const workSchedule  = profile?.work_schedule || DEFAULT_WORK_SCHEDULE
        const generated = generateTasksForGoalV2(goal, energyBlocks, workSchedule, new Date())
        const onetimes = generated
          .filter((g): g is Extract<typeof g, { kind: 'onetime' }> => g.kind === 'onetime')
          .map(g => ({ ...g.task, user_id: userId }))
        if (onetimes.length > 0) {
          await supabase.from('tasks').insert(onetimes)
        }
        for (const g of generated.filter((g): g is Extract<typeof g, { kind: 'recurring' }> => g.kind === 'recurring')) {
          await createRecurringTask(userId, g.payload.taskData, g.payload.rule)
        }
        if (generated.length > 0) {
          await recalcGoalProgressFromTasks(goal.id, userId)
        }
      } catch (e) {
        console.warn('Task generation failed:', e)
      }
    }
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
  const quarter  = goal.quarter || currentQuarterLabel()

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
            onRegenerate={regenerateRefined}
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
            onAdd={openAddMilestone}
            onRegenerate={regenerateMilestones}
          />
        </div>
        {milestones.length === 0 ? (
          <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>No milestones yet.</p>
        ) : (
          milestones.map(m => (
            <MilestoneRow key={m.id} milestone={m} onToggle={toggleMilestone} onEdit={openEditMilestone} />
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
            onRegenerate={regenerateSteps}
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
                setEditQuarter(goal.quarter || currentQuarterLabel())
                setEditProjectId(linkedProject?.id || '')
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

                  // Update this goal's project link via goals.project_id
                  const newProjectId = editProjectId || null
                  const currentProjectId = goal?.project_id ?? null
                  if (newProjectId !== currentProjectId) {
                    await supabase.from('goals').update({ project_id: newProjectId }).eq('id', id)
                    setGoal(prev => prev ? { ...prev, project_id: newProjectId } : prev)
                    setLinkedProject(newProjectId ? (projects.find(p => p.id === newProjectId) || null) : null)
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
                {linkedProject?.title || '—'}
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
              onClick={() => updateStatus('parked')}
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

      {/* Milestone add / edit modal */}
      {milestoneModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={closeMilestoneModal}
        >
          <div
            style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px 44px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D1D6', margin: '0 auto 20px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>
                {milestoneModal.mode === 'add' ? 'Add Milestone' : 'Edit Milestone'}
              </h2>
              <button
                onClick={closeMilestoneModal}
                style={{ background: '#F2F2F7', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Milestone</p>
              <input
                value={milestoneText}
                onChange={e => setMilestoneText(e.target.value)}
                placeholder="e.g. First client signed"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>
                Target date <span style={{ fontWeight: 400, color: '#C7C7CC' }}>(optional)</span>
              </p>
              <input
                type="date"
                value={milestoneDate}
                onChange={e => setMilestoneDate(e.target.value)}
                style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
              />
            </div>

            <button
              onClick={handleSaveMilestone}
              disabled={!milestoneText.trim() || savingMilestone}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: milestoneText.trim() ? '#1C1C1E' : '#D1D1D6',
                color: 'white', fontSize: 15, fontWeight: 600,
                cursor: milestoneText.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit', marginBottom: 10,
                opacity: savingMilestone ? 0.6 : 1,
              }}
            >
              {savingMilestone ? 'Saving…' : milestoneModal.mode === 'add' ? 'Add Milestone' : 'Save Changes'}
            </button>

            {milestoneModal.mode === 'edit' && (
              <button
                onClick={handleDeleteMilestone}
                disabled={savingMilestone}
                style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'white', border: '0.5px solid #FECACA', color: '#DC2626', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Delete Milestone
              </button>
            )}
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
