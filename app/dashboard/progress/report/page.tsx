'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMonday, addDays, getMomentumScore } from '@/lib/planData'
import { getTasksForWeek, getWeekStreakFromDB, getProjects, type DBTask } from '@/lib/db'

interface Goal {
  id: string
  text: string
  category: string
  status: string
  progress: number
}

interface Stats {
  activeGoals: number
  avgProgress: number
  momentumScore: number
  tasksCompleted: number
  weeklyAvgScore: number
  goalsOnTrack: string
  projectsActive: number
}

function BarChartSimple({ cats }: { cats: { category: string; progress: number }[] }) {
  if (cats.length === 0) return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: '#8E8E93', fontSize: 13 }}>
      No goal data yet
    </div>
  )
  const W = 300, H = 140, PL = 28, PR = 8, PT = 8, PB = 28
  const cw = W - PL - PR
  const ch = H - PT - PB
  const n = cats.length
  const gapTotal = cw * 0.38
  const barW = (cw - gapTotal) / n
  const gapW = gapTotal / (n + 1)
  const getX = (i: number) => PL + gapW * (i + 1) + barW * i
  const getBarH = (v: number) => (v / 100) * ch
  const getBarY = (v: number) => PT + ch - getBarH(v)
  const yLabels = [0, 20, 40, 60, 80]

  return (
    <div style={{ width: '100%', paddingBottom: `${(H / W) * 100}%`, height: 0, position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {yLabels.map(v => (
          <g key={v}>
            <line x1={PL} y1={getBarY(v)} x2={W - PR} y2={getBarY(v)} stroke="#EFEFF4" strokeWidth="1" strokeDasharray="3 2" />
            <text x={PL - 3} y={getBarY(v) + 3} textAnchor="end" fontSize="8" fill="#C7C7CC">{v}</text>
          </g>
        ))}
        {cats.map((c, i) => {
          const bx = getX(i)
          return (
            <g key={i}>
              <rect x={bx} y={getBarY(c.progress)} width={barW} height={getBarH(c.progress)} fill="#3B7DFF" rx="4" />
              <text x={bx + barW / 2} y={H - 8} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{c.category}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function ProgressReportPage() {
  const router = useRouter()
  const [userName, setUserName]       = useState('')
  const [cats, setCats]               = useState<{ category: string; progress: number }[]>([])
  const [stats, setStats]             = useState<Stats>({ activeGoals: 0, avgProgress: 0, momentumScore: 0, tasksCompleted: 0, weeklyAvgScore: 0, goalsOnTrack: '0/0', projectsActive: 0 })
  const [achievements, setAchievements]     = useState<{ title: string; sub: string }[]>([])
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [mounted, setMounted]         = useState(false)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const today  = new Date()
      const monday = getMonday(today)

      const [
        { data: profileData },
        { data: goalsData },
        projects,
        streak,
      ] = await Promise.all([
        supabase.from('profiles').select('username, weekly_capacity').eq('id', user.id).single(),
        supabase.from('goals').select('id,text,category,status,progress').eq('user_id', user.id),
        getProjects(user.id),
        getWeekStreakFromDB(user.id),
      ])

      const name = profileData?.username?.split(' ')[0] || 'You'
      const weeklyCapacity: number = profileData?.weekly_capacity ?? 40
      setUserName(name)

      const goalList: Goal[] = (goalsData || []) as Goal[]
      const activeGoals = goalList.filter(g => g.status === 'active')

      // Fetch last 4 weeks of tasks
      const weekTaskBuckets: DBTask[][] = await Promise.all(
        [0, 1, 2, 3].map(i => getTasksForWeek(user.id, addDays(monday, -i * 7)))
      )
      const allRecentTasks = weekTaskBuckets.flat()
      const currentWeekTasks = weekTaskBuckets[0]

      // Stats
      const avgProgress = activeGoals.length > 0
        ? Math.round(activeGoals.reduce((s, g) => s + (g.progress || 0), 0) / activeGoals.length)
        : 0

      const tasksCompleted = allRecentTasks.filter(t => t.completed).length

      const weeklyRates = weekTaskBuckets
        .map(wt => wt.length > 0 ? Math.round((wt.filter(t => t.completed).length / wt.length) * 100) : null)
        .filter((r): r is number => r !== null)
      const weeklyAvgScore = weeklyRates.length > 0
        ? Math.round(weeklyRates.reduce((s, r) => s + r, 0) / weeklyRates.length)
        : 0

      const momentumScore = getMomentumScore(activeGoals, currentWeekTasks, streak, weeklyCapacity)

      const goalsOnTrack = activeGoals.filter(g => (g.progress || 0) >= 50).length
      const projectsActive = projects.filter(p => p.status !== 'archived' && p.status !== 'completed').length

      setStats({
        activeGoals:   activeGoals.length,
        avgProgress,
        momentumScore,
        tasksCompleted,
        weeklyAvgScore,
        goalsOnTrack:  `${goalsOnTrack}/${activeGoals.length}`,
        projectsActive,
      })

      // Category chart
      const knownCats = ['Career', 'Finance', 'Health', 'Creative']
      const catData = knownCats
        .map(cat => {
          const matching = activeGoals.filter(g => g.category === cat)
          if (matching.length === 0) return null
          return {
            category: cat,
            progress: Math.round(matching.reduce((s, g) => s + (g.progress || 0), 0) / matching.length),
          }
        })
        .filter((c): c is { category: string; progress: number } => c !== null)
      setCats(catData)

      // Achievements: goals at >= 80% progress, sorted descending
      const achieved = [...activeGoals]
        .filter(g => (g.progress || 0) >= 80)
        .sort((a, b) => b.progress - a.progress)
        .map(g => ({
          title: g.text.length > 48 ? g.text.slice(0, 48) + '…' : g.text,
          sub:   `${g.category} · ${g.progress}% complete`,
        }))
      setAchievements(achieved)

      // Recommendations: goals under 50%, sorted ascending
      const recs = [...activeGoals]
        .filter(g => (g.progress || 0) < 50)
        .sort((a, b) => a.progress - b.progress)
        .slice(0, 4)
        .map(g => {
          const label = g.text.length > 44 ? g.text.slice(0, 44) + '…' : g.text
          return `Increase focus on: ${label}`
        })
      setRecommendations(recs)

      setLoading(false)
    }
    load()
  }, [])

  if (!mounted) return null

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const handleExportPDF = () => {
    window.alert('PDF export coming soon! In a production app this would generate a downloadable PDF.')
  }

  const handleShare = () => {
    window.alert('Snapshot sharing coming soon! In a production app this would generate a shareable link.')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 16px' }}>
      {/* Header */}
      <div style={{ padding: '56px 16px 16px', background: 'white', borderBottom: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button
              onClick={() => router.back()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              Progress
            </button>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Progress Report</h1>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>{monthLabel}</p>
          </div>
          <button
            onClick={handleExportPDF}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: 40 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Hero banner */}
        <div style={{
          background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
          borderRadius: 20, padding: '22px', marginBottom: 14, color: 'white', textAlign: 'center',
        }}>
          <p style={{ fontSize: 20, fontWeight: 800, margin: '0 0 2px' }}>{userName}&apos;s Progress Report</p>
          <p style={{ fontSize: 13, opacity: 0.8, margin: '0 0 18px' }}>Month of {monthLabel}</p>
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)', marginBottom: 18 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Active Goals',   value: stats.activeGoals },
              { label: 'Avg Progress',   value: `${stats.avgProgress}%` },
              { label: 'Momentum Score', value: stats.momentumScore },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontSize: 26, fontWeight: 800, margin: '0 0 2px', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 11, opacity: 0.75, margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Category chart */}
        <div style={{ background: 'white', borderRadius: 20, padding: '18px 18px 14px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Progress by Category</h2>
          <BarChartSimple cats={cats} />
        </div>

        {/* Key Achievements */}
        <div style={{ background: 'white', borderRadius: 20, padding: '18px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Key Achievements</h2>
          {achievements.length === 0 ? (
            <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>Goals reaching 80%+ will appear here.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {achievements.map((a, i) => (
                <div key={i} style={{ background: '#F0FDF4', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', margin: '0 0 2px' }}>{a.title}</p>
                      <p style={{ fontSize: 12, color: '#16A34A', margin: 0 }}>{a.sub}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Stats */}
        <div style={{ background: 'white', borderRadius: 20, padding: '18px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Monthly Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Tasks Completed',  value: stats.tasksCompleted },
              { label: 'Weekly Avg Score', value: `${stats.weeklyAvgScore}%` },
              { label: 'Goals on Track',   value: stats.goalsOnTrack },
              { label: 'Projects Active',  value: stats.projectsActive },
            ].map(s => (
              <div key={s.label} style={{ background: '#F8F8FC', borderRadius: 12, padding: '14px' }}>
                <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 4px' }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#1C1C1E', margin: 0, lineHeight: 1 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div style={{
          background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)',
          borderRadius: 20, padding: '18px', marginBottom: 20,
          border: '1px solid #DBEAFE',
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1D4ED8', margin: '0 0 12px' }}>Recommended Focus for Next Month</p>
          {recommendations.length === 0 ? (
            <p style={{ fontSize: 13, color: '#1D4ED8', margin: 0 }}>All active goals are on track — great work!</p>
          ) : (
            recommendations.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < recommendations.length - 1 ? 8 : 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3B7DFF', marginTop: 5, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 1.5 }}>{r}</span>
              </div>
            ))
          )}
        </div>

        {/* Export / Share buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button
            onClick={handleExportPDF}
            style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: '#3B7DFF', border: 'none', color: 'white',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export PDF
          </button>
          <button
            onClick={handleShare}
            style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: 'white', border: '1.5px solid #E5E5EA', color: '#1C1C1E',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share Snapshot
          </button>
        </div>

        <button
          onClick={() => router.back()}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, color: '#3B7DFF', fontFamily: 'inherit',
            padding: '10px 0', textAlign: 'center',
          }}
        >
          Back to Progress
        </button>
      </div>
    </div>
  )
}
