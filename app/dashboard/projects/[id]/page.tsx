'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getProjectById, getProjectTasks, createProjectTask,
  toggleProjectTask, updateProject, deleteProject,
  type DBProject, type DBProjectTask,
} from '@/lib/db'

interface Goal {
  id: string
  text: string
  category: string
  progress: number
  status: string
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Career:            { bg: '#EFF6FF', color: '#3B7DFF' },
  Finance:           { bg: '#F0FFF4', color: '#16A34A' },
  Health:            { bg: '#FFF0F5', color: '#EC4899' },
  Creative:          { bg: '#FFF7ED', color: '#EA580C' },
  Travel:            { bg: '#F0F9FF', color: '#0284C7' },
  Relationships:     { bg: '#FDF4FF', color: '#9333EA' },
  Business:          { bg: '#FFFBEB', color: '#D97706' },
  'Personal Growth': { bg: '#FDF4FF', color: '#9333EA' },
  Education:         { bg: '#EFF6FF', color: '#3B7DFF' },
}
function getCatStyle(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: '#F2F2F7', color: '#8E8E93' }
}

const TYPE_COLORS: Record<DBProject['type'], string> = {
  campaign: '#3B7DFF', study: '#9B59B6', creative: '#EA580C', opportunity: '#16A34A', business: '#D97706',
}

const STATUS_STYLES: Record<DBProject['status'], { bg: string; color: string; label: string }> = {
  active:    { bg: '#DCFCE7', color: '#16A34A', label: 'active' },
  planning:  { bg: '#EFF6FF', color: '#3B7DFF', label: 'planning' },
  paused:    { bg: '#FFF7ED', color: '#EA580C', label: 'paused' },
  completed: { bg: '#F2F2F7', color: '#8E8E93', label: 'done' },
  archived:  { bg: '#F5F5F5', color: '#8E8E93', label: 'archived' },
}

const TYPE_OPTIONS: { value: DBProject['type']; label: string }[] = [
  { value: 'campaign', label: 'Campaign' },
  { value: 'study', label: 'Study' },
  { value: 'creative', label: 'Creative' },
  { value: 'opportunity', label: 'Opportunity' },
]

