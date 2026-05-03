'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createGoal } from '@/lib/db'
import { type Milestone } from './_utils/generate'

type TabType = 'inbox' | 'active' | 'parked' | 'archived'

interface Goal {
  id: string
  text: string
  category: string
  status: string
  priority: number
  progress: number
  quarter?: string | null
  refined_goal?: string | null
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
  Recovery:         { bg: '#F0FDF9', color: '#0D9488' },
}

function getCatStyle(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: '#F2F2F7', color: '#8E8E93' }
}

function mapStatus(status: string): TabType {
  if (status === 'active') return 'active'
  if (status === 'parking' || status === 'parked') return 'parked'
  if (status === 'archived') return 'archived'
  return 'inbox'
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}
function ArchiveIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  )
}
function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}
function RestoreIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  )
}

function ActionBtn({
  icon, label, onClick, wide,
}: {
  icon: 'pause' | 'archive' | 'play' | 'restore'
  label: string
  onClick: () => void
  wide?: boolean
}) {
  const icons = { pause: <PauseIcon />, archive: <ArchiveIcon />, play: <PlayIcon />, restore: <RestoreIcon /> }
  return (
    <button
      onClick={onClick}
      style={{
        flex: wide ? 1 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '9px 12px',
        background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 10,
        fontSize: 13, fontWeight: 500, color: '#3C3C43',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {icons[icon]}
      {label}
    </button>
  )
}

function GoalCard({
  goal, tab, onNavigate, onStatusChange,
}: {
  goal: Goal
  tab: TabType
  onNavigate: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const catStyle = getCatStyle(goal.category)
  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '16px',
      border: '0.5px solid #E5E5EA',
    }}>
      {/* Badges row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{
            fontSize: 12, fontWeight: 500,
            background: catStyle.bg, color: catStyle.color,
            padding: '3px 10px', borderRadius: 20,
          }}>
            {goal.category}
          </span>
          {goal.quarter && (
            <span style={{
              fontSize: 12, color: '#8E8E93',
              background: '#F2F2F7', padding: '3px 8px', borderRadius: 20,
            }}>
              {goal.quarter}
            </span>
          )}
        </div>
        <button
          onClick={onNavigate}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D1D6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Title */}
      <p style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E', margin: '0 0 4px' }}>
        {goal.text}
      </p>

      {/* Subtitle */}
      {goal.refined_goal && (
        <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 10px', lineHeight: 1.4 }}>
          {goal.refined_goal}
        </p>
      )}

      {/* Progress bar for active goals */}
      {tab === 'active' && (
        <div style={{ marginTop: goal.refined_goal ? 0 : 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#8E8E93' }}>{goal.progress || 0}%</span>
          </div>
          <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${goal.progress || 0}%`,
              background: '#3B7DFF', borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {/* Spacer before buttons when no progress bar */}
      {tab !== 'active' && !goal.refined_goal && <div style={{ marginTop: 10 }} />}
      {tab !== 'active' && goal.refined_goal && <div style={{ marginTop: 2 }} />}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {tab === 'active' && (
          <>
            <ActionBtn icon="pause" label="Pause" onClick={() => onStatusChange(goal.id, 'parking')} />
            <ActionBtn icon="archive" label="Archive" onClick={() => onStatusChange(goal.id, 'archived')} />
          </>
        )}
        {tab === 'parked' && (
          <>
            <ActionBtn icon="play" label="Activate" onClick={() => onStatusChange(goal.id, 'active')} />
            <ActionBtn icon="archive" label="Archive" onClick={() => onStatusChange(goal.id, 'archived')} />
          </>
        )}
        {tab === 'archived' && (
          <ActionBtn icon="restore" label="Restore to Active" onClick={() => onStatusChange(goal.id, 'active')} wide />
        )}
        {tab === 'inbox' && (
          <>
            <ActionBtn icon="play" label="Activate" onClick={() => onStatusChange(goal.id, 'active')} />
            <ActionBtn icon="archive" label="Archive" onClick={() => onStatusChange(goal.id, 'archived')} />
          </>
        )}
      </div>
    </div>
  )
}

const GOAL_CATEGORIES = ['Career', 'Finance', 'Health', 'Relationships', 'Business', 'Community', 'Education', 'Creative', 'Recovery']

const PRIORITY_COLORS: Record<string, string> = { high: '#FF3B30', medium: '#FF9500', low: '#34C759' }

export default function GoalsPage() {
  const router = useRouter()
  const [goals, setGoals]       = useState<Goal[]>([])
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [search, setSearch]     = useState('')
  const [userId, setUserId]     = useState<string | null>(null)

  // New Goal modal
  const [showNewGoal, setShowNewGoal]             = useState(false)
  const [newTitle, setNewTitle]                   = useState('')
  const [newCategory, setNewCategory]             = useState('Career')
  const [newPriority, setNewPriority]             = useState<'high'|'medium'|'low'>('medium')
  const [newNotes, setNewNotes]                   = useState('')
  const [newMilestones, setNewMilestones]         = useState<string[]>([''])
  const [newSteps, setNewSteps]                   = useState<string[]>([''])
  const [newLinkedProjectIds, setNewLinkedProjectIds] = useState<string[]>([])
  const [newStartDate, setNewStartDate]           = useState('')
  const [newEndDate, setNewEndDate]               = useState('')
  const [availableProjects, setAvailableProjects] = useState<{id: string; title: string}[]>([])
  const [creatingGoal, setCreatingGoal]           = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const [{ data: goalsData }, { data: projData }] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).order('priority', { ascending: true }),
        supabase.from('projects').select('id, title').eq('user_id', user.id).neq('status', 'archived'),
      ])
      setGoals(goalsData || [])
      setAvailableProjects(projData || [])
      setLoading(false)
    }
    load()
  }, [])

  const updateStatus = async (id: string, newStatus: string) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, status: newStatus } : g))
    await supabase.from('goals').update({ status: newStatus }).eq('id', id)
  }

  const handleCreateGoal = async () => {
    if (!newTitle.trim() || !userId) return
    setCreatingGoal(true)
    const priorityNum = newPriority === 'high' ? 1 : newPriority === 'medium' ? 5 : 10
    const milestones: Milestone[] = newMilestones
      .filter(m => m.trim())
      .map(m => ({ id: crypto.randomUUID(), text: m.trim(), completed: false }))
    const steps = newSteps.filter(s => s.trim()).map(s => s.trim())
    let quarter: string | null = null
    if (newStartDate || newEndDate) {
      const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      quarter = newStartDate && newEndDate
        ? `${fmt(newStartDate)} – ${fmt(newEndDate)}`
        : newStartDate ? `From ${fmt(newStartDate)}` : `Until ${fmt(newEndDate)}`
    }
    const created = await createGoal(userId, {
      text:       newTitle.trim(),
      category:   newCategory,
      status:     'active',
      priority:   priorityNum,
      progress:   0,
      notes:      newNotes.trim() || null,
      milestones: milestones.length > 0 ? milestones : null,
      steps:      steps.length > 0 ? steps : null,
      quarter,
    })
    if (created) {
      if (newLinkedProjectIds.length > 0) {
        await Promise.all(
          newLinkedProjectIds.map(pid =>
            supabase.from('projects').update({ linked_goal_id: created.id }).eq('id', pid)
          )
        )
      }
      setGoals(prev => [...prev, created as Goal])
      setActiveTab('active')
    }
    setShowNewGoal(false)
    setNewTitle(''); setNewCategory('Career'); setNewPriority('medium'); setNewNotes('')
    setNewMilestones(['']); setNewSteps(['']); setNewLinkedProjectIds([])
    setNewStartDate(''); setNewEndDate('')
    setCreatingGoal(false)
  }

  const openNewGoal = () => {
    setNewTitle(''); setNewCategory('Career'); setNewPriority('medium'); setNewNotes('')
    setNewMilestones(['']); setNewSteps(['']); setNewLinkedProjectIds([])
    setNewStartDate(''); setNewEndDate('')
    setShowNewGoal(true)
  }

  const filteredGoals = goals.filter(g => {
    if (mapStatus(g.status) !== activeTab) return false
    if (search && !g.text.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const tabs: TabType[] = ['inbox', 'active', 'parked', 'archived']

  return (
    <div style={{ padding: '56px 16px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Goals</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', marginTop: 3, marginBottom: 0 }}>
          Track and refine your priorities
        </p>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'white', borderRadius: 12, border: '0.5px solid #E5E5EA',
          padding: '10px 14px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search goals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, color: '#1C1C1E', background: 'transparent',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <button
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'white', border: '0.5px solid #E5E5EA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
        </button>
      </div>

      {/* Evaluate Banner */}
      <button
        onClick={() => router.push('/dashboard/goals/evaluate')}
        style={{
          width: '100%', background: 'linear-gradient(135deg, #3B52FF 0%, #8B5CF6 100%)',
          borderRadius: 16, padding: '18px 20px', marginBottom: 16,
          border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: 'inherit', textAlign: 'left', boxSizing: 'border-box',
        }}
      >
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>
            Evaluate a New Goal
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>
            Get AI-powered SMART analysis before committing
          </p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Tabs */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        background: 'white', borderRadius: 12, padding: '4px',
        border: '0.5px solid #E5E5EA', marginBottom: 16,
      }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '7px 4px', borderRadius: 8,
              border: activeTab === tab ? '1.5px solid #1C1C1E' : '1.5px solid transparent',
              background: 'transparent',
              fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#1C1C1E' : '#8E8E93',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Goals list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredGoals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#8E8E93' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D1D1D6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="#D1D1D6" />
            </svg>
            <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 6px', color: '#3C3C43' }}>
              No {activeTab} goals
            </p>
            {activeTab === 'active' && (
              <p style={{ fontSize: 13, margin: 0 }}>
                Tap + or use the evaluator to add a goal.
              </p>
            )}
            {activeTab === 'inbox' && (
              <p style={{ fontSize: 13, margin: 0 }}>
                Goals evaluated and added will appear here.
              </p>
            )}
          </div>
        ) : (
          filteredGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              tab={activeTab}
              onNavigate={() => router.push(`/dashboard/goals/${goal.id}`)}
              onStatusChange={updateStatus}
            />
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={openNewGoal}
        style={{
          position: 'fixed', bottom: 80, right: 20,
          width: 52, height: 52, borderRadius: '50%',
          background: '#3B7DFF', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(59, 125, 255, 0.4)', zIndex: 99,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* New Goal Modal */}
      {showNewGoal && (
        <div
          onClick={() => setShowNewGoal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'white', borderRadius: '20px 20px 0 0', maxHeight: '92vh', overflowY: 'auto', paddingBottom: 40 }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5EA' }} />
            </div>

            {/* Header */}
            <div style={{ position: 'relative', textAlign: 'center', padding: '12px 20px 4px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>New Goal</h2>
              <p style={{ fontSize: 13, color: '#8E8E93', margin: '4px 0 0' }}>Create a new goal to track your progress</p>
              <button
                onClick={() => setShowNewGoal(false)}
                style={{ position: 'absolute', top: 12, right: 20, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Goal Title */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 8 }}>Goal Title</label>
                <input
                  autoFocus
                  placeholder="e.g. Launch a new podcast in 6 months with 10 episodes"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: '1px solid #E5E5EA', fontSize: 15, color: '#1C1C1E',
                    fontFamily: 'inherit', outline: 'none', background: '#F9F9F9', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Category - 3×3 grid */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 8 }}>Category</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {GOAL_CATEGORIES.map(cat => {
                    const cs = getCatStyle(cat)
                    const selected = newCategory === cat
                    return (
                      <button
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        style={{
                          padding: '10px 8px', borderRadius: 12, border: 'none',
                          background: selected ? cs.color : '#F2F2F7',
                          cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: selected ? 'rgba(255,255,255,0.7)' : cs.color }} />
                        <span style={{ fontSize: 12, fontWeight: selected ? 600 : 400, color: selected ? 'white' : '#3C3C43', whiteSpace: 'nowrap' }}>{cat}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Milestones */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 8 }}>
                  Milestones <span style={{ fontWeight: 400, color: '#8E8E93' }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newMilestones.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        placeholder={`Milestone ${i + 1}`}
                        value={m}
                        onChange={e => { const next = [...newMilestones]; next[i] = e.target.value; setNewMilestones(next) }}
                        style={{
                          flex: 1, padding: '10px 12px', borderRadius: 10,
                          border: '1px solid #E5E5EA', fontSize: 14, color: '#1C1C1E',
                          fontFamily: 'inherit', outline: 'none', background: '#F9F9F9',
                        }}
                      />
                      {newMilestones.length > 1 && (
                        <button
                          onClick={() => setNewMilestones(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#8E8E93', flexShrink: 0 }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {newMilestones.length < 5 && (
                    <button
                      onClick={() => setNewMilestones(prev => [...prev, ''])}
                      style={{ padding: '10px', borderRadius: 10, border: '1.5px dashed #D1D1D6', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#8E8E93' }}
                    >
                      + Add Milestone ({newMilestones.length}/5)
                    </button>
                  )}
                </div>
              </div>

              {/* Action Steps */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 8 }}>
                  Action Steps <span style={{ fontWeight: 400, color: '#8E8E93' }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newSteps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        placeholder={`Step ${i + 1}`}
                        value={s}
                        onChange={e => { const next = [...newSteps]; next[i] = e.target.value; setNewSteps(next) }}
                        style={{
                          flex: 1, padding: '10px 12px', borderRadius: 10,
                          border: '1px solid #E5E5EA', fontSize: 14, color: '#1C1C1E',
                          fontFamily: 'inherit', outline: 'none', background: '#F9F9F9',
                        }}
                      />
                      {newSteps.length > 1 && (
                        <button
                          onClick={() => setNewSteps(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#8E8E93', flexShrink: 0 }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {newSteps.length < 15 && (
                    <button
                      onClick={() => setNewSteps(prev => [...prev, ''])}
                      style={{ padding: '10px', borderRadius: 10, border: '1.5px dashed #D1D1D6', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#8E8E93' }}
                    >
                      + Add Action Step ({newSteps.length}/15)
                    </button>
                  )}
                </div>
              </div>

              {/* Linked Projects */}
              {availableProjects.length > 0 && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 8 }}>
                    Linked Projects <span style={{ fontWeight: 400, color: '#8E8E93' }}>(optional)</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {availableProjects.map(proj => {
                      const linked = newLinkedProjectIds.includes(proj.id)
                      return (
                        <button
                          key={proj.id}
                          onClick={() => setNewLinkedProjectIds(prev =>
                            linked ? prev.filter(id => id !== proj.id) : [...prev, proj.id]
                          )}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 14px', borderRadius: 12,
                            border: linked ? '1.5px solid #3B7DFF' : '1px solid #E5E5EA',
                            background: linked ? '#EFF6FF' : 'white',
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: 14, color: linked ? '#3B7DFF' : '#1C1C1E', fontWeight: linked ? 500 : 400 }}>{proj.title}</span>
                          {linked && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {newLinkedProjectIds.length > 0 && (
                    <p style={{ fontSize: 12, color: '#3B7DFF', margin: '8px 0 0' }}>
                      {newLinkedProjectIds.length} project{newLinkedProjectIds.length > 1 ? 's' : ''} will be linked to this goal
                    </p>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 8 }}>
                  Timeline <span style={{ fontWeight: 400, color: '#8E8E93' }}>(optional)</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 5px' }}>Start</p>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={e => setNewStartDate(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 10,
                        border: '1px solid #E5E5EA', fontSize: 14, color: newStartDate ? '#1C1C1E' : '#8E8E93',
                        fontFamily: 'inherit', outline: 'none', background: '#F9F9F9', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 5px' }}>End</p>
                    <input
                      type="date"
                      value={newEndDate}
                      onChange={e => setNewEndDate(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 10,
                        border: '1px solid #E5E5EA', fontSize: 14, color: newEndDate ? '#1C1C1E' : '#8E8E93',
                        fontFamily: 'inherit', outline: 'none', background: '#F9F9F9', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 8 }}>Priority</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['high', 'medium', 'low'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setNewPriority(p)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 12,
                        border: newPriority === p ? `1.5px solid ${PRIORITY_COLORS[p]}` : '1.5px solid #E5E5EA',
                        background: newPriority === p ? `${PRIORITY_COLORS[p]}15` : 'white',
                        color: newPriority === p ? PRIORITY_COLORS[p] : '#8E8E93',
                        fontSize: 13, fontWeight: newPriority === p ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43', display: 'block', marginBottom: 8 }}>
                  Notes <span style={{ fontWeight: 400, color: '#8E8E93' }}>(optional)</span>
                </label>
                <textarea
                  placeholder="What's this goal about?"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    border: '1px solid #E5E5EA', fontSize: 15, color: '#1C1C1E',
                    fontFamily: 'inherit', outline: 'none', background: '#F9F9F9',
                    resize: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Create button */}
              <button
                onClick={handleCreateGoal}
                disabled={!newTitle.trim() || creatingGoal}
                style={{
                  width: '100%', padding: '15px 0', borderRadius: 14,
                  background: !newTitle.trim() || creatingGoal ? '#D1D1D6' : '#3B7DFF',
                  border: 'none', color: 'white', fontSize: 16, fontWeight: 600,
                  cursor: !newTitle.trim() || creatingGoal ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {creatingGoal ? 'Creating…' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
