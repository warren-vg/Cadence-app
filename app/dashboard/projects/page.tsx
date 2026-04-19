'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ProjectType = 'campaign' | 'study' | 'creative' | 'opportunity'
type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed'

interface Project {
  id: string
  title: string
  type: ProjectType
  status: ProjectStatus
  progress: number
  timeline?: string | null
  notes?: string | null
  linked_goals?: string[] | null
  tasks_total?: number
  tasks_completed?: number
}

const TABS: { key: ProjectType | 'all'; label: string }[] = [
  { key: 'campaign', label: 'Campaigns' },
  { key: 'study', label: 'Studies' },
  { key: 'creative', label: 'Creative' },
  { key: 'opportunity', label: 'Opps' },
]

const STATUS_COLORS: Record<ProjectStatus, { bg: string; color: string; label: string }> = {
  active:    { bg: '#DCFCE7', color: '#16A34A', label: 'active' },
  planning:  { bg: '#EFF6FF', color: '#3B7DFF', label: 'planning' },
  paused:    { bg: '#FFF7ED', color: '#EA580C', label: 'paused' },
  completed: { bg: '#F2F2F7', color: '#8E8E93', label: 'done' },
}

const TYPE_COLORS: Record<ProjectType, string> = {
  campaign: '#3B7DFF',
  study: '#9B59B6',
  creative: '#EA580C',
  opportunity: '#16A34A',
}

const SEED_PROJECTS: Project[] = [
  { id: 'p1', title: 'Design Portfolio Website', type: 'campaign', status: 'active', progress: 75, timeline: 'Mar – Apr 2026', tasks_total: 4, tasks_completed: 3 },
  { id: 'p2', title: '6-Month Savings Plan', type: 'study', status: 'active', progress: 50, timeline: 'Jan – Jun 2026', tasks_total: 3, tasks_completed: 2 },
  { id: 'p3', title: 'Short Story Collection', type: 'creative', status: 'planning', progress: 20, timeline: 'Q3 2026', tasks_total: 5, tasks_completed: 1 },
]

export default function ProjectsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ProjectType>('campaign')
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = projects.filter(p => p.type === activeTab)
  const statusStyle = (s: ProjectStatus) => STATUS_COLORS[s] || STATUS_COLORS.planning

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

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
            onClick={() => setActiveTab(tab.key as ProjectType)}
            style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 14, fontWeight: 500,
              border: activeTab === tab.key ? '2px solid #1C1C1E' : '1.5px solid #E5E5EA',
              background: activeTab === tab.key ? '#1C1C1E' : 'white',
              color: activeTab === tab.key ? 'white' : '#3C3C43',
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              transition: 'all 0.15s',
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="2" y="15" width="6" height="6" rx="1"/><rect x="10" y="3" width="12" height="6" rx="1"/><rect x="10" y="15" width="12" height="6" rx="1"/></svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E', margin: '0 0 6px' }}>
            {activeTab === 'opportunity' ? 'No opportunities under review' : `No ${activeTab} projects yet`}
          </p>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 20px' }}>
            {activeTab === 'opportunity' ? 'Use the filter to evaluate if an opportunity deserves your time.' : 'Add your first project to track progress.'}
          </p>
          {activeTab === 'opportunity' ? (
            <button
              onClick={() => router.push('/dashboard/opportunity')}
              style={{
                padding: '11px 22px', borderRadius: 10, background: '#1C1C1E',
                border: 'none', color: 'white', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Evaluate New Opportunity
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(project => {
            const ss = statusStyle(project.status)
            const typeColor = TYPE_COLORS[project.type]
            return (
              <div
                key={project.id}
                style={{ background: 'white', borderRadius: 18, padding: '18px 20px', border: '0.5px solid #E5E5EA' }}
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

                {/* Progress Bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#8E8E93' }}>
                      {project.tasks_completed ?? 0} of {project.tasks_total ?? 0} tasks completed
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: typeColor }}>{project.progress}%</span>
                  </div>
                  <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${project.progress}%`, background: typeColor, borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FAB */}
      <button
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
    </div>
  )
}
