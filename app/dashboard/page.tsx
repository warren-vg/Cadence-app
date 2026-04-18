'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Goal {
  id: string
  text: string
  category: string
  status: string
  priority: number
  progress: number
}

interface Profile {
  username: string
  avatar_url: string | null
}

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

function getDateLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function getMomentumText(score: number) {
  if (score >= 80) return "Excellent! You're crushing it this week."
  if (score >= 60) return "Strong week! Keep pushing toward your goals."
  if (score >= 40) return "Good progress. Stay consistent and build momentum."
  if (score > 0) return "Just getting started. Every step counts."
  return "Set your goals to start tracking momentum."
}

function CircularProgress({ pct, size = 52 }: { pct: number; size?: number }) {
  const strokeWidth = 5
  const r = (size - strokeWidth * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(pct, 100) / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#DBEAFE" strokeWidth={strokeWidth} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#3B7DFF"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#1C1C1E',
      }}>
        {pct}%
      </div>
    </div>
  )
}

function DonutChart({ tasksRatio, availableRatio, size = 96 }: { tasksRatio: number; availableRatio: number; size?: number }) {
  const strokeWidth = 10
  const r = (size - strokeWidth * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const tasksDash = circ * tasksRatio
  const availDash = circ * availableRatio
  const availRotate = -90 + 360 * tasksRatio

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E5EA" strokeWidth={strokeWidth} />
      {tasksRatio > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="#3B7DFF" strokeWidth={strokeWidth}
          strokeDasharray={`${tasksDash} ${circ - tasksDash}`}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      {availableRatio > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="#34C759" strokeWidth={strokeWidth}
          strokeDasharray={`${availDash} ${circ - availDash}`}
          strokeLinecap="butt"
          transform={`rotate(${availRotate} ${cx} ${cy})`}
        />
      )}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#1C1C1E">
        {Math.round((tasksRatio + availableRatio) * 40)}h
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#8E8E93">Total</text>
    </svg>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')
  const [dateLabel, setDateLabel] = useState('')

  useEffect(() => {
    setGreeting(getGreeting())
    setDateLabel(getDateLabel())

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: profileData }, { data: goalsData }] = await Promise.all([
        supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id).order('priority', { ascending: true }),
      ])

      setProfile(profileData)
      setGoals(goalsData || [])
      setLoading(false)
    }
    load()
  }, [])

  const activeGoals = goals.filter(g => g.status === 'active')
  const topPriorities = activeGoals.slice(0, 3)
  const momentumScore = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / activeGoals.length)
    : 0

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const firstName = profile?.username?.split(' ')[0] || 'there'

  return (
    <div style={{ padding: '56px 16px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ fontSize: 14, color: '#8E8E93', marginTop: 3 }}>
            Today only needs one meaningful move.
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/settings')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: 2 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Today's Focus Card */}
      <div style={{
        background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
        borderRadius: 20,
        padding: '20px',
        marginBottom: 14,
        color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>{dateLabel}</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>Today's Focus</h2>
          </div>
          <span style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 20,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
          }}>
            0/0 Done
          </span>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 12,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, opacity: 0.85, margin: 0 }}>No tasks scheduled yet.</p>
          <p style={{ fontSize: 12, opacity: 0.65, margin: '4px 0 0' }}>Build your daily plan in the Plan tab.</p>
        </div>

        <button
          onClick={() => router.push('/dashboard/plan')}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: 10,
            padding: '10px',
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: 'inherit',
          }}
        >
          View Full Day
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Momentum Score Card */}
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '18px 20px',
        marginBottom: 14,
        border: '0.5px solid #E5E5EA',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: '#FFF3E0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF9500" stroke="none">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>Momentum Score</p>
              <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>This week</p>
            </div>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#FF9500' }}>{momentumScore}</span>
        </div>

        <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, marginBottom: 10, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${momentumScore}%`,
            background: momentumScore >= 60 ? '#34C759' : momentumScore >= 30 ? '#FF9500' : '#FF3B30',
            borderRadius: 4,
            transition: 'width 0.6s ease',
          }} />
        </div>

        <p style={{ fontSize: 13, color: '#3C3C43', margin: 0 }}>{getMomentumText(momentumScore)}</p>
      </div>

      {/* Top Priorities Card */}
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '18px 20px',
        marginBottom: 14,
        border: '0.5px solid #E5E5EA',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="1" fill="#3B7DFF" />
            </svg>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Top Priorities</h2>
          </div>
          <button
            onClick={() => router.push('/dashboard/goals')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', padding: 0 }}
          >
            View All
          </button>
        </div>

        {topPriorities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#8E8E93' }}>
            <p style={{ fontSize: 14, margin: 0 }}>No active goals yet.</p>
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>Add goals to see your priorities here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topPriorities.map(goal => (
              <button
                key={goal.id}
                onClick={() => router.push(`/dashboard/goals/${goal.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, textAlign: 'left', width: '100%',
                  fontFamily: 'inherit',
                }}
              >
                <CircularProgress pct={goal.progress || 0} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 14, fontWeight: 500, color: '#1C1C1E',
                    margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {goal.text}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 11, color: '#3B7DFF',
                      background: '#EFF6FF', padding: '2px 8px', borderRadius: 20,
                    }}>
                      {goal.category}
                    </span>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D1D6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* This Week Card */}
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '18px 20px',
        marginBottom: 14,
        border: '0.5px solid #E5E5EA',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>This Week</h2>
          </div>
          <button
            onClick={() => router.push('/dashboard/plan')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', padding: 0 }}
          >
            Edit Plan
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <DonutChart tasksRatio={0.55} availableRatio={0.25} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B7DFF' }} />
                <span style={{ fontSize: 13, color: '#3C3C43' }}>Tasks Planned</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>
                {activeGoals.length > 0 ? `${activeGoals.length * 3} tasks` : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34C759' }} />
                <span style={{ fontSize: 13, color: '#3C3C43' }}>Available</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>10h</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#3C3C43' }}>Capacity Used</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>—</span>
            </div>
          </div>
        </div>

        {activeGoals.length > 0 && (
          <div style={{
            background: '#F0FFF4',
            borderRadius: 10,
            padding: '10px 12px',
            marginTop: 14,
          }}>
            <p style={{ fontSize: 12, color: '#16A34A', margin: 0 }}>
              You have {activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''}. Build your weekly plan to stay on track.
            </p>
          </div>
        )}
      </div>

      {/* Weekly Review Due Card */}
      <div style={{
        background: '#FFFBEB',
        borderRadius: 20,
        padding: '18px 20px',
        marginBottom: 14,
        border: '1px solid #FDE68A',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#92400E', margin: 0 }}>Weekly Review Due</p>
            <p style={{ fontSize: 13, color: '#B45309', margin: '4px 0 12px' }}>
              Reflect on last week's progress and plan the week ahead.
            </p>
            <button
              onClick={() => router.push('/dashboard/review')}
              style={{
                background: 'white',
                border: '1px solid #D97706',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#D97706',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Start Review
            </button>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/dashboard/goals')}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#3B7DFF',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(59, 125, 255, 0.4)',
          zIndex: 99,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

    </div>
  )
}
