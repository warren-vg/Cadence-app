'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getProjects, saveProject, type Project, type ProjectType, type ProjectStatus } from '@/lib/projectData'

type TabKey = ProjectType | 'archived'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'campaign', label: 'Campaigns' },
  { key: 'study', label: 'Studies' },
  { key: 'creative', label: 'Creative' },
  { key: 'opportunity', label: 'Opps' },
  { key: 'archived', label: 'Archived' },
]

const STATUS_COLORS: Record<ProjectStatus, { bg: string; color: string; label: string }> = {
  active:    { bg: '#DCFCE7', color: '#16A34A', label: 'active' },
  planning:  { bg: '#EFF6FF', color: '#3B7DFF', label: 'planning' },
  paused:    { bg: '#FFF7ED', color: '#EA580C', label: 'paused' },
  completed: { bg: '#F2F2F7', color: '#8E8E93', label: 'done' },
  archived:  { bg: '#F5F5F5', color: '#8E8E93', label: 'archived' },
}

const TYPE_COLORS: Record<ProjectType, string> = {
  campaign: '#3B7DFF', study: '#9B59B6', creative: '#EA580C', opportunity: '#16A34A',
}

const TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: 'campaign', label: 'Campaign' },
  { value: 'study', label: 'Study' },
  { value: 'creative', label: 'Creative' },
  { value: 'opportunity', label: 'Opportunity' },
]

export default function ProjectsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('campaign')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // New project modal
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<ProjectType>('campaign')
  const [newTimeline, setNewTimeline] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setProjects(getProjects())
      setLoading(false)
    }
    load()
  }, [])

  const handleCreateProject = () => {
    if (!newTitle.trim()) return
    setCreating(true)
    const newProject: Project = {
      id: `p${Date.now()}`,
      title: newTitle.trim(),
      type: newType,
      status: 'planning',
      progress: 0,
      timeline: newTimeline.trim() || undefined,
      tasks: [],
      linkedGoalIds: [],
      createdAt: new Date().toISOString().split('T')[0],
    }
    const updated = saveProject(newProject)
    setProjects(updated)
    setShowNew(false)
    setNewTitle('')
    setNewType('campaign')
    setNewTimeline('')
    setCreating(false)
    router.push(`/dashboard/projects/${newProject.id}`)
  }

  if (!mounted || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const filtered = activeTab === 'archived'
    ? projects.filter(p => p.status === 'archived')
    : projects.filter(p => p.type === activeTab && p.status !== 'archived')

  return (
    <div style={{ padding: '56px 16px 96px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Projects</h1>
            <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>Manage campaigns, studies, and creative work</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', overflowX: 'auto', paddingBottom: 4 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 14, fontWeight: 500,
              border: activeTab === tab.key ? '2px solid #1C1C1E' : '1.5px solid #E5E5EA',
              background: activeTab === tab.key ? '#1C1C1E' : 'white',
              color: activeTab === tab.key ? 'white' : '#3C3C43',
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Project Cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', borderRadius: 18, border: '0.5px solid #E5E5EA' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            {activeTab === 'archived'
              ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="2" y="15" width="6" height="6" rx="1"/><rect x="10" y="3" width="12" height="6" rx="1"/><rect x="10" y="15" width="12" height="6" rx="1"/></svg>
            }
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E', margin: '0 0 6px' }}>
            {activeTab === 'archived' ? 'No archived projects'
              : activeTab === 'opportunity' ? 'No opportunities under review'
              : `No ${activeTab} projects yet`}
          </p>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 20px' }}>
            {activeTab === 'archived' ? 'Archived projects will appear here and can be restored.'
              : activeTab === 'opportunity' ? 'Use the filter to evaluate if an opportunity deserves your time.'
              : 'Tap + to add your first project.'}
          </p>
          {activeTab === 'opportunity' && (
            <button
              onClick={() => router.push('/dashboard/opportunity')}
              style={{ padding: '11px 22px', borderRadius: 10, background: '#1C1C1E', border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Evaluate New Opportunity
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(project => {
            const ss = STATUS_COLORS[project.status]
            const typeColor = TYPE_COLORS[project.type] || '#8E8E93'
            const tasks = project.tasks || []
            const completedCount = tasks.filter(t => t.completed).length
            return (
              <button
                key={project.id}
                onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                style={{
                  background: 'white', borderRadius: 18, padding: '18px 20px',
                  border: '0.5px solid #E5E5EA', cursor: 'pointer',
                  textAlign: 'left', width: '100%', fontFamily: 'inherit',
                  display: 'block',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.title}
                    </p>
                    {project.timeline && (
                      <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>{project.timeline}</p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: ss.color, background: ss.bg, padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>
                    {ss.label}
                  </span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#8E8E93' }}>
                      {tasks.length > 0 ? `${completedCount} of ${tasks.length} tasks completed` : 'No tasks yet'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: typeColor }}>{project.progress}%</span>
                  </div>
                  <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${project.progress}%`, background: typeColor, borderRadius: 4 }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* FAB */}
      {activeTab !== 'archived' && (
        <button
          onClick={() => setShowNew(true)}
          style={{
            position: 'fixed', bottom: 80, right: 20, width: 52, height: 52, borderRadius: '50%',
            background: '#3B7DFF', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(59, 125, 255, 0.4)', zIndex: 99,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* New Project Modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowNew(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', width: '100%', maxWidth: 480 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D1D6', margin: '0 auto 18px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 18px' }}>New Project</h3>

            <label style={{ fontSize: 12, color: '#8E8E93', display: 'block', marginBottom: 4 }}>Title</label>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Project name"
              autoFocus
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box' }}
            />

            <label style={{ fontSize: 12, color: '#8E8E93', display: 'block', marginBottom: 4 }}>Type</label>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as ProjectType)}
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', marginBottom: 14, background: 'white', appearance: 'none', boxSizing: 'border-box' }}
            >
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <label style={{ fontSize: 12, color: '#8E8E93', display: 'block', marginBottom: 4 }}>Timeline (optional)</label>
            <input
              value={newTimeline}
              onChange={e => setNewTimeline(e.target.value)}
              placeholder="e.g. Mar – Jun 2026"
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', marginBottom: 18, boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid #E5E5EA', background: 'white', fontSize: 15, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleCreateProject} disabled={!newTitle.trim() || creating} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: !newTitle.trim() ? '#E5E5EA' : '#3B7DFF', fontSize: 15, fontWeight: 700, color: 'white', cursor: !newTitle.trim() ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
