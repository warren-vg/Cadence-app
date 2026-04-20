'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getMonday, getTasksForWeek,
  getWeekStreak,
  getMomentumScore,
} from '@/lib/planData'

interface Goal {
  id:       string
  text:     string
  category: string
  status:   string
  progress: number
  estimated_weekly_hours?: number | null
}

interface WeekData {
  label:      string
  short:      string
  score:      number
  completed:  number
  total:      number
  hours:      number
  rate:       number
  efficiency: number
  career:     number
  health:     number
  finance:    number
  creative:   number
}

interface CatData {
  category:   string
  progress:   number
  hours:      number
  tasks:      number
  efficiency: number
}

type ModalType = 'momentum' | 'category' | 'time' | 'completion' | null

const BASE_WEEKS: WeekData[] = [
  { label: 'Week 1', short: 'W1', score: 65, completed: 8,  total: 12, hours: 18, rate: 67, efficiency: 67, career: 6, health: 5, finance: 4, creative: 3 },
  { label: 'Week 2', short: 'W2', score: 72, completed: 10, total: 13, hours: 21, rate: 77, efficiency: 77, career: 8, health: 5, finance: 4, creative: 4 },
  { label: 'Week 3', short: 'W3', score: 68, completed: 9,  total: 14, hours: 19, rate: 64, efficiency: 64, career: 7, health: 4, finance: 3, creative: 5 },
  { label: 'Week 4', short: 'W4', score: 78, completed: 12, total: 15, hours: 24, rate: 80, efficiency: 80, career: 8, health: 6, finance: 4, creative: 6 },
]

const BASE_CATS: CatData[] = [
  { category: 'Career',   progress: 45, hours: 8, tasks: 12, efficiency: 1.5 },
  { category: 'Finance',  progress: 60, hours: 4, tasks: 8,  efficiency: 2.0 },
  { category: 'Health',   progress: 70, hours: 6, tasks: 10, efficiency: 1.7 },
  { category: 'Creative', progress: 30, hours: 5, tasks: 7,  efficiency: 1.4 },
]

const CAT_COLORS: Record<string, string> = {
  career:   '#3B7DFF',
  health:   '#34C759',
  finance:  '#FF9500',
  creative: '#9333EA',
}

