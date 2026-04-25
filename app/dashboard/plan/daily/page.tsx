'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  toDateStr, getCatStyle, formatTime,
} from '@/lib/planData'
import {
  getTasksForDate, toggleTask, createTask, recalcGoalProgressFromTasks,
  type DBTask,
} from '@/lib/db'

const PRIORITY_DOT: Record<string, string> = {
  high:   '#FF3B30',
  medium: '#FF9500',
  low:    '#34C759',
}

const CATEGORIES = ['Career', 'Finance', 'Health', 'Creative', 'Travel', 'Relationships', 'Business', 'Community', 'Education', 'Personal Growth', 'Recovery']

function DailyPlanContent() {
  const router   = useRouter()
  const params   = useSearchParams()
  const [tasks, setTasks]           = useState<DBTask[]>([])
  const [notes, setNotes]           = useState('')
  const [lowEnergy, setLowEnergy]   = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)

  // Add Task Block modal
  const [showAddModal, setShowAddModal]   = useState(false)
  const [newTitle, setNewTitle]           = useState('')
  const [newCategory, setNewCategory]     = useState('Career')
  const [newTime, setNewTime]             = useState('09:00')
  const [newDuration, setNewDuration]     = useState('1')
  const [newPriority, setNewPriority]     = useState<'high'|'medium'|'low'>('medium')
  const [addingTask, setAddingTask]       = useState(false)

  // Toast
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false })

  const dateParam = params.get('date')
  const date      = dateParam || toDateStr(new Date())

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const isToday = date === toDateStr(new Date())

  const showToast = (message: string) => {
    setToast({ message, visible: true })
    setTimeout(() => setToast({ message: '', visible: false }), 3000)
  }

  useEffect(() => {
    setMounted(true)
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const data = await getTasksForDate(user.id, date)
      setTasks(data)
      setLoading(false)
    }
    init()
  }, [date])

  const handleToggle = async (task: DBTask) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))

    const success = await toggleTask(task.id, task.completed)
    if (!success) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t))
      return
    }

    if (task.goal_id && userId) {
      const newProgress = await recalcGoalProgressFromTasks(task.goal_id, userId)
      if (newProgress !== null && !task.completed) {
        const goalName = task.text.length > 30 ? task.text.slice(0, 30) + '…' : task.text
        if (newProgress === 100) {
          showToast(`Goal complete: ${goalName}!`)
        } else {
          showToast(`${goalName} is now ${newProgress}% complete`)
        }
      }
    }
  }

  const handleAddTask = async () => {
    if (!newTitle.trim() || !userId) return
    setAddingTask(true)
    const created = await createTask(userId, {
      text:           newTitle.trim(),
      date,
      scheduled_time: newTime,
      duration:       parseFloat(newDuration) || 1,
      category:       newCategory,
      priority:       newPriority,
      completed:      false,
      goal_id:        null,
      project_id:     null,
    })
    if (created) {
      const updated = await getTasksForDate(userId, date)
      setTasks(updated)
    }
    setShowAddModal(false)
    setNewTitle('')
    setNewCategory('Career')
    setNewTime('09:00')
    setNewDuration('1')
    setNewPriority('medium')
    setAddingTask(false)
  }

  if (!mounted || loading) return null

  const completed    = tasks.filter(t => t.completed).length
  const total        = tasks.length
  const dailyMinimum = tasks.find(t => t.priority === 'high') || tasks[0]

  return (
    <div style={{ padding: '0 0 16px' }}>

      {/* Header */}
      <div style={{ padding: '56px 16px 16px', background: 'white', borderBottom: '0.5px solid #E5E5EA', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Plan
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Today&apos;s Plan</h1>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>{displayDate}</p>
        </div>
        <div style={{ textAlign: 'right', paddingTop: 36 }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>{completed}/{total}</p>
          <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>completed</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Low Energy Mode */}
        <div style={{ background: 'white', borderRadius: 16, padding: '16px 18px', border: '0.5px solid #E5E5EA', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={lowEnergy ? '#FF9500' : '#8E8E93'} stroke="none">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>Low Energy Mode</p>
            <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>{lowEnergy ? 'Light tasks only' : 'Full schedule active'}</p>
          </div>
          <button
            onClick={() => setLowEnergy(v => !v)}
            style={{ width: 50, height: 30, borderRadius: 15, background: lowEnergy ? '#34C759' : '#E5E5EA', border: 'none', cursor: 'pointer', position: 'relative', padding: 0 }}
          >
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: lowEnergy ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {/* Priority Legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          {[['high', 'High Priority'], ['medium', 'Medium Priority']].map(([p, label]) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[p] }} />
              <span style={{ fontSize: 12, color: '#3C3C43' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Task List */}
        {tasks.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 16, padding: '40px 20px', textAlign: 'center', border: '0.5px solid #E5E5EA', marginBottom: 14, color: '#8E8E93' }}>
            <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px', color: '#3C3C43' }}>No tasks for this day</p>
            <p style={{ fontSize: 13, margin: 0 }}>Tap &quot;+ Add Task Block&quot; below to add one.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
            {tasks.map((task, i) => {
              const catStyle = getCatStyle(task.category)
              const show = !lowEnergy || task.priority === 'high' || task.priority === 'medium'
              if (!show) return null
              return (
                <div key={task.id} style={{
                  background: 'white',
                  borderRadius: i === 0 ? '16px 16px 0 0' : i === tasks.length - 1 ? '0 0 16px 16px' : '0',
                  padding: '16px 18px', border: '0.5px solid #E5E5EA',
                  borderBottom: i < tasks.length - 1 ? 'none' : '0.5px solid #E5E5EA',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                }}>
                  <button
                    onClick={() => handleToggle(task)}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: task.completed ? '#3B7DFF' : 'white',
                      border: task.completed ? 'none' : '2px solid #D1D1D6',
                      cursor: 'pointer', padding: 0, marginTop: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {task.completed && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, color: '#8E8E93' }}>{formatTime(task.scheduled_time)}</span>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT[task.priority], flexShrink: 0 }} />
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 500, color: task.completed ? '#8E8E93' : '#1C1C1E', textDecoration: task.completed ? 'line-through' : 'none', margin: '0 0 3px' }}>
                      {task.text}
                    </p>
                    {task.goal_id && (
                      <span style={{ fontSize: 11, color: catStyle.color, background: catStyle.bg, padding: '1px 7px', borderRadius: 8, display: 'inline-block', marginBottom: 3 }}>
                        {task.category}
                      </span>
                    )}
                    <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>
                      {task.duration} {task.duration === 1 ? 'hour' : 'hours'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <button style={actionBtnStyle}>Swap</button>
                    <button style={actionBtnStyle}>Snooze</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Daily Minimum */}
        {dailyMinimum && (
          <div style={{ background: '#EFF6FF', borderRadius: 14, padding: '14px 16px', border: '1px solid #DBEAFE', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style={{ fontSize: 13, color: '#1D4ED8', margin: 0, lineHeight: 1.5 }}>
              Daily Minimum — If you can only do one thing today:{' '}
              <strong style={{ color: '#1D4ED8' }}>{dailyMinimum.text}</strong>
            </p>
          </div>
        )}

        {/* Quick Notes */}
        <div style={{ background: 'white', borderRadius: 16, padding: '16px 18px', border: '0.5px solid #E5E5EA', marginBottom: 14 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: '0 0 10px' }}>Quick Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes about your day..."
            rows={3}
            style={{ width: '100%', border: '0.5px solid #E5E5EA', borderRadius: 10, padding: '12px', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
          />
        </div>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            onClick={() => router.push('/dashboard/plan/schedule')}
            style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Manage Schedule
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'white', border: '0.5px solid #E5E5EA', color: '#3B7DFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + Add Task Block
          </button>
        </div>

        {isToday && (
          <button
            onClick={() => router.push('/dashboard/check-in/weekly')}
            style={{ width: '100%', padding: '15px', borderRadius: 14, background: '#3B7DFF', border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            End Day Review
          </button>
        )}
      </div>

      {/* Add Task Block Modal */}
      {showAddModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', padding: '24px 20px 40px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>New Block</h2>
                <p style={{ fontSize: 12, color: '#8E8E93', margin: '3px 0 0' }}>Add a new task block to your schedule</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: '#F2F2F7', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Title</p>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Deep Work Session"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 8 }}>Category</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {CATEGORIES.slice(0, 9).map(cat => {
                  const s = getCatStyle(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => setNewCategory(cat)}
                      style={{
                        padding: '8px 6px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12, fontWeight: 500,
                        background: newCategory === cat ? s.color : '#F2F2F7',
                        color:      newCategory === cat ? 'white'   : '#3C3C43',
                      }}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Time</p>
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
                />
              </div>
              <div>
                <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Duration (hours)</p>
                <input
                  type="number"
                  min="0.25"
                  max="8"
                  step="0.25"
                  value={newDuration}
                  onChange={e => setNewDuration(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 8 }}>Priority</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['high', 'medium', 'low'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setNewPriority(p)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: 500,
                      background: newPriority === p ? PRIORITY_DOT[p] : '#F2F2F7',
                      color:      newPriority === p ? 'white'          : '#3C3C43',
                    }}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddTask}
              disabled={!newTitle.trim() || addingTask}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: newTitle.trim() ? '#3B7DFF' : '#D1D1D6',
                color: 'white', fontSize: 15, fontWeight: 700, cursor: newTitle.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit', opacity: addingTask ? 0.6 : 1,
              }}
            >
              {addingTask ? 'Adding…' : 'Add Block'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: '#1C1C1E', color: 'white', padding: '12px 20px', borderRadius: 12,
          fontSize: 14, fontWeight: 500, zIndex: 300,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
          maxWidth: 'calc(100vw - 32px)',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default function DailyPlanPage() {
  return (
    <Suspense fallback={<div style={{ padding: '80px 20px', textAlign: 'center', color: '#8E8E93' }}>Loading...</div>}>
      <DailyPlanContent />
    </Suspense>
  )
}

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, color: '#8E8E93', fontFamily: 'inherit', padding: '4px 0',
}