const AI_SUGGESTIONS = [
  'Consider breaking the next task into smaller subtasks',
  'Schedule dedicated focus time for this project this week',
  'Review progress with stakeholders before next milestone',
]

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [project, setProject]     = useState<DBProject | null>(null)
  const [tasks, setTasks]         = useState<DBProjectTask[]>([])
  const [linkedGoal, setLinkedGoal] = useState<Goal | null>(null)
  const [userId, setUserId]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  // Edit state
  const [editing, setEditing]         = useState(false)
  const [editTitle, setEditTitle]     = useState('')
  const [editType, setEditType]       = useState<DBProject['type']>('campaign')
  const [editTimeline, setEditTimeline] = useState('')
  const [editNotes, setEditNotes]     = useState('')
  const [saving, setSaving]           = useState(false)

  // Add task state
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [addingTask, setAddingTask]   = useState(false)

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const [p, t] = await Promise.all([
        getProjectById(id),
        getProjectTasks(id),
      ])
      if (!p) { router.push('/dashboard/projects'); return }
      setProject(p)
      setTasks(t)

      if (p.linked_goal_id) {
        const { data } = await supabase
          .from('goals')
          .select('id, text, category, progress, status')
          .eq('id', p.linked_goal_id)
          .single()
        if (data) setLinkedGoal(data)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const openEdit = () => {
    if (!project) return
    setEditTitle(project.title)
    setEditType(project.type)
    setEditTimeline(project.timeline || '')
    setEditNotes(project.notes || '')
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!project) return
    setSaving(true)
    const newTitle    = editTitle.trim() || project.title
    const newTimeline = editTimeline.trim() || null
    const newNotes    = editNotes.trim() || null
    const ok = await updateProject(id, { title: newTitle, type: editType, timeline: newTimeline, notes: newNotes })
    if (ok) setProject(prev => prev ? { ...prev, title: newTitle, type: editType, timeline: newTimeline, notes: newNotes } : prev)
    setSaving(false)
    setEditing(false)
  }

  const handleToggleTask = async (task: DBProjectTask) => {
    const newCompleted = !task.completed
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted } : t))
    const newProgress = await toggleProjectTask(task.id, id, task.completed)
    if (newProgress !== null) {
      setProject(prev => prev ? { ...prev, progress: newProgress } : prev)
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t))
    }
  }

  const handleAddTask = async () => {
    if (!newTaskText.trim() || !userId) return
    setAddingTask(true)
    const created = await createProjectTask(userId, id, newTaskText.trim(), tasks.length)
    if (created) {
      setTasks(prev => [...prev, created])
      const total = tasks.length + 1
      const done  = tasks.filter(t => t.completed).length
      setProject(prev => prev ? { ...prev, progress: Math.round((done / total) * 100) } : prev)
      setNewTaskText('')
      setShowAddTask(false)
    }
    setAddingTask(false)
  }

  const handleArchive = async () => {
    const updated = await updateProject(id, { status: 'archived' })
    if (updated) router.push('/dashboard/projects')
  }

  const handleRestore = async () => {
    const ok = await updateProject(id, { status: 'active' })
    if (ok) {
      setProject(prev => prev ? { ...prev, status: 'active' } : prev)
      setShowArchiveConfirm(false)
    }
  }

  const handleDelete = async () => {
    const ok = await deleteProject(id)
    if (ok) router.push('/dashboard/projects')
  }

  if (loading || !project) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const ss        = STATUS_STYLES[project.status]
  const typeColor = TYPE_COLORS[project.type]
  const completedCount = tasks.filter(t => t.completed).length

  return (
    <div style={{ padding: '56px 16px 40px' }}>

      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/projects')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: 0, color: '#3B7DFF', fontFamily: 'inherit', fontSize: 14 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        Projects
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: ss.color, background: ss.bg, padding: '3px 8px', borderRadius: 20 }}>{ss.label}</span>
        {project.timeline && <span style={{ fontSize: 12, color: '#8E8E93' }}>{project.timeline}</span>}
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: '0 0 20px', lineHeight: 1.25 }}>{project.title}</h1>

      {/* Progress */}
      <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>Progress</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: typeColor }}>{project.progress}%</span>
        </div>
        <div style={{ background: '#E5E5EA', borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${project.progress}%`, background: typeColor, borderRadius: 6, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Goals Card */}
      <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>Goals</span>
          {linkedGoal && (
            <span style={{ fontSize: 12, color: '#8E8E93' }}>{linkedGoal.progress >= 100 ? '1/1' : '0/1'} complete</span>
          )}
        </div>
        {!linkedGoal ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#8E8E93' }}>
            <p style={{ fontSize: 14, margin: '0 0 4px' }}>No goals linked yet.</p>
            <p style={{ fontSize: 12, margin: 0 }}>Open a goal and set its Project in the Details section.</p>
          </div>
        ) : (
          <button
            onClick={() => router.push(`/dashboard/goals/${linkedGoal.id}`)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%', fontFamily: 'inherit' }}
          >
            {(() => {
              const cs = getCatStyle(linkedGoal.category)
              return (
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                      {linkedGoal.text}
                    </p>
                    <span style={{ fontSize: 12, fontWeight: 600, color: cs.color, flexShrink: 0 }}>{linkedGoal.progress}%</span>
                  </div>
                  <div style={{ background: '#F2F2F7', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 5 }}>
                    <div style={{ height: '100%', width: `${linkedGoal.progress}%`, background: cs.color, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, color: cs.color, background: cs.bg, padding: '2px 7px', borderRadius: 20 }}>{linkedGoal.category}</span>
                </div>
              )
            })()}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D1D6" strokeWidth="2.5" strokeLinecap="round" style={{ marginTop: 2, flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
      </div>

      {/* Tasks */}
      <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>Tasks</span>
          <button
            onClick={() => setShowAddTask(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add
          </button>
        </div>
        {tasks.length === 0 ? (
          <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>No tasks yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {tasks.map((task, i) => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  paddingTop: i > 0 ? 12 : 0,
                  paddingBottom: i < tasks.length - 1 ? 12 : 0,
                  borderBottom: i < tasks.length - 1 ? '0.5px solid #F2F2F7' : 'none',
                }}
              >
                {task.completed ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" fill="#F0FFF4" stroke="#34C759" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                ) : (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #D1D1D6', flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 14, color: task.completed ? '#8E8E93' : '#1C1C1E', textDecoration: task.completed ? 'line-through' : 'none' }}>
                  {task.text}
                </span>
              </div>
            ))}
          </div>
        )}
        {tasks.length > 0 && (
          <p style={{ fontSize: 12, color: '#8E8E93', margin: '12px 0 0' }}>{completedCount}/{tasks.length} completed</p>
        )}
      </div>

      {/* AI Suggestions */}
      <div style={{ background: '#EEF2FF', borderRadius: 16, padding: '16px 18px', border: '0.5px solid #C7D2FE', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#4338CA' }}>AI Suggestions</span>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {AI_SUGGESTIONS.map((s, i) => (
            <li key={i} style={{ fontSize: 13, color: '#3730A3', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#6366F1', marginTop: 1 }}>•</span> {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Edit Project / Archive */}
      {project.status !== 'archived' ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            onClick={openEdit}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              border: '1.5px solid #1C1C1E', background: 'white',
              fontSize: 14, fontWeight: 600, color: '#1C1C1E',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Edit Project
          </button>
          <button
            onClick={() => setShowArchiveConfirm(true)}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              border: '1.5px solid #E5E5EA', background: 'white',
              fontSize: 14, fontWeight: 600, color: '#8E8E93',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
            Archive
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            onClick={handleRestore}
            style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: '#34C759', fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Restore to Active
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid #FECACA', background: 'white', fontSize: 14, fontWeight: 600, color: '#DC2626', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Delete Project
          </button>
        </div>
      )}

      {/* ─── Add Task Modal ─── */}
      {showAddTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowAddTask(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', width: '100%', maxWidth: 480 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D1D6', margin: '0 auto 18px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Add Task</h3>
            <input
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              placeholder="Task description"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddTask() }}
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '12px 14px', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAddTask(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid #E5E5EA', background: 'white', fontSize: 15, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleAddTask} disabled={!newTaskText.trim() || addingTask} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: newTaskText.trim() ? '#3B7DFF' : '#D1D1D6', fontSize: 15, fontWeight: 700, color: 'white', cursor: newTaskText.trim() ? 'pointer' : 'default', fontFamily: 'inherit', opacity: addingTask ? 0.6 : 1 }}>
                {addingTask ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Project Modal ─── */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }} onClick={() => setEditing(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', width: '100%', maxWidth: 480 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D1D6', margin: '0 auto 18px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 18px' }}>Edit Project</h3>

            <label style={{ fontSize: 12, color: '#8E8E93', display: 'block', marginBottom: 4 }}>Title</label>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box' }}
            />

            <label style={{ fontSize: 12, color: '#8E8E93', display: 'block', marginBottom: 4 }}>Type</label>
            <select
              value={editType}
              onChange={e => setEditType(e.target.value as DBProject['type'])}
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', marginBottom: 14, background: 'white', appearance: 'none', boxSizing: 'border-box' }}
            >
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <label style={{ fontSize: 12, color: '#8E8E93', display: 'block', marginBottom: 4 }}>Timeline</label>
            <input
              value={editTimeline}
              onChange={e => setEditTimeline(e.target.value)}
              placeholder="e.g. Mar – Jun 2026"
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box' }}
            />

            <label style={{ fontSize: 12, color: '#8E8E93', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', resize: 'none', marginBottom: 18, boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid #E5E5EA', background: 'white', fontSize: 15, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: '#1C1C1E', fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Archive Confirm ─── */}
      {showArchiveConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '0 24px' }} onClick={() => setShowArchiveConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>Archive this project?</h3>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 20px', lineHeight: 1.5 }}>It will be moved to your archived projects and can be restored at any time.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowArchiveConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #E5E5EA', background: 'white', fontSize: 15, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleArchive} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#8E8E93', fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ─── */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '0 24px' }} onClick={() => setShowDeleteConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#DC2626', margin: '0 0 8px' }}>Delete this project?</h3>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 20px', lineHeight: 1.5 }}>This cannot be undone. Linked goals will not be deleted.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #E5E5EA', background: 'white', fontSize: 15, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#DC2626', fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