function buildWeeklyData(): WeekData[] {
  try {
    const today   = new Date()
    const monday  = getMonday(today)
    const tasks   = getTasksForWeek(monday)
    if (!tasks.length) return BASE_WEEKS

    const completed = tasks.filter(t => t.completed).length
    const total     = tasks.length
    const hours     = parseFloat(tasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
    const rate      = total > 0 ? Math.round((completed / total) * 100) : 0
    const byCategory = (cat: string) =>
      parseFloat(tasks.filter(t => t.category === cat).reduce((s, t) => s + t.duration, 0).toFixed(1))

    const updated = [...BASE_WEEKS]
    updated[3] = {
      ...updated[3],
      score: rate, completed, total, hours, rate,
      efficiency: rate,
      career:  byCategory('Career'),
      health:  byCategory('Health'),
      finance: byCategory('Finance'),
      creative: byCategory('Creative'),
    }
    return updated
  } catch {
    return BASE_WEEKS
  }
}

function buildCatData(goals: Goal[]): CatData[] {
  const active = goals.filter(g => g.status === 'active')
  if (!active.length) return BASE_CATS

  return BASE_CATS.map(base => {
    const matching = active.filter(g => g.category === base.category)
    if (!matching.length) return base
    const avg = Math.round(matching.reduce((s, g) => s + (g.progress || 0), 0) / matching.length)
    return { ...base, progress: avg }
  })
}

export default function ProgressPage() {
  const router = useRouter()
  const [goals, setGoals]           = useState<Goal[]>([])
  const [weeklyData, setWeeklyData] = useState<WeekData[]>(BASE_WEEKS)
  const [catData, setCatData]       = useState<CatData[]>(BASE_CATS)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [timePeriod, setTimePeriod] = useState('This Month')
  const [loading, setLoading]       = useState(true)
  const [mounted, setMounted]       = useState(false)

  const [weekStreak, setWeekStreak] = useState(0)
  const [momentumScore, setMomentumScore] = useState(0)

  const [momentumActive, setMomentumActive]     = useState<number | null>(null)
  const [catActive, setCatActive]               = useState<number | null>(null)
  const [completionActive, setCompletionActive] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    const weeks = buildWeeklyData()
    setWeeklyData(weeks)

    setWeekStreak(getWeekStreak())

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('goals')
        .select('id,text,category,status,progress,estimated_weekly_hours')
        .eq('user_id', user.id)

      const goalList = data || []
      setGoals(goalList)
      setCatData(buildCatData(goalList))

      setMomentumScore(getMomentumScore(goalList))

      setLoading(false)
    }
    load()
  }, [])

  if (!mounted) return null

  const activeGoals  = goals.filter(g => g.status === 'active')
  const currentWeek  = weeklyData[3]
  const periods      = ['This Week', 'This Month', 'This Quarter', 'This Year']

  const wins       = ['Portfolio site live', '3 runs completed', 'Budget on track']
  const needsFocus = ['Blog post delayed', 'Creative time low']

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  const W = 300, H = 120, pad = 20
  const scores     = weeklyData.map(w => w.score)
  const maxScore   = Math.max(...scores, 1)
  const getX       = (i: number) => pad + (i / (weeklyData.length - 1)) * (W - pad * 2)
  const getY       = (v: number) => H - pad - ((v / maxScore) * (H - pad * 2))
  const pathD      = weeklyData.map((w, i) => `${i === 0 ? 'M' : 'L'}${getX(i)},${getY(w.score)}`).join(' ')
  const areaD      = `${pathD} L${getX(weeklyData.length - 1)},${H - pad} L${getX(0)},${H - pad} Z`

  const barW  = 36
  const barGap = 12
  const BH    = 100
  const getBarH = (v: number) => Math.max(4, Math.round((v / 100) * BH))
  const getBarY = (v: number) => BH - getBarH(v)

  const compW   = 280
  const compH   = 80
  const getCompX = (i: number) => 16 + (i / (weeklyData.length - 1)) * (compW - 32)
  const getCompY = (v: number) => compH - Math.round((v / 100) * (compH - 10))
  const compPath = weeklyData.map((w, i) => `${i === 0 ? 'M' : 'L'}${getCompX(i)},${getCompY(w.rate)}`).join(' ')
  const compArea = `${compPath} L${getCompX(weeklyData.length - 1)},${compH} L${getCompX(0)},${compH} Z`

  return (
    <div style={{ padding: '56px 16px 100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Progress</h1>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>Your momentum, visualised</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/progress/community')}
          style={{ background: 'none', border: '0.5px solid #E5E5EA', borderRadius: 20, padding: '6px 14px', fontSize: 13, color: '#3B7DFF', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Community
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, overflowX: 'auto' }}>
        {[
          { icon: '⚡', label: 'Momentum',    value: momentumScore, bg: '#FFF3E0', iconBg: '#FFE0B2' },
          { icon: '🔥', label: 'Week Streak', value: weekStreak,    bg: '#FFFBEB', iconBg: '#FDE68A' },
          { icon: '✓',  label: 'Active Goals', value: activeGoals.length, bg: '#F0FFF4', iconBg: '#BBF7D0' },
          { icon: '📋', label: 'This Week',   value: `${currentWeek.completed}/${currentWeek.total}`, bg: '#EFF6FF', iconBg: '#BFDBFE' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: stat.bg, borderRadius: 14, padding: '12px 14px',
            minWidth: 80, flexShrink: 0, textAlign: 'center',
          }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: stat.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 16 }}>
              {stat.icon}
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 2px' }}>{stat.value}</p>
            <p style={{ fontSize: 11, color: '#8E8E93', margin: 0 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Time period filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {periods.map(p => (
          <button
            key={p}
            onClick={() => setTimePeriod(p)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, whiteSpace: 'nowrap',
              border: '0.5px solid #E5E5EA', cursor: 'pointer', fontFamily: 'inherit',
              background: timePeriod === p ? '#1C1C1E' : 'white',
              color:      timePeriod === p ? 'white'   : '#3C3C43',
              fontWeight: timePeriod === p ? 600        : 400,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Momentum Chart */}
      <div
        style={{ background: 'white', borderRadius: 18, padding: '16px', border: '0.5px solid #E5E5EA', marginBottom: 12, cursor: 'pointer' }}
        onClick={() => setActiveModal('momentum')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Momentum Score</p>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: '2px 0 0' }}>Weekly trend</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#3B7DFF', margin: 0 }}>{momentumScore}</p>
            <p style={{ fontSize: 11, color: '#34C759', margin: '1px 0 0' }}>↑ Current</p>
          </div>
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B7DFF" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3B7DFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#areaGrad)" />
          <path d={pathD} fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {weeklyData.map((w, i) => (
            <g key={i}>
              <circle
                cx={getX(i)} cy={getY(w.score)} r={momentumActive === i ? 6 : 4}
                fill={momentumActive === i ? '#3B7DFF' : 'white'}
                stroke="#3B7DFF" strokeWidth="2"
                onMouseEnter={() => setMomentumActive(i)}
                onMouseLeave={() => setMomentumActive(null)}
                style={{ cursor: 'pointer' }}
              />
              {momentumActive === i && (
                <text x={getX(i)} y={getY(w.score) - 10} textAnchor="middle" fontSize="11" fill="#3B7DFF" fontWeight="700">
                  {w.score}
                </text>
              )}
              <text x={getX(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="#C7C7CC">{w.short}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Category Progress Chart */}
      <div
        style={{ background: 'white', borderRadius: 18, padding: '16px', border: '0.5px solid #E5E5EA', marginBottom: 12, cursor: 'pointer' }}
        onClick={() => setActiveModal('category')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Category Progress</p>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: '2px 0 0' }}>
              {catData.sort((a, b) => b.progress - a.progress)[0]?.category} leading
            </p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
        <div style={{ position: 'relative', height: BH + 30 }}>
          <svg width="100%" viewBox={`0 0 ${(barW + barGap) * catData.length + barGap} ${BH + 24}`}>
            {catData.map((c, i) => {
              const bx    = barGap + i * (barW + barGap)
              const bh    = getBarH(c.progress)
              const by    = getBarY(c.progress)
              const color = CAT_COLORS[c.category.toLowerCase()] || '#8E8E93'
              const isActive = catActive === i
              return (
                <g key={c.category}
                  onMouseEnter={() => setCatActive(i)}
                  onMouseLeave={() => setCatActive(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect x={bx} y={0} width={barW} height={BH} rx="6" fill={isActive ? '#F2F2F7' : 'transparent'} />
                  <rect x={bx} y={by} width={barW} height={bh} fill={color} rx="4" opacity={isActive ? 1 : 0.8} />
                  {isActive && (
                    <text x={bx + barW / 2} y={by - 5} textAnchor="middle" fontSize="11" fill={color} fontWeight="700">{c.progress}%</text>
                  )}
                  <text x={bx + barW / 2} y={BH + 14} textAnchor="middle" fontSize="9" fill="#8E8E93">
                    {c.category.slice(0, 3)}
                  </text>
                </g>
              )
            })}
          </svg>
          {catActive !== null && (
            <div style={{
              position: 'absolute',
              top: `${(getBarY(catData[catActive].progress) / BH) * 100}%`,
              right: 0,
              background: 'white', borderRadius: 8, padding: '6px 10px',
              border: '0.5px solid #E5E5EA', fontSize: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <div style={{ fontWeight: 700, color: '#1C1C1E' }}>{catData[catActive].category}</div>
              <div style={{ fontSize: 12, color: '#3B7DFF' }}>progress: {catData[catActive].progress}%</div>
              <div style={{ fontSize: 12, color: '#8E8E93' }}>{catData[catActive].tasks} tasks · {catData[catActive].hours}h</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {catData.map(c => (
            <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[c.category.toLowerCase()] || '#8E8E93' }} />
              <span style={{ fontSize: 12, color: '#3C3C43' }}>{c.category}: {c.progress}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Completion Rate Chart */}
      <div
        style={{ background: 'white', borderRadius: 18, padding: '16px', border: '0.5px solid #E5E5EA', marginBottom: 12, cursor: 'pointer' }}
        onClick={() => setActiveModal('completion')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Completion Rate</p>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: '2px 0 0' }}>Tasks done vs planned</p>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: currentWeek.rate >= 80 ? '#34C759' : '#FF9500' }}>
            {currentWeek.rate}%
          </span>
        </div>
        <svg width="100%" viewBox={`0 0 ${compW} ${compH + 16}`}>
          <defs>
            <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34C759" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#34C759" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line
            x1={16} y1={getCompY(80)} x2={compW - 16} y2={getCompY(80)}
            stroke="#E5E5EA" strokeWidth="1.5" strokeDasharray="4 4"
          />
          <text x={compW - 14} y={getCompY(80) - 3} fontSize="9" fill="#C7C7CC" textAnchor="end">80% target</text>
          <path d={compArea} fill="url(#compGrad)" />
          <path d={compPath} fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {weeklyData.map((w, i) => (
            <g key={i}>
              <circle
                cx={getCompX(i)} cy={getCompY(w.rate)} r={completionActive === i ? 6 : 4}
                fill={completionActive === i ? '#34C759' : 'white'}
                stroke="#34C759" strokeWidth="2"
                onMouseEnter={() => setCompletionActive(i)}
                onMouseLeave={() => setCompletionActive(null)}
                style={{ cursor: 'pointer' }}
              />
              {completionActive === i && (
                <text x={getCompX(i)} y={getCompY(w.rate) - 9} textAnchor="middle" fontSize="11" fill="#34C759" fontWeight="700">
                  {w.rate}%
                </text>
              )}
              <text x={getCompX(i)} y={compH + 14} textAnchor="middle" fontSize="10" fill="#C7C7CC">{w.short}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Insights */}
      <div style={{ background: 'white', borderRadius: 18, padding: '16px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px' }}>Insights</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ...wins.map(w => ({ text: w, type: 'win' as const })),
            ...needsFocus.map(n => ({ text: n, type: 'focus' as const })),
            catData.length > 0 && {
              text: `${catData.sort((a, b) => b.progress - a.progress)[0].category} goals are performing best — consider doubling down`,
              type: 'win' as const,
            },
          ].filter(Boolean).map((item, i) => {
            if (!item) return null
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14 }}>{item.type === 'win' ? '✓' : '⚠️'}</span>
                <p style={{ fontSize: 13, color: '#3C3C43', margin: 0, lineHeight: 1.4 }}>{item.text}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active Goals */}
      <div style={{ background: 'white', borderRadius: 18, padding: '16px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px' }}>Active Goals</p>
        {activeGoals.length === 0 ? (
          <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>No active goals yet. Head to Goals to activate some.</p>
        ) : (
          activeGoals.map(goal => (
            <div key={goal.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: '#1C1C1E', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {goal.text}
                </p>
                <div style={{ background: '#F2F2F7', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${goal.progress || 0}%`, background: '#3B7DFF', borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', flexShrink: 0 }}>{goal.progress || 0}%</span>
            </div>
          ))
        )}
      </div>

      {/* Report link */}
      <button
        onClick={() => router.push('/dashboard/progress/report')}
        style={{
          width: '100%', padding: '14px', borderRadius: 14,
          background: 'white', border: '0.5px solid #E5E5EA',
          fontSize: 14, fontWeight: 500, color: '#3C3C43',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        View Full Report
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Modal */}
      {activeModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', width: '100%', maxHeight: '70vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 16px' }}>
              {activeModal === 'momentum'   ? 'Momentum Detail'    :
               activeModal === 'category'  ? 'Category Breakdown' :
               activeModal === 'time'      ? 'Time Investment'     :
               'Completion Rate'}
            </p>
            <p style={{ fontSize: 13, color: '#8E8E93' }}>Detailed drill-down coming soon.</p>
          </div>
        </div>
      )}
    </div>
  )
}
