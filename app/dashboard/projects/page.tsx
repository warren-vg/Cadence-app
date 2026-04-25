'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getProjects, createProject,
  type DBProject,
} from '@/lib/db'

type TabKey = 'campaign' | 'study' | 'creative' | 'opportunity' | 'business' | 'archived'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'campaign',    label: 'Campaigns' },
  { key: 'study',       label: 'Studies'   },
  { key: 'creative',    label: 'Creative'  },
  { key: 'opportunity', label: 'Opps'      },
  { key: 'archived',    label: 'Archived'  },
]

const STATUS_COLORS: Record<DBProject['status'], { bg: string; color: string; label: string }> = {
  active:    { bg: '#DCFCE7', color: '#16A34A', label: 'active'    },
  planning:  { bg: '#EFF6FF', color: '#3B7DFF', label: 'planning'  },
  paused:    { bg: '#FFF7ED', color: '#EA580C', label: 'paused'    },
  completed: { bg: '#F2F2F7', color: '#8E8E93', label: 'done'      },
  archived:  { bg: '#F5F5F5', color: '#8E8E93', label: 'archived'  },
}

const TYPE_OPTIONS: { value: DBProject['type']; label: string }[] = [
  { value: 'campaign',    label: 'Business'    },
  { value: 'study',       label: 'Study'       },
  { value: 'creative',    label: 'Creative'    },
  { value: 'opportunity', label: 'Opportunity' },
]

export default function ProjectsPage() {
  const router   = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('campaign')
  const [projects, setProjects]   = useState<DBProject[]>([])
  const [loading, setLoading]     = useState(true)
  const [userId, setUserId]       = useState<string | null>(null)

  const [showNew, setShowNew]       = useState(false)
  const [newTitle, setNewTitle]     = useState('')
  const [newType, setNewType]       = useState<DBProject['type']>('campaign')
  const [newTimeline, setNewTimeline] = useState('')
  const [creating, setCreating]     = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const data = await getProjects(user.id)
      setProjects(data)
      setLoading(false)
    }
    load()
  }, [])

  const handleCreateProject = async () => {
    if (!newTitle.trim() || !userId) return
    setCreating(true)
    const created = await createProject(userId, {
      title:          newTitle.trim(),
      type:           newType,
      status:         'planning',
      progress:       0,
      timeline:       newTimeline.trim() || null,
      notes:          null,
      linked_goal_id: null,
    })
    if (created) {
      setProjects(prev => [created, ...prev])
      setShowNew(false)
      setNewTitle('')
      setNewType('campaign')
      setNewTimeline('')
      router.push(`/dashboard/projects/${created.id}`)
    }
    setCreating(false)
  }

  if (loading) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Projects</h1>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>Manage campaigns, studies, and creative work</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid #E5E5EA', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #3B7DFF' : '2px solid transparent',
              fontSize: 14, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#3B7DFF' : '#8E8E93',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Project List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#8E8E93' }}>
            <p style={{ fontSize: 15, margin: '0 0 4px', color: '#3C3C43' }}>No projects here yet</p>
            <p style={{ fontSize: 13, margin: 0 }}>
              {activeTab === 'archived' ? 'Archived projects will appear here.' : 'Tap + to create a new project.'}
            </p>
          </div>
        ) : (
          filtered.map(p => {
            const s = STATUS_COLORS[p.status]
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                style={{ background: 'white', borderRadius: 16, padding: '16px 18px', border: '0.5px solid #E5E5EA', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E', margin: 0, flex: 1, marginRight: 10 }}>{p.title}</p>
                  <span style={{ fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>
                    {s.label}
                  </span>
                </div>
                {p.timeline && (
                  <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 10px' }}>{p.timeline}</p>
                )}
                <div style={{ height: 6, borderRadius: 3, background: '#F2F2F7', overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', borderRadius: 3, background: '#3B7DFF', width: `${p.progress}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#8E8E93' }}>
                    {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{p.progress}%</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* FAB */}
      {activeTab !== 'archived' && (
        <button
          onClick={() => setShowNew(true)}
          style={{
            position: 'fixed', right: 20, bottom: 88,
            width: 52, height: 52, borderRadius: '50%',
            background: '#3B7DFF', border: 'none', color: 'white',
            fontSize: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(59,125,255,0.4)',
          }}
        >
          +
        </button>
      )}

      {/* New Project Modal */}
      {showNew && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setShowNew(false)}
        >
          <div
            style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px 40px' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 4px' }}>New Project</h2>
            <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 20px' }}>Create a new project to track your work</p>

            <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Project Title</p>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="e.g. Portfolio Rebrand"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 16, background: '#F8F8FC' }}
            />

            <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 8 }}>Type</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNewType(opt.value)}
                  style={{
                    padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 14, fontWeight: newType === opt.value ? 700 : 400,
                    background: newType === opt.value ? '#1C1C1E' : '#F2F2F7',
                    color:      newType === opt.value ? 'white'   : '#3C3C43',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 6 }}>Timeline (optional)</p>
            <input
              value={newTimeline}
              onChange={e => setNewTimeline(e.target.value)}
              placeholder="e.g. Apr – Jun 2026"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '0.5px solid #D1D1D6', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 24, background: '#F8F8FC' }}
            />

            <button
              onClick={handleCreateProject}
              disabled={!newTitle.trim() || creating}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: newTitle.trim() ? '#3B7DFF' : '#D1D1D6', color: 'white',
                fontSize: 15, fontWeight: 700, cursor: newTitle.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit', opacity: creating ? 0.6 : 1,
              }}
            >
              {creating ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
