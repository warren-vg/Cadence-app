'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  toDateStr, getCatStyle, formatTime,
} from '@/lib/planData'
import {
  getTasksForDate, toggleTask, createTask, createRecurringTask,
  stopRecurrence, recalcGoalProgressFromTasks, deleteTask,
  type DBTask, type RecurrenceRule,
} from '@/lib/db'
import EmptyState from '@/app/dashboard/components/EmptyState'
import { evaluateRewards } from '@/lib/rewards'
import { useRewards } from '@/app/dashboard/components/RewardContext'

const PRIORITY_DOT: Record<string, string> = {
  high:   '#FF3B30',
  medium: '#FF9500',
  low:    '#34C759',
}

const CATEGORIES = ['Career', 'Finance', 'Health', 'Relationships', 'Business', 'Community', 'Education', 'Creative', 'Recovery']

function DailyPlanContent() {
  const router   = useRouter()
  const params   = useSearchParams()
  const { queueRewards } = useRewards()
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
  const [newEndTime, setNewEndTime]       = useState('10:00')
  const [newDate, setNewDate]             = useState('')
  const [newPriority, setNewPriority]     = useState<'high'|'medium'|'low'>('medium')
  const [newGoalId, setNewGoalId]         = useState<string | null>(null)
  const [addingTask, setAddingTask]       = useState(false)
  const [goals, setGoals]                 = useState<{id: string; text: string}[]>([])
  const [goalNames, setGoalNames]         = useState<Record<string, string>>({})
  const [editingTask, setEditingTask]     = useState<DBTask | null>(null)

  // Day capacity (from profiles.capacity_schedule)
  const [dayCapacity, setDayCapacity]     = useState(0)
  const [dayTimeOfDay, setDayTimeOfDay]   = useState('')

  // Toast / deferred
  const [showDeferred, setShowDeferred] = useState(false)
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false })

  // Recurrence accordion (Add Task modal)
  const [recurEnabled, setRecurEnabled] = useState(false)
  const [recurFreq, setRecurFreq]       = useState<'daily' | 'weekly'>('weekly')
  const [recurDays, setRecurDays]       = useState<number[]>([])
  const [recurEndsOn, setRecurEndsOn]   = useState('')

  // Recurring task management modal
  const [recurModalTask, setRecurModalTask] = useState<DBTask | null>(null)
  const [stoppingRecur, setStoppingRecur]   = useState(false)

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
      const [tasksData, { data: goalsData }, { data: profileData }] = await Promise.all([
        getTasksForDate(user.id, date),
        supabase.from('goals').select('id, text').eq('user_id', user.id).eq('status', 'active'),
        supabase.from('profiles').select('daily_notes, low_energy_dates, capacity_schedule').eq('id', user.id).single(),
      ])
      const goalsArr = (goalsData || []) as {id: string; text: string}[]
      setGoals(goalsArr)
      const nameMap: Record<string, string> = {}
      goalsArr.forEach(g => { nameMap[g.id] = g.text })
      setGoalNames(nameMap)
      setTasks(tasksData)
      const dailyNotes = (profileData?.daily_notes as Record<string, string> | null) || {}
      setNotes(dailyNotes[date] || '')
      const lowEnergyDates = (profileData?.low_energy_dates as string[] | null) || []
      setLowEnergy(lowEnergyDates.includes(date))
      if (profileData?.capacity_schedule) {
        const DOW_KEY = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
        const cs = profileData.capacity_schedule as Record<string, { hours: number; time_of_day: string }>
        const dayData = cs[DOW_KEY[new Date(date + 'T12:00:00').getDay()]]
        if (dayData) {
          setDayCapacity(dayData.hours)
          setDayTimeOfDay(dayData.time_of_day)
        }
      }
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

    let goalProgress: number | null = null
    if (task.goal_id && userId) {
      const newProgress = await recalcGoalProgressFromTasks(task.goal_id, userId)
      goalProgress = newProgress
      if (newProgress !== null && !task.completed) {
        const goalName = task.text.length > 30 ? task.text.slice(0, 30) + '…' : task.text
        if (newProgress === 100) {
          showToast(`Goal complete: ${goalName}!`)
        } else {
          showToast(`${goalName} is now ${newProgress}% complete`)
        }
      }
    } else if (task.project_id && userId) {
      const { data: linkedGoals } = await supabase
        .from('goals')
        .select('id')
        .eq('project_id', task.project_id)
      if (linkedGoals) {
        await Promise.all(linkedGoals.map((g: { id: string }) => recalcGoalProgressFromTasks(g.id, userId)))
      }
    }

    // Reward evaluation — non-blocking, fires only on completion (not un-completion)
    if (!task.completed && userId) {
      const goalTitle = task.goal_id ? (goalNames[task.goal_id] ?? null) : null
      evaluateRewards(userId, {
        trigger: 'task_completed',
        ctx: {
          taskId:        task.id,
          taskDate:      task.date,
          taskCreatedAt: task.created_at ?? new Date().toISOString(),
          taskCategory:  task.category,
          goalId:        task.goal_id ?? null,
          goalTitle,
          goalProgress,
        },
      }).then(earned => { if (earned.length > 0) queueRewards(earned) })
    }
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setEditingTask(null)
    setNewTitle(''); setNewCategory('Career'); setNewTime('09:00')
    setNewEndTime('10:00'); setNewDate(''); setNewGoalId(null); setNewPriority('medium')
    setRecurEnabled(false); setRecurFreq('weekly'); setRecurDays([]); setRecurEndsOn('')
  }

  const handleAddTask = async () => {
    if (!newTitle.trim() || !userId) return
    setAddingTask(true)
    const taskDate = newDate || date
    const [sh, sm] = newTime.split(':').map(Number)
    const [eh, em] = newEndTime.split(':').map(Number)
    const diffMins = (eh * 60 + em) - (sh * 60 + sm)
    const duration = diffMins > 0 ? Math.round((diffMins / 60) * 4) / 4 : 1

    if (editingTask) {
      const { error } = await supabase.from('tasks').update({
        text:           newTitle.trim(),
        scheduled_time: newTime,
        duration,
        category:       newCategory,
        priority:       newPriority,
        goal_id:        newGoalId,
        date:           taskDate,
      }).eq('id', editingTask.id)
      if (!error) {
        const updated = await getTasksForDate(userId, date)
        setTasks(updated)
        showToast('Task updated')
        if (newGoalId !== editingTask.goal_id) {
          if (editingTask.goal_id) await recalcGoalProgressFromTasks(editingTask.goal_id, userId)
          if (newGoalId) await recalcGoalProgressFromTasks(newGoalId, userId)
        }
      } else {
        showToast('Failed to update task')
      }
      closeAddModal()
      setAddingTask(false)
      return
    }

    const baseTask = {
      text:           newTitle.trim(),
      scheduled_time: newTime,
      duration,
      category:       newCategory,
      priority:       newPriority,
      completed:      false,
      goal_id:        newGoalId,
      project_id:     null as null,
      source:         'manual' as const,
    }

    if (recurEnabled) {
      const rule: RecurrenceRule = {
        frequency:    recurFreq,
        days_of_week: recurFreq === 'weekly' ? recurDays : undefined,
        ends_on:      recurEndsOn || null,
      }
      const created = await createRecurringTask(userId, baseTask, rule)
      if (created) {
        const updated = await getTasksForDate(userId, date)
        setTasks(updated)
        showToast(`"${newTitle.trim()}" set to repeat`)
      }
    } else {
      const created = await createTask(userId, { ...baseTask, date: taskDate })
      if (created) {
        if (taskDate === date) {
          const updated = await getTasksForDate(userId, date)
          setTasks(updated)
          const newTotal = parseFloat(updated.reduce((s, t) => s + t.duration, 0).toFixed(1))
          if (dayCapacity > 0 && newTotal > dayCapacity) {
            showToast(`Added · over today's ${dayCapacity}h capacity`)
          } else {
            showToast(`"${newTitle.trim()}" added to your schedule`)
          }
        } else {
          showToast(`"${newTitle.trim()}" added to your schedule`)
        }
      }
    }

    closeAddModal()
    setAddingTask(false)
  }

  const addMinutesToTime = (time: string, minutes: number): string => {
    const [h, m] = (time || '09:00').split(':').map(Number)
    const total = Math.min(h * 60 + m + minutes, 23 * 60)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const handleEditTask = (task: DBTask) => {
    setNewTitle(task.text)
    setNewCategory(task.category || 'Career')
    setNewTime(task.scheduled_time || '09:00')
    setNewEndTime(addMinutesToTime(task.scheduled_time || '09:00', Math.round(task.duration * 60)))
    setNewDate(task.date || date)
    setNewPriority((task.priority as 'high' | 'medium' | 'low') || 'medium')
    setNewGoalId(task.goal_id ?? null)
    setRecurEnabled(false)
    setEditingTask(task)
    setShowAddModal(true)
  }

  const handleRemoveTask = async (task: DBTask) => {
    setTasks(prev => prev.filter(t => t.id !== task.id))
    const ok = await deleteTask(task.id)
    if (!ok) {
      setTasks(prev => [...prev, task].sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || '')))
      showToast('Failed to remove task')
    } else {
      showToast(`"${task.text.length > 30 ? task.text.slice(0, 30) + '…' : task.text}" removed`)
      if (task.goal_id && userId) {
        await recalcGoalProgressFromTasks(task.goal_id, userId)
      }
    }
  }

  const handleSnooze = async (task: DBTask) => {
    const newSnoozeTime = addMinutesToTime(task.scheduled_time || '09:00', 15)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, scheduled_time: newSnoozeTime } : t))
    const { error } = await supabase.from('tasks').update({ scheduled_time: newSnoozeTime }).eq('id', task.id)
    if (error) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, scheduled_time: task.scheduled_time } : t))
      showToast('Failed to snooze task')
    } else {
      showToast(`Snoozed to ${formatTime(newSnoozeTime)}`)
    }
  }

  const handleNotesBlur = async () => {
    if (!userId) return
    try {
      const { data: current } = await supabase.from('profiles').select('daily_notes').eq('id', userId).single()
      const existing = (current?.daily_notes as Record<string, string> | null) || {}
      await supabase.from('profiles').update({ daily_notes: { ...existing, [date]: notes } }).eq('id', userId)
    } catch (err) {
      console.warn('Could not save daily notes — ensure daily_notes jsonb column exists in profiles', err)
    }
  }

  const handleLowEnergyToggle = async () => {
    const next = !lowEnergy
    setLowEnergy(next)
    if (!userId) return
    try {
      const { data: current } = await supabase.from('profiles').select('low_energy_dates').eq('id', userId).single()
      const existing: string[] = (current?.low_energy_dates as string[] | null) || []
      const updated = next
        ? [...new Set([...existing, date])]
        : existing.filter(d => d !== date)
      await supabase.from('profiles').update({ low_energy_dates: updated }).eq('id', userId)
    } catch (err) {
      console.warn('Could not save low energy dates — ensure low_energy_dates text[] column exists in profiles', err)
    }
  }

  if (!mounted || loading) return null

  const sorted         = [...tasks].sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
  const completed      = tasks.filter(t => t.completed).length
  const total          = tasks.length
  const dailyMinimum   = tasks.find(t => t.priority === 'high') || tasks[0]
  const scheduledHours = parseFloat(tasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
  const overCapacity   = dayCapacity > 0 && scheduledHours > dayCapacity
  const capacityPct    = dayCapacity > 0 ? Math.min(100, Math.round((scheduledHours / dayCapacity) * 100)) : 0

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
            onClick={handleLowEnergyToggle}
            style={{ width: 50, height: 30, borderRadius: 15, background: lowEnergy ? '#34C759' : '#E5E5EA', border: 'none', cursor: 'pointer', position: 'relative', padding: 0 }}
          >
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: lowEnergy ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {/* Day Capacity Indicator */}
        {dayCapacity > 0 && (
          <div style={{
            background: overCapacity ? '#FFF7ED' : '#F0FFF4',
            borderRadius: 14,
            padding: '14px 18px',
            border: `1px solid ${overCapacity ? '#FED7AA' : '#BBF7D0'}`,
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>Today&apos;s Capacity</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: overCapacity ? '#EA580C' : '#16A34A', margin: 0 }}>
                {scheduledHours}h / {dayCapacity}h
              </p>
            </div>
            <div style={{ background: overCapacity ? '#FED7AA' : '#BBF7D0', borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${capacityPct}%`,
                background: overCapacity ? '#EA580C' : '#16A34A',
                borderRadius: 6, transition: 'width 0.4s ease',
              }} />
            </div>
            {dayTimeOfDay && (
              <p style={{ fontSize: 12, color: '#8E8E93', margin: '6px 0 0' }}>
                Preferred: {dayTimeOfDay.charAt(0).toUpperCase() + dayTimeOfDay.slice(1)}
              </p>
            )}
          </div>
        )}

        {/* Priority Legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          {[['high', 'High'], ['medium', 'Medium'], ['low', 'Low']].map(([p, label]) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[p] }} />
              <span style={{ fontSize: 12, color: '#3C3C43' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Task List */}
        {(() => {
          // TODO(Phase 3): morning touchpoint should detect tasks deferred yesterday via Low Energy
          // and prompt the user to roll them forward. Low Energy mode is view-only — no data mutation.
          const activeTasks   = lowEnergy ? sorted.filter(t => t.priority === 'high') : sorted
          const deferredTasks = lowEnergy ? sorted.filter(t => t.priority !== 'high') : []

          const renderTaskRow = (task: DBTask, index: number, listLength: number) => (
            <div key={task.id} style={{
              background: 'white',
              borderRadius: index === 0 ? '16px 16px 0 0' : index === listLength - 1 ? '0 0 16px 16px' : '0',
              padding: '16px 18px', border: '0.5px solid #E5E5EA',
              borderBottom: index < listLength - 1 ? 'none' : '0.5px solid #E5E5EA',
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
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT[task.priority] ?? '#C7C7CC', flexShrink: 0 }} />
                  {task.recurrence_template_id && (
                    <button
                      onClick={e => { e.stopPropagation(); setRecurModalTask(task) }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', lineHeight: 1 }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 15, fontWeight: 500, color: task.completed ? '#8E8E93' : '#1C1C1E', textDecoration: task.completed ? 'line-through' : 'none', margin: '0 0 3px' }}>
                  {task.text}
                </p>
                {task.goal_id && goalNames[task.goal_id] && (
                  <p style={{ fontSize: 12, color: '#3B7DFF', margin: '1px 0 3px' }}>
                    From: {goalNames[task.goal_id]}
                  </p>
                )}
                <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>
                  {task.duration} {task.duration === 1 ? 'hour' : 'hours'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <button onClick={() => handleEditTask(task)} style={actionBtnStyle}>Edit</button>
                <button onClick={() => handleSnooze(task)} style={actionBtnStyle}>Snooze</button>
                <button onClick={() => handleRemoveTask(task)} style={{ ...actionBtnStyle, color: '#FF3B30' }}>Remove</button>
              </div>
            </div>
          )

          if (tasks.length === 0) return (
            <div data-tour="daily-plan-list">
              <EmptyState
                icon="📋"
                iconBg="#EFF6FF"
                title="No tasks for this day"
                body="Tap &quot;+ Add Task Block&quot; below to schedule something."
                ctaLabel="+ Add Task Block"
                onCta={() => setShowAddModal(true)}
              />
            </div>
          )

          return (
            <div data-tour="daily-plan-list" style={{ marginBottom: 14 }}>
              {activeTasks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activeTasks.map((task, i) => renderTaskRow(task, i, activeTasks.length))}
                </div>
              )}
              {activeTasks.length === 0 && lowEnergy && (
                <div style={{ background: 'white', borderRadius: 16, padding: '24px 20px', textAlign: 'center', border: '0.5px solid #E5E5EA', color: '#8E8E93' }}>
                  <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px', color: '#3C3C43' }}>No high-priority tasks today</p>
                  <p style={{ fontSize: 13, margin: 0 }}>Rest up — toggle off Low Energy Mode to see all tasks.</p>
                </div>
              )}
              {deferredTasks.length > 0 && (
                <div style={{ marginTop: activeTasks.length > 0 ? 10 : 0 }}>
                  <button
                    onClick={() => setShowDeferred(s => !s)}
                    style={{
                      width: '100%', background: 'white', border: '0.5px solid #E5E5EA',
                      borderRadius: showDeferred ? '16px 16px 0 0' : 16,
                      padding: '14px 18px', cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#3C3C43' }}>
                      {deferredTasks.length} deferred today
                    </span>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"
                      style={{ transform: showDeferred ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {showDeferred && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {deferredTasks.map((task, i) => renderTaskRow(task, i, deferredTasks.length))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

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
            onBlur={handleNotesBlur}
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
            onClick={() => { setShowAddModal(true); setNewDate(date) }}
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
          onClick={closeAddModal}
        >
          <div
            style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', padding: '24px 20px 40px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>{editingTask ? 'Edit Block' : 'New Block'}</h2>
                <p style={{ fontSize: 12, color: '#8E8E93', margin: '3px 0 0' }}>{editingTask ? 'Update this task block' : 'Add a new task block to your schedule'}</p>
              </div>
              <button
                onClick={closeAddModal}
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
              <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Date</p>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
              <div>
                <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Start Time</p>
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
                />
              </div>
              <div>
                <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>End Time</p>
                <input
                  type="time"
                  value={newEndTime}
                  onChange={e => setNewEndTime(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
                />
              </div>
            </div>
            {(() => {
              const [sh, sm] = newTime.split(':').map(Number)
              const [eh, em] = newEndTime.split(':').map(Number)
              const mins = (eh * 60 + em) - (sh * 60 + sm)
              if (mins > 0) {
                const h = Math.floor(mins / 60)
                const m = mins % 60
                return <p style={{ fontSize: 12, color: '#8E8E93', margin: '4px 0 12px' }}>Duration: {h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`}</p>
              }
              return <div style={{ marginBottom: 16 }} />
            })()}

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Goal <span style={{ fontWeight: 400, color: '#FF3B30' }}>*</span></p>
              <select
                value={newGoalId || ''}
                onChange={e => setNewGoalId(e.target.value || null)}
                style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC', appearance: 'none' }}
              >
                <option value="" disabled>Select a goal</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.text.length > 45 ? g.text.slice(0, 45) + '…' : g.text}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
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

            {/* Recurrence accordion — hidden when editing an existing task */}
            {!editingTask && <div style={{ marginBottom: 24 }}>
              <button
                onClick={() => setRecurEnabled(v => !v)}
                style={{
                  width: '100%', background: 'white', border: '0.5px solid #E5E5EA',
                  borderRadius: recurEnabled ? '12px 12px 0 0' : 12,
                  padding: '13px 16px', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={recurEnabled ? '#3B7DFF' : '#8E8E93'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                  <span style={{ fontSize: 14, fontWeight: 500, color: recurEnabled ? '#3B7DFF' : '#1C1C1E' }}>Repeat</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: recurEnabled ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {recurEnabled && (
                <div style={{ background: '#F8F8FC', border: '0.5px solid #E5E5EA', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '16px' }}>
                  <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 8 }}>Frequency</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {(['daily', 'weekly'] as const).map(f => (
                      <button key={f} onClick={() => setRecurFreq(f)} style={{
                        flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                        fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                        background: recurFreq === f ? '#3B7DFF' : '#F2F2F7',
                        color:      recurFreq === f ? 'white'   : '#3C3C43',
                      }}>
                        {f === 'daily' ? 'Daily' : 'Weekly'}
                      </button>
                    ))}
                  </div>

                  {recurFreq === 'weekly' && (
                    <>
                      <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 8 }}>Repeat on</p>
                      <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
                        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
                          <button key={i} onClick={() => setRecurDays(prev =>
                            prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                          )} style={{
                            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                            background: recurDays.includes(i) ? '#3B7DFF' : '#F2F2F7',
                            color:      recurDays.includes(i) ? 'white'   : '#3C3C43',
                          }}>{d}</button>
                        ))}
                      </div>
                      {recurDays.length === 0 && (
                        <p style={{ fontSize: 12, color: '#FF9500', margin: '-8px 0 16px' }}>Select at least one day</p>
                      )}
                    </>
                  )}

                  <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>
                    End date <span style={{ fontWeight: 400, color: '#C7C7CC' }}>(optional)</span>
                  </p>
                  <input
                    type="date"
                    value={recurEndsOn}
                    onChange={e => setRecurEndsOn(e.target.value)}
                    style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#F8F8FC' }}
                  />
                </div>
              )}
            </div>}

            {(() => {
              const missingDays = !editingTask && recurEnabled && recurFreq === 'weekly' && recurDays.length === 0
              const canSubmit   = !!(newTitle.trim() && newGoalId && !missingDays)
              return (
                <button
                  onClick={handleAddTask}
                  disabled={!canSubmit || addingTask}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                    background: canSubmit ? '#3B7DFF' : '#D1D1D6',
                    color: 'white', fontSize: 15, fontWeight: 700,
                    cursor: canSubmit ? 'pointer' : 'default',
                    fontFamily: 'inherit', opacity: addingTask ? 0.6 : 1,
                  }}
                >
                  {addingTask ? (editingTask ? 'Saving…' : 'Adding…') : editingTask ? 'Save Changes' : recurEnabled ? 'Add Repeating Block' : 'Add Block'}
                </button>
              )
            })()}
          </div>
        </div>
      )}

      {/* Recurring task management modal */}
      {recurModalTask && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setRecurModalTask(null)}
        >
          <div
            style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 40px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D1D6', margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Recurring Task</h2>
            </div>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 24px', paddingLeft: 22 }}>{recurModalTask.text}</p>

            <button
              onClick={async () => {
                if (!recurModalTask.recurrence_template_id || !userId) return
                setStoppingRecur(true)
                const ok = await stopRecurrence(recurModalTask.recurrence_template_id)
                if (ok) {
                  // Delete all future instances (keep today's so user can complete it)
                  const today = toDateStr(new Date())
                  await supabase.from('tasks')
                    .delete()
                    .eq('recurrence_template_id', recurModalTask.recurrence_template_id)
                    .gt('date', today)
                  showToast('Recurrence stopped')
                  const updated = await getTasksForDate(userId, date)
                  setTasks(updated)
                }
                setRecurModalTask(null)
                setStoppingRecur(false)
              }}
              disabled={stoppingRecur}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: '0.5px solid #FECACA',
                background: '#FFF5F5', color: '#DC2626',
                fontSize: 15, fontWeight: 600, cursor: stoppingRecur ? 'default' : 'pointer',
                fontFamily: 'inherit', marginBottom: 10, opacity: stoppingRecur ? 0.6 : 1,
              }}
            >
              {stoppingRecur ? 'Stopping…' : 'Stop repeating'}
            </button>

            <button
              onClick={() => setRecurModalTask(null)}
              style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
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
