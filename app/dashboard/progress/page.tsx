'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMonday, getTasksForWeek } from '@/lib/planData'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id: string
  text: string
  category: string
  status: string
  progress: number
}

interface WeekData {
  label: string
  short: string
  score: number
  completed: number
  total: number
  hours: number
  rate: number
  efficiency: number
  career: number
  health: number
  finance: number
  creative: number
}

interface CatData {
  category: string
  progress: number
  hours: number
  tasks: number
  efficiency: number
}

type ModalType = 'momentum' | 'category' | 'time' | 'completion' | null

// ─── Seed / mock base data ────────────────────────────────────────────────────

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


// ─── Data helpers ─────────────────────────────────────────────────────────────

function buildWeeklyData(): WeekData[] {
  try {
    const today = new Date()
    const monday = getMonday(today)
    const tasks = getTasksForWeek(monday)
    if (!tasks.length) return BASE_WEEKS

    const completed = tasks.filter(t => t.completed).length
    const total = tasks.length
    const hours = parseFloat(tasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    const byCategory = (cat: string) =>
      parseFloat(tasks.filter(t => t.category === cat).reduce((s, t) => s + t.duration, 0).toFixed(1))

    const updated = [...BASE_WEEKS]
    updated[3] = { ...updated[3], score: rate, completed, total, hours, rate, efficiency: rate, career: byCategory('Career'), health: byCategory('Health'), finance: byCategory('Finance'), creative: byCategory('Creative') }
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

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LineChart({ weeks, activeIdx, onPoint, multiSeries }: {
  weeks: WeekData[]
  activeIdx: number | null
  onPoint: (i: number | null) => void
  multiSeries?: boolean
}) {
  const W = 320, H = 110, PL = 30, PR = 8, PT = 8, PB = 22
  const cw = W - PL - PR
  const ch = H - PT - PB
  const maxY = multiSeries ? 30 : 100

  const getX = (i: number) => PL + (i / (weeks.length - 1)) * cw
  const getY = (v: number, max = maxY) => PT + ch * (1 - Math.min(v, max) / max)

  const mainPts = weeks.map((w, i) => ({ x: getX(i), y: getY(w.score, 100) }))
  const mainD = mainPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  const taskPts = multiSeries ? weeks.map((w, i) => ({ x: getX(i), y: getY(w.completed, 30) })) : []
  const taskD = multiSeries ? taskPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') : ''

  const hourPts = multiSeries ? weeks.map((w, i) => ({ x: getX(i), y: getY(w.hours, 30) })) : []
  const hourD = multiSeries ? hourPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') : ''

  const yLabels = [0, 20, 40, 60, 80]

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W) * 100}%`, height: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {yLabels.map(v => (
          <g key={v}>
            <line x1={PL} y1={getY(v, 100)} x2={W - PR} y2={getY(v, 100)} stroke="#EFEFF4" strokeWidth="1" strokeDasharray="3 2" />
            <text x={PL - 3} y={getY(v, 100) + 3} textAnchor="end" fontSize="8" fill="#C7C7CC">{v}</text>
          </g>
        ))}

        {multiSeries && taskD && (
          <path d={taskD} fill="none" stroke={CAT_COLORS.health} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {multiSeries && hourD && (
          <path d={hourD} fill="none" stroke={CAT_COLORS.finance} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        <path d={mainD} fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {mainPts.map((p, i) => (
          <g key={i} onClick={e => { e.stopPropagation(); onPoint(activeIdx === i ? null : i) }} style={{ cursor: 'pointer' }}>
            <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="5" fill={activeIdx === i ? '#3B7DFF' : 'white'} stroke="#3B7DFF" strokeWidth="2.5" />
            <text x={p.x} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{weeks[i].label}</text>
          </g>
        ))}
      </svg>

      {activeIdx !== null && (
        <div style={{
          position: 'absolute',
          left: `${(mainPts[activeIdx].x / W) * 100}%`,
          top: `${(mainPts[activeIdx].y / H) * 100}%`,
          transform: 'translate(-50%, -100%) translateY(-6px)',
          background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8,
          padding: '5px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{weeks[activeIdx].label}</div>
          <div style={{ fontSize: 12, color: '#3B7DFF' }}>score : {weeks[activeIdx].score}</div>
        </div>
      )}
    </div>
  )
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

function BarChart({ cats, activeIdx, onBar }: {
  cats: CatData[]
  activeIdx: number | null
  onBar: (i: number | null) => void
}) {
  const W = 320, H = 148, PL = 28, PR = 8, PT = 8, PB = 28
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
    <div style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W) * 100}%`, height: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {yLabels.map(v => (
          <g key={v}>
            <line x1={PL} y1={getBarY(v)} x2={W - PR} y2={getBarY(v)} stroke="#EFEFF4" strokeWidth="1" strokeDasharray="3 2" />
            <text x={PL - 3} y={getBarY(v) + 3} textAnchor="end" fontSize="8" fill="#C7C7CC">{v}</text>
          </g>
        ))}

        {cats.map((c, i) => {
          const bx = getX(i)
          const bh = getBarH(c.progress)
          const by = getBarY(c.progress)
          return (
            <g key={i} onClick={e => { e.stopPropagation(); onBar(activeIdx === i ? null : i) }} style={{ cursor: 'pointer' }}>
              {activeIdx === i && (
                <rect x={bx - 3} y={PT} width={barW + 6} height={ch} fill="#F8F8FC" rx="3" />
              )}
              <rect x={bx} y={by} width={barW} height={bh} fill={activeIdx === i ? '#2D6AE8' : '#3B7DFF'} rx="4" />
              <text x={bx + barW / 2} y={H - 8} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{c.category}</text>
            </g>
          )
        })}
      </svg>

      {activeIdx !== null && (
        <div style={{
          position: 'absolute',
          left: `${((getX(activeIdx) + barW / 2) / W) * 100}%`,
          top: `${(getBarY(cats[activeIdx].progress) / H) * 100}%`,
          transform: 'translate(-50%, -100%) translateY(-4px)',
          background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8,
          padding: '5px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{cats[activeIdx].category}</div>
          <div style={{ fontSize: 12, color: '#3B7DFF' }}>progress : {cats[activeIdx].progress}</div>
        </div>
      )}
    </div>
  )
}

// ─── SVG Stacked Bar Chart ────────────────────────────────────────────────────

function StackedBarChart({ weeks, activeIdx, onBar }: {
  weeks: WeekData[]
  activeIdx: number | null
  onBar: (i: number | null) => void
}) {
  const W = 320, H = 130, PL = 28, PR = 8, PT = 8, PB = 24
  const cw = W - PL - PR
  const ch = H - PT - PB
  const n = weeks.length
  const maxH = 24
  const gapTotal = cw * 0.38
  const barW = (cw - gapTotal) / n
  const gapW = gapTotal / (n + 1)
  const getX = (i: number) => PL + gapW * (i + 1) + barW * i
  const toY = (v: number) => (v / maxH) * ch
  const yLabels = [0, 6, 12, 18, 24]

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W) * 100}%`, height: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {yLabels.map(v => (
          <g key={v}>
            <line x1={PL} y1={PT + ch - toY(v)} x2={W - PR} y2={PT + ch - toY(v)} stroke="#EFEFF4" strokeWidth="1" strokeDasharray="3 2" />
            <text x={PL - 3} y={PT + ch - toY(v) + 3} textAnchor="end" fontSize="8" fill="#C7C7CC">{v}</text>
          </g>
        ))}

        {weeks.map((w, i) => {
          const bx = getX(i)
          const base = PT + ch
          const seg = [
            { val: w.career,   color: CAT_COLORS.career },
            { val: w.health,   color: CAT_COLORS.health },
            { val: w.finance,  color: CAT_COLORS.finance },
            { val: w.creative, color: CAT_COLORS.creative },
          ]
          let curY = base
          const rects = seg.map((s, si) => {
            const h = toY(s.val)
            curY -= h
            return <rect key={si} x={bx} y={curY} width={barW} height={h} fill={s.color} rx={si === seg.length - 1 ? 4 : 0} />
          })
          return (
            <g key={i} onClick={e => { e.stopPropagation(); onBar(activeIdx === i ? null : i) }} style={{ cursor: 'pointer' }}>
              {activeIdx === i && (
                <rect x={bx - 3} y={PT} width={barW + 6} height={ch} fill="rgba(0,0,0,0.04)" rx="3" />
              )}
              {rects}
              <text x={bx + barW / 2} y={H - 6} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{w.short}</text>
            </g>
          )
        })}
      </svg>

      {activeIdx !== null && (
        <div style={{
          position: 'absolute',
          left: `${((getX(activeIdx) + barW / 2) / W) * 100}%`,
          top: '10%',
          transform: 'translate(-50%, 0)',
          background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8,
          padding: '6px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E', marginBottom: 2 }}>{weeks[activeIdx].short}</div>
          {(['career', 'health', 'finance', 'creative'] as const).map(k => (
            <div key={k} style={{ fontSize: 11, color: CAT_COLORS[k] }}>{k} : {(weeks[activeIdx] as unknown as Record<string, number>)[k]}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SVG Area Chart ───────────────────────────────────────────────────────────

function AreaChart({ weeks, activeIdx, onPoint }: {
  weeks: WeekData[]
  activeIdx: number | null
  onPoint: (i: number | null) => void
}) {
  const W = 320, H = 110, PL = 30, PR = 8, PT = 8, PB = 22
  const cw = W - PL - PR
  const ch = H - PT - PB

  const getX = (i: number) => PL + (i / (weeks.length - 1)) * cw
  const getY = (v: number) => PT + ch * (1 - v / 100)

  const pts = weeks.map((w, i) => ({ x: getX(i), y: getY(w.rate) }))
  const linePts = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaD = `${linePts} L ${pts[pts.length - 1].x.toFixed(1)} ${PT + ch} L ${pts[0].x.toFixed(1)} ${PT + ch} Z`

  const yLabels = [0, 20, 40, 60, 80]

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W) * 100}%`, height: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {yLabels.map(v => (
          <g key={v}>
            <line x1={PL} y1={getY(v)} x2={W - PR} y2={getY(v)} stroke="#EFEFF4" strokeWidth="1" strokeDasharray="3 2" />
            <text x={PL - 3} y={getY(v) + 3} textAnchor="end" fontSize="8" fill="#C7C7CC">{v}</text>
          </g>
        ))}

        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34C759" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34C759" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <path d={areaD} fill="url(#areaGrad)" />
        <path d={linePts} fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p, i) => (
          <g key={i} onClick={e => { e.stopPropagation(); onPoint(activeIdx === i ? null : i) }} style={{ cursor: 'pointer' }}>
            <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="4" fill={activeIdx === i ? '#34C759' : 'white'} stroke="#34C759" strokeWidth="2.5" />
            <text x={p.x} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{weeks[i].short}</text>
          </g>
        ))}
      </svg>

      {activeIdx !== null && (
        <div style={{
          position: 'absolute',
          left: `${(pts[activeIdx].x / W) * 100}%`,
          top: `${(pts[activeIdx].y / H) * 100}%`,
          transform: 'translate(-50%, -100%) translateY(-6px)',
          background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8,
          padding: '5px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{weeks[activeIdx].short}</div>
          <div style={{ fontSize: 12, color: '#34C759' }}>rate : {weeks[activeIdx].rate}%</div>
        </div>
      )}
    </div>
  )
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function Modal({ title, subtitle, onClose, children }: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: '24px 24px 0 0',
          width: '100%', maxWidth: 480,
          maxHeight: '90vh', overflowY: 'auto',
          padding: '24px 20px 40px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: '#8E8E93', margin: '3px 0 0' }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            style={{ background: '#F2F2F7', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 12 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Momentum Modal ───────────────────────────────────────────────────────────

function MomentumModal({ weeks, onClose }: { weeks: WeekData[]; onClose: () => void }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  return (
    <Modal title="Momentum Score Breakdown" subtitle="Detailed analysis and key performance indicators" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <LineChart weeks={weeks} activeIdx={activeIdx} onPoint={setActiveIdx} multiSeries />
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10, marginBottom: 16 }}>
          {[['#3B7DFF', 'Momentum Score'], ['#34C759', 'Tasks Completed'], ['#FF9500', 'Hours Worked']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="20" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke={color} strokeWidth="2" strokeDasharray="2 2" /><circle cx="17" cy="4" r="3" fill="white" stroke={color} strokeWidth="2" /></svg>
              <span style={{ fontSize: 11, color: '#3C3C43' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {weeks.map(w => (
            <div key={w.label} style={{ background: '#F8F8FC', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px' }}>{w.label}</p>
              <p style={{ fontSize: 12, color: '#3C3C43', margin: '0 0 2px' }}>Score: {w.score}</p>
              <p style={{ fontSize: 12, color: '#3C3C43', margin: '0 0 2px' }}>Completed: {w.completed}/{w.total} tasks</p>
              <p style={{ fontSize: 12, color: '#3C3C43', margin: '0 0 2px' }}>Hours: {w.hours}h</p>
              <p style={{ fontSize: 12, color: '#3C3C43', margin: 0 }}>Efficiency: {w.efficiency}%</p>
            </div>
          ))}
        </div>

        <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '14px 16px', border: '1px solid #DBEAFE' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', margin: '0 0 8px' }}>Key Insights</p>
          {[
            `Momentum increased by ${weeks[3].score - weeks[0].score}% from Week 1 to Week 4`,
            `Average completion rate: ${Math.round(weeks.reduce((s, w) => s + w.rate, 0) / weeks.length)}%`,
            `Peak performance: Week 4 (${weeks[3].rate}% completion)`,
            `Total hours invested: ${weeks.reduce((s, w) => s + w.hours, 0)} hours`,
          ].map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < 3 ? 6 : 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3B7DFF', marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 1.5 }}>{ins}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Category Modal ───────────────────────────────────────────────────────────

function CategoryModal({ cats, onClose }: { cats: CatData[]; weeks?: WeekData[]; onClose: () => void }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const W = 320, H = 160, PL = 28, PR = 8, PT = 8, PB = 36
  const cw = W - PL - PR
  const ch = H - PT - PB
  const n = cats.length
  const gapTotal = cw * 0.38
  const barW = (cw - gapTotal) / n
  const gapW = gapTotal / (n + 1)
  const getX = (i: number) => PL + gapW * (i + 1) + barW * i
  const getBarH = (v: number) => (v / 100) * ch
  const getBarY = (v: number) => PT + ch - getBarH(v)
  const taskMax = Math.max(...cats.map(c => c.tasks))
  const taskBarW = barW * 0.4
  const yLabels = [0, 20, 40, 60, 80]

  return (
    <Modal title="Category Performance Details" subtitle="Detailed analysis and key performance indicators" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        {/* Grouped bar chart: progress% + tasks */}
        <div style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W) * 100}%`, height: 0, marginBottom: 12 }}>
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
                <g key={i} onClick={e => { e.stopPropagation(); setActiveIdx(activeIdx === i ? null : i) }} style={{ cursor: 'pointer' }}>
                  <rect x={bx} y={getBarY(c.progress)} width={barW} height={getBarH(c.progress)} fill={activeIdx === i ? '#2D6AE8' : '#3B7DFF'} rx="3" />
                  <rect x={bx + barW - taskBarW} y={getBarY((c.tasks / taskMax) * 100)} width={taskBarW} height={getBarH((c.tasks / taskMax) * 100)} fill="#34C759" rx="2" />
                  <text x={bx + barW / 2} y={H - 18} textAnchor="middle" fontSize="8" fill="#8E8E93">{c.category}</text>
                </g>
              )
            })}
          </svg>
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          {[['#3B7DFF', 'Progress %'], ['#34C759', 'Tasks Completed']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 11, color: '#3C3C43' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {cats.map(c => (
            <div key={c.category} style={{ background: '#F8F8FC', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{c.category}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#3B7DFF' }}>{c.progress}%</span>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div><p style={{ fontSize: 11, color: '#8E8E93', margin: 0 }}>Hours</p><p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>{c.hours}h</p></div>
                <div><p style={{ fontSize: 11, color: '#8E8E93', margin: 0 }}>Tasks</p><p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>{c.tasks}</p></div>
                <div><p style={{ fontSize: 11, color: '#8E8E93', margin: 0 }}>Efficiency</p><p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>{c.efficiency}/h</p></div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#F5F3FF', borderRadius: 12, padding: '14px 16px', border: '1px solid #E9D5FF' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED', margin: '0 0 8px' }}>Recommendations</p>
          {[
            `${cats.sort((a, b) => b.progress - a.progress)[0].category} goals are performing best — consider doubling down`,
            `${cats.sort((a, b) => a.progress - b.progress)[0].category} projects need more time allocation`,
            'Career goals are balanced and on track',
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < 2 ? 6 : 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#7C3AED', marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#6D28D9', lineHeight: 1.5 }}>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Time Investment Modal ────────────────────────────────────────────────────

function TimeModal({ weeks, onClose }: { weeks: WeekData[]; onClose: () => void }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const totals = {
    career:   weeks.reduce((s, w) => s + w.career,   0),
    health:   weeks.reduce((s, w) => s + w.health,   0),
    finance:  weeks.reduce((s, w) => s + w.finance,  0),
    creative: weeks.reduce((s, w) => s + w.creative, 0),
  }
  const totalAll = Object.values(totals).reduce((s, v) => s + v, 0)

  const donutSize = 80
  const r = 28
  const cx = donutSize / 2
  const cy = donutSize / 2
  const circ = 2 * Math.PI * r
  let cumPct = 0
  const donutSegs = Object.entries(totals).map(([k, v]) => {
    const pct = totalAll > 0 ? v / totalAll : 0
    const dash = pct * circ
    const offset = cumPct * circ
    cumPct += pct
    return { key: k, dash, offset, color: CAT_COLORS[k] }
  })

  return (
    <Modal title="Time Investment Trends" subtitle="Detailed analysis and key performance indicators" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <StackedBarChart weeks={weeks} activeIdx={activeIdx} onBar={setActiveIdx} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, marginBottom: 16 }}>
          {Object.entries(CAT_COLORS).map(([k, color]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 11, color: '#3C3C43', textTransform: 'capitalize' }}>{k}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#F8F8FC', borderRadius: 12, padding: '14px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', margin: '0 0 10px' }}>Total Hours</p>
            {Object.entries(totals).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLORS[k], flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#3C3C43', textTransform: 'capitalize', flex: 1 }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{v}h</span>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, background: '#F8F8FC', borderRadius: 12, padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', margin: '0 0 10px', alignSelf: 'flex-start' }}>Distribution</p>
            <svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F2F2F7" strokeWidth="12" />
              {donutSegs.map(s => (
                <circle
                  key={s.key} cx={cx} cy={cy} r={r} fill="none"
                  stroke={s.color} strokeWidth="12"
                  strokeDasharray={`${s.dash} ${circ - s.dash}`}
                  strokeDashoffset={-s.offset + circ / 4}
                />
              ))}
            </svg>
          </div>
        </div>

        <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '14px 16px', border: '1px solid #BBF7D0' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D', margin: '0 0 8px' }}>Time Allocation Insights</p>
          {[
            `Career receives ${totalAll > 0 ? Math.round((totals.career / totalAll) * 100) : 35}% of total time (consistent)`,
            `Health time increased from W1 to W4`,
            'Creative time needs stabilization (fluctuates)',
            'Finance maintains minimum viable investment',
          ].map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < 3 ? 6 : 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16A34A', marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#15803D', lineHeight: 1.5 }}>{ins}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Completion Modal ─────────────────────────────────────────────────────────

function CompletionModal({ weeks, onClose }: { weeks: WeekData[]; onClose: () => void }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  return (
    <Modal title="Completion Rate Analysis" subtitle="Detailed analysis and key performance indicators" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <AreaChart weeks={weeks} activeIdx={activeIdx} onPoint={setActiveIdx} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 16, alignItems: 'center' }}>
          <svg width="20" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke="#34C759" strokeWidth="2" strokeDasharray="2 2" /><circle cx="17" cy="4" r="3" fill="white" stroke="#34C759" strokeWidth="2" /></svg>
          <span style={{ fontSize: 11, color: '#3C3C43' }}>Actual Rate</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {weeks.map(w => (
            <div key={w.short} style={{ background: '#F8F8FC', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#8E8E93', margin: '0 0 4px' }}>{w.short}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E', margin: '0 0 4px', lineHeight: 1 }}>{w.rate}%</p>
              <p style={{ fontSize: 10, color: w.rate >= 80 ? '#16A34A' : '#8E8E93', margin: 0 }}>
                {w.rate >= 80 ? '✓ On target' : 'Below target'}
              </p>
            </div>
          ))}
        </div>

        <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '14px 16px', border: '1px solid #BBF7D0', marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D', margin: '0 0 8px' }}>Strengths</p>
          {[
            `Week 4 hit ${weeks[3].rate}% target (peak execution)`,
            `Average completion rate: ${Math.round(weeks.reduce((s, w) => s + w.rate, 0) / weeks.length)}% (good baseline)`,
            'Upward trend from Week 3 to Week 4',
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < 2 ? 6 : 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16A34A', marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#15803D', lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '14px 16px', border: '1px solid #FDE68A' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: '0 0 8px' }}>Areas to Improve</p>
          {[
            `Week 3 dip to ${weeks[2].rate}% needs investigation`,
            'Consistency below target weeks 1–3',
            'Consider reducing planned tasks if repeatedly below 75%',
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < 2 ? 6 : 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D97706', marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [weeklyData, setWeeklyData] = useState<WeekData[]>(BASE_WEEKS)
  const [catData, setCatData] = useState<CatData[]>(BASE_CATS)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [timePeriod, setTimePeriod] = useState('This Month')
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Per-chart tooltip state
  const [momentumActive, setMomentumActive] = useState<number | null>(null)
  const [catActive, setCatActive] = useState<number | null>(null)
  const [timeActive, setTimeActive] = useState<number | null>(null)
  const [completionActive, setCompletionActive] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    const weeks = buildWeeklyData()
    setWeeklyData(weeks)

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('goals').select('id,text,category,status,progress').eq('user_id', user.id)
      const goalList = data || []
      setGoals(goalList)
      setCatData(buildCatData(goalList))
      setLoading(false)
    }
    load()
  }, [])

  if (!mounted) return null

  const activeGoals = goals.filter(g => g.status === 'active')
  const weekStreak = 4

  const wins = ['Portfolio site live', '3 runs completed', 'Budget on track']
  const needsFocus = ['Blog post delayed', 'Creative time low']

  const periods = ['This Week', 'This Month', 'This Quarter', 'This Year']

  const currentWeek = weeklyData[3]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div
      style={{ padding: '56px 16px 16px' }}
      onClick={() => {
        setMomentumActive(null)
        setCatActive(null)
        setTimeActive(null)
        setCompletionActive(null)
        setShowPeriodMenu(false)
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Progress</h1>
          <p style={{ fontSize: 14, color: '#8E8E93', marginTop: 3, marginBottom: 0 }}>Track your momentum</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/progress/community')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#7C3AED', border: 'none', borderRadius: 20,
            padding: '9px 16px', color: 'white', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          Community
        </button>
      </div>

      {/* Time period selector */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <button
          onClick={e => { e.stopPropagation(); setShowPeriodMenu(v => !v) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 20,
            padding: '8px 16px', fontSize: 14, fontWeight: 500, color: '#1C1C1E',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {timePeriod}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        {showPeriodMenu && (
          <div style={{
            position: 'absolute', top: '110%', left: 0,
            background: 'white', borderRadius: 12, border: '0.5px solid #E5E5EA',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', minWidth: 160,
          }}>
            {periods.map(p => (
              <button
                key={p}
                onClick={e => { e.stopPropagation(); setTimePeriod(p); setShowPeriodMenu(false) }}
                style={{
                  width: '100%', padding: '12px 16px', textAlign: 'left',
                  background: p === timePeriod ? '#F8F8FC' : 'none',
                  border: 'none', fontSize: 14, fontWeight: p === timePeriod ? 600 : 400,
                  color: p === timePeriod ? '#3B7DFF' : '#1C1C1E', cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: '0.5px solid #F2F2F7',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {[
          { icon: '🎯', label: 'Active Goals', value: activeGoals.length || 4, bg: '#EFF6FF', iconBg: '#DBEAFE' },
          { icon: '🔥', label: 'Week Streak', value: weekStreak, bg: '#FFFBEB', iconBg: '#FDE68A' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: 16, padding: '16px', border: '0.5px solid #E5E5EA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {s.icon}
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: '#1C1C1E', margin: 0, lineHeight: 1.1 }}>{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Momentum Score */}
      <div style={{ background: 'white', borderRadius: 20, padding: '18px 18px 14px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Momentum Score</h2>
          <button
            onClick={e => { e.stopPropagation(); setActiveModal('momentum') }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /></svg>
            <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>+{currentWeek.score - weeklyData[2].score}% this week</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div onClick={e => e.stopPropagation()}>
          <LineChart weeks={weeklyData} activeIdx={momentumActive} onPoint={setMomentumActive} />
        </div>

        <button
          onClick={() => setActiveModal('momentum')}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', paddingTop: 10, textDecoration: 'underline' }}
        >
          Click to view detailed breakdown
        </button>
      </div>

      {/* Progress by Category */}
      <div style={{ background: 'white', borderRadius: 20, padding: '18px 18px 14px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Progress by Category</h2>
          <button onClick={() => setActiveModal('category')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div onClick={e => e.stopPropagation()}>
          <BarChart cats={catData} activeIdx={catActive} onBar={setCatActive} />
        </div>

        <button
          onClick={() => setActiveModal('category')}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', paddingTop: 8, textDecoration: 'underline' }}
        >
          Click to see hours invested and tasks completed
        </button>
      </div>

      {/* Time Investment */}
      <div style={{ background: 'white', borderRadius: 20, padding: '18px 18px 14px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Time Investment (Hours)</h2>
          <button onClick={() => setActiveModal('time')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div onClick={e => e.stopPropagation()}>
          <StackedBarChart weeks={weeklyData} activeIdx={timeActive} onBar={setTimeActive} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {Object.entries(CAT_COLORS).map(([k, color]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 11, color: '#3C3C43', textTransform: 'capitalize' }}>{k}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setActiveModal('time')}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', paddingTop: 8, textDecoration: 'underline' }}
        >
          Click to analyze time allocation patterns
        </button>
      </div>

      {/* Weekly Completion Rate */}
      <div style={{ background: 'white', borderRadius: 20, padding: '18px 18px 14px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Weekly Completion Rate</h2>
          <button onClick={() => setActiveModal('completion')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div onClick={e => e.stopPropagation()}>
          <AreaChart weeks={weeklyData} activeIdx={completionActive} onPoint={setCompletionActive} />
        </div>

        <button
          onClick={() => setActiveModal('completion')}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', paddingTop: 8, textDecoration: 'underline' }}
        >
          Click for detailed completion metrics
        </button>
      </div>

      {/* Goal Progress */}
      <div style={{ background: 'white', borderRadius: 20, padding: '18px 18px 16px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Goal Progress</h2>
          <button
            onClick={() => router.push('/dashboard/goals')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#3B7DFF', fontFamily: 'inherit', padding: 0 }}
          >
            View All
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(activeGoals.length > 0 ? activeGoals.slice(0, 5) : [
            { id: '1', text: 'Launch personal brand as design consultant', category: 'Career',   status: 'active', progress: 45 },
            { id: '2', text: 'Save $15k emergency fund',                    category: 'Finance',  status: 'active', progress: 60 },
            { id: '3', text: 'Run 3 times per week consistently',            category: 'Health',   status: 'active', progress: 70 },
            { id: '4', text: 'Finish short story collection',                category: 'Creative', status: 'active', progress: 30 },
          ]).map(goal => (
            <button
              key={goal.id}
              onClick={() => router.push(`/dashboard/goals/${goal.id}`)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', width: '100%' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0, flex: 1, paddingRight: 8 }}>{goal.text}</p>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', flexShrink: 0 }}>{goal.progress}%</span>
              </div>
              <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${goal.progress}%`, background: '#3B7DFF', borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* This Week */}
      <div style={{ background: 'white', borderRadius: 20, padding: '18px 18px 16px', marginBottom: 14, border: '0.5px solid #E5E5EA' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px' }}>This Week</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D', margin: '0 0 8px' }}>Wins</p>
            {wins.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: i < wins.length - 1 ? 5 : 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16A34A', marginTop: 5, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#15803D', lineHeight: 1.4 }}>{w}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: '0 0 8px' }}>Needs Focus</p>
            {needsFocus.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: i < needsFocus.length - 1 ? 5 : 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D97706', marginTop: 5, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <button
        onClick={() => router.push('/dashboard/check-in/weekly')}
        style={{
          width: '100%', padding: '15px', borderRadius: 14, marginBottom: 10,
          background: '#1C1C1E', border: 'none', color: 'white',
          fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Run Check-In
      </button>
      <button
        onClick={() => router.push('/dashboard/progress/report')}
        style={{
          width: '100%', padding: '14px', borderRadius: 14,
          background: 'white', border: '1.5px solid #E5E5EA', color: '#1C1C1E',
          fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Export Report
      </button>

      {/* Modals */}
      {activeModal === 'momentum'   && <MomentumModal   weeks={weeklyData} onClose={() => setActiveModal(null)} />}
      {activeModal === 'category'   && <CategoryModal   cats={catData} weeks={weeklyData} onClose={() => setActiveModal(null)} />}
      {activeModal === 'time'       && <TimeModal        weeks={weeklyData} onClose={() => setActiveModal(null)} />}
      {activeModal === 'completion' && <CompletionModal  weeks={weeklyData} onClose={() => setActiveModal(null)} />}
    </div>
  )
}
