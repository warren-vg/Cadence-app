'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMonday, addDays, getTasksForWeek } from '@/lib/planData'

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

// ─── Base / seed data ─────────────────────────────────────────────────────────

const BASE_WEEKS: WeekData[] = [
  { label: 'Week 1', short: 'W1', score: 65, completed: 8,  total: 12, hours: 18, rate: 67, efficiency: 67, career: 6, health: 5, finance: 4, creative: 3 },
  { label: 'Week 2', short: 'W2', score: 72, completed: 10, total: 13, hours: 21, rate: 77, efficiency: 77, career: 8, health: 5, finance: 4, creative: 4 },
  { label: 'Week 3', short: 'W3', score: 68, completed: 9,  total: 14, hours: 19, rate: 64, efficiency: 64, career: 7, health: 4, finance: 3, creative: 5 },
  { label: 'Week 4', short: 'W4', score: 78, completed: 12, total: 15, hours: 24, rate: 80, efficiency: 80, career: 8, health: 6, finance: 4, creative: 6 },
]

const BASE_CATS: CatData[] = [
  { category: 'Career',   progress: 45, hours: 8,  tasks: 12, efficiency: 1.5 },
  { category: 'Finance',  progress: 60, hours: 4,  tasks: 8,  efficiency: 2.0 },
  { category: 'Health',   progress: 70, hours: 6,  tasks: 10, efficiency: 1.7 },
  { category: 'Creative', progress: 30, hours: 5,  tasks: 7,  efficiency: 1.4 },
]

// ─── Per-period data sets ─────────────────────────────────────────────────────

const PERIOD_WEEKLY: Record<string, WeekData[]> = {
  'This Week': [
    { label: 'Mon', short: 'Mon', score: 55, completed: 3, total: 5, hours: 4,   rate: 60,  efficiency: 60,  career: 1.5, health: 1,   finance: 0.5, creative: 1   },
    { label: 'Tue', short: 'Tue', score: 72, completed: 4, total: 5, hours: 5,   rate: 80,  efficiency: 80,  career: 2,   health: 1.5, finance: 0.5, creative: 1   },
    { label: 'Wed', short: 'Wed', score: 65, completed: 3, total: 5, hours: 4.5, rate: 60,  efficiency: 60,  career: 2,   health: 1,   finance: 0.5, creative: 1   },
    { label: 'Thu', short: 'Thu', score: 80, completed: 5, total: 5, hours: 5.5, rate: 100, efficiency: 100, career: 2.5, health: 1.5, finance: 0.5, creative: 1   },
  ],
  'This Month': BASE_WEEKS,
  'This Quarter': [
    { label: 'Month 1', short: 'M1', score: 62, completed: 30, total: 48, hours: 72, rate: 63, efficiency: 63, career: 24, health: 19, finance: 14, creative: 15 },
    { label: 'Month 2', short: 'M2', score: 69, completed: 35, total: 51, hours: 80, rate: 69, efficiency: 69, career: 27, health: 22, finance: 15, creative: 16 },
    { label: 'Month 3', short: 'M3', score: 74, completed: 38, total: 52, hours: 85, rate: 73, efficiency: 73, career: 29, health: 24, finance: 16, creative: 16 },
    { label: 'Month 4', short: 'M4', score: 78, completed: 42, total: 54, hours: 90, rate: 78, efficiency: 78, career: 30, health: 25, finance: 17, creative: 18 },
  ],
  'This Year': [
    { label: 'Q1', short: 'Q1', score: 58, completed: 95,  total: 160, hours: 280, rate: 59, efficiency: 59, career: 90,  health: 80, finance: 55, creative: 55 },
    { label: 'Q2', short: 'Q2', score: 67, completed: 110, total: 165, hours: 310, rate: 67, efficiency: 67, career: 100, health: 85, finance: 60, creative: 65 },
    { label: 'Q3', short: 'Q3', score: 64, completed: 105, total: 163, hours: 295, rate: 64, efficiency: 64, career: 95,  health: 82, finance: 58, creative: 60 },
    { label: 'Q4', short: 'Q4', score: 75, completed: 125, total: 168, hours: 330, rate: 74, efficiency: 74, career: 110, health: 90, finance: 65, creative: 65 },
  ],
}

const PERIOD_CATS: Record<string, CatData[]> = {
  'This Week': [
    { category: 'Career',   progress: 45, hours: 2,   tasks: 3,   efficiency: 1.5 },
    { category: 'Finance',  progress: 60, hours: 1,   tasks: 2,   efficiency: 2.0 },
    { category: 'Health',   progress: 70, hours: 1.5, tasks: 3,   efficiency: 2.0 },
    { category: 'Creative', progress: 30, hours: 1,   tasks: 1,   efficiency: 1.0 },
  ],
  'This Month': BASE_CATS,
  'This Quarter': [
    { category: 'Career',   progress: 45, hours: 29, tasks: 35,  efficiency: 1.2 },
    { category: 'Finance',  progress: 60, hours: 15, tasks: 25,  efficiency: 1.7 },
    { category: 'Health',   progress: 70, hours: 22, tasks: 38,  efficiency: 1.7 },
    { category: 'Creative', progress: 30, hours: 16, tasks: 22,  efficiency: 1.4 },
  ],
  'This Year': [
    { category: 'Career',   progress: 45, hours: 110, tasks: 140, efficiency: 1.3 },
    { category: 'Finance',  progress: 60, hours: 58,  tasks: 95,  efficiency: 1.6 },
    { category: 'Health',   progress: 70, hours: 82,  tasks: 148, efficiency: 1.8 },
    { category: 'Creative', progress: 30, hours: 60,  tasks: 85,  efficiency: 1.4 },
  ],
}

const PERIOD_INSIGHTS: Record<string, { wins: string[]; focus: string[] }> = {
  'This Week': {
    wins:  ['Portfolio site live', '3 runs completed', 'Budget on track'],
    focus: ['Blog post delayed', 'Creative time low'],
  },
  'This Month': {
    wins:  ['Monthly targets exceeded', '4-week running streak', 'Savings milestone hit'],
    focus: ['Creative project behind schedule', 'Networking goals need attention'],
  },
  'This Quarter': {
    wins:  ['Portfolio launched successfully', 'Health goal on track', '60% to finance goal'],
    focus: ['Creative writing needs consistency', 'Career goals need a final push'],
  },
  'This Year': {
    wins:  ['Strongest health year yet', 'Career momentum building', 'Savings discipline maintained'],
    focus: ['Creative goals historically underserved', 'Better category balance needed'],
  },
}

// ─── Chart colors ─────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  career:   '#3B7DFF',
  health:   '#34C759',
  finance:  '#FF9500',
  creative: '#9333EA',
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function buildWeeklyData(): WeekData[] {
  try {
    const today  = new Date()
    const monday = getMonday(today)
    const tasks  = getTasksForWeek(monday)
    if (!tasks.length) return BASE_WEEKS

    const completed  = tasks.filter(t => t.completed).length
    const total      = tasks.length
    const hours      = parseFloat(tasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
    const rate       = total > 0 ? Math.round((completed / total) * 100) : 0
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

function getPeriodLabel(period: string): string {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  if (period === 'This Week') {
    const monday = getMonday(now)
    const sunday = addDays(monday, 6)
    const m1 = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const m2 = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${m1} – ${m2}`
  }
  if (period === 'This Month')   return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  if (period === 'This Quarter') return `Q${Math.floor(month / 3) + 1} ${year}`
  if (period === 'This Year')    return `${year}`
  return ''
}

function getTrendText(weeks: WeekData[], period: string): { pct: number; label: string } {
  if (weeks.length < 2) return { pct: 0, label: '' }
  const diff = weeks[weeks.length - 1].score - weeks[weeks.length - 2].score
  const labels: Record<string, string> = {
    'This Week':    'vs yesterday',
    'This Month':   'this week',
    'This Quarter': 'this month',
    'This Year':    'this quarter',
  }
  return { pct: diff, label: labels[period] || '' }
}

function getInsightTitle(period: string): string {
  const map: Record<string, string> = {
    'This Week':    "This Week's Insights",
    'This Month':   "This Month's Insights",
    'This Quarter': "This Quarter's Insights",
    'This Year':    "This Year's Insights",
  }
  return map[period] || "Insights"
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ title, subtitle, onClose, children }: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: '24px 20px 40px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
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

// ─── Reusable SVG charts (modal variants) ─────────────────────────────────────

function ModalLineChart({ weeks, multiSeries }: { weeks: WeekData[]; multiSeries?: boolean }) {
  const W = 320, H = 130, PL = 30, PR = 8, PT = 10, PB = 22
  const cw = W - PL - PR, ch = H - PT - PB
  const getX = (i: number) => PL + (i / (weeks.length - 1)) * cw
  const getY = (v: number, max = 100) => PT + ch * (1 - Math.min(v, max) / max)
  const yLabels = [0, 20, 40, 60, 80]
  const mainD  = weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(w.score).toFixed(1)}`).join(' ')
  const taskD  = multiSeries ? weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(w.completed, 30).toFixed(1)}`).join(' ') : ''
  const hourD  = multiSeries ? weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(w.hours, 30).toFixed(1)}`).join(' ') : ''

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W) * 100}%`, height: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {yLabels.map(v => (
          <g key={v}>
            <line x1={PL} y1={getY(v)} x2={W - PR} y2={getY(v)} stroke="#EFEFF4" strokeWidth="1" strokeDasharray="3 2" />
            <text x={PL - 3} y={getY(v) + 3} textAnchor="end" fontSize="8" fill="#C7C7CC">{v}</text>
          </g>
        ))}
        {multiSeries && taskD && <path d={taskD} fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        {multiSeries && hourD && <path d={hourD} fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        <path d={mainD} fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {weeks.map((w, i) => (
          <g key={i}>
            <circle cx={getX(i)} cy={getY(w.score)} r="4.5" fill="white" stroke="#3B7DFF" strokeWidth="2.5" />
            <text x={getX(i)} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{w.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ModalAreaChart({ weeks }: { weeks: WeekData[] }) {
  const W = 320, H = 130, PL = 30, PR = 8, PT = 10, PB = 22
  const cw = W - PL - PR, ch = H - PT - PB
  const getX = (i: number) => PL + (i / (weeks.length - 1)) * cw
  const getY = (v: number) => PT + ch * (1 - v / 100)
  const linePts = weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(w.rate).toFixed(1)}`).join(' ')
  const areaD  = `${linePts} L${getX(weeks.length - 1).toFixed(1)},${PT + ch} L${getX(0).toFixed(1)},${PT + ch} Z`
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
          <linearGradient id="mgAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34C759" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34C759" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#mgAreaGrad)" />
        <path d={linePts} fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {weeks.map((w, i) => (
          <g key={i}>
            <circle cx={getX(i)} cy={getY(w.rate)} r="4.5" fill="white" stroke="#34C759" strokeWidth="2.5" />
            <text x={getX(i)} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{w.short}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ModalStackedBarChart({ weeks }: { weeks: WeekData[] }) {
  const W = 320, H = 130, PL = 28, PR = 8, PT = 10, PB = 24
  const cw = W - PL - PR, ch = H - PT - PB
  const maxH = Math.max(...weeks.map(w => w.career + w.health + w.finance + w.creative), 1)
  const n = weeks.length
  const gapW = (cw * 0.38) / (n + 1)
  const barW = (cw - gapW * (n + 1)) / n
  const getX = (i: number) => PL + gapW * (i + 1) + barW * i
  const toH  = (v: number) => (v / maxH) * ch
  const yMax = Math.ceil(maxH / 6) * 6
  const yLabels = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i))

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W) * 100}%`, height: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {yLabels.map(v => (
          <g key={v}>
            <line x1={PL} y1={PT + ch - toH(v)} x2={W - PR} y2={PT + ch - toH(v)} stroke="#EFEFF4" strokeWidth="1" strokeDasharray="3 2" />
            <text x={PL - 3} y={PT + ch - toH(v) + 3} textAnchor="end" fontSize="8" fill="#C7C7CC">{v}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const bx = getX(i)
          let curY = PT + ch
          return (
            <g key={i}>
              {([['career', w.career], ['health', w.health], ['finance', w.finance], ['creative', w.creative]] as [string, number][]).map(([k, v]) => {
                const h = toH(v)
                curY -= h
                return <rect key={k} x={bx} y={curY} width={barW} height={h} fill={CAT_COLORS[k]} />
              })}
              <text x={bx + barW / 2} y={H - 6} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{w.short}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Momentum Modal ───────────────────────────────────────────────────────────

function MomentumModal({ weeks, onClose }: { weeks: WeekData[]; onClose: () => void }) {
  return (
    <Modal title="Momentum Score Breakdown" subtitle="Detailed analysis and key performance indicators" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <ModalLineChart weeks={weeks} multiSeries />
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 10, marginBottom: 16 }}>
          {[['#3B7DFF', 'Momentum Score'], ['#34C759', 'Tasks Completed'], ['#FF9500', 'Hours Worked']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="18" height="8"><line x1="0" y1="4" x2="12" y2="4" stroke={color} strokeWidth="2" strokeDasharray="2 2" /><circle cx="16" cy="4" r="3" fill="white" stroke={color} strokeWidth="2" /></svg>
              <span style={{ fontSize: 10, color: '#3C3C43' }}>{label}</span>
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
            `Momentum increased by ${weeks[weeks.length - 1].score - weeks[0].score}% across this period`,
            `Average completion rate: ${Math.round(weeks.reduce((s, w) => s + w.rate, 0) / weeks.length)}%`,
            `Peak performance: ${weeks.reduce((best, w) => w.score > best.score ? w : best, weeks[0]).label}`,
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

function CategoryModal({ cats, onClose }: { cats: CatData[]; onClose: () => void }) {
  const W = 320, H = 160, PL = 28, PR = 8, PT = 16, PB = 36
  const cw = W - PL - PR, ch = H - PT - PB
  const n = cats.length
  const gapW = (cw * 0.38) / (n + 1)
  const barW = (cw - gapW * (n + 1)) / n
  const getX = (i: number) => PL + gapW * (i + 1) + barW * i
  const getBarH = (v: number) => (Math.min(v, 100) / 100) * ch
  const getBarY = (v: number) => PT + ch - getBarH(v)
  const taskMax = Math.max(...cats.map(c => c.tasks), 1)
  const taskBarW = barW * 0.35
  const yLabels = [0, 20, 40, 60, 80]

  return (
    <Modal title="Category Performance Details" subtitle="Detailed analysis and key performance indicators" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <div style={{ position: 'relative', width: '100%', paddingBottom: `${(H / W) * 100}%`, height: 0, marginBottom: 10 }}>
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
                  <rect x={bx} y={getBarY(c.progress)} width={barW} height={getBarH(c.progress)} fill="#3B7DFF" rx="3" />
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
            `${[...cats].sort((a, b) => b.progress - a.progress)[0].category} goals are performing best — consider doubling down`,
            `${[...cats].sort((a, b) => a.progress - b.progress)[0].category} projects need more time allocation`,
            'Maintain balance across all categories for sustained momentum',
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
  const totals = { career: weeks.reduce((s, w) => s + w.career, 0), health: weeks.reduce((s, w) => s + w.health, 0), finance: weeks.reduce((s, w) => s + w.finance, 0), creative: weeks.reduce((s, w) => s + w.creative, 0) }
  const totalAll = Object.values(totals).reduce((s, v) => s + v, 0)
  const donutSize = 80, r = 28, cx = 40, cy = 40, circ = 2 * Math.PI * r
  let cumPct = 0
  const donutSegs = Object.entries(totals).map(([k, v]) => {
    const pct = totalAll > 0 ? v / totalAll : 0
    const dash = pct * circ, offset = cumPct * circ
    cumPct += pct
    return { key: k, dash, offset, color: CAT_COLORS[k] }
  })
  return (
    <Modal title="Time Investment Trends" subtitle="Detailed analysis and key performance indicators" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <ModalStackedBarChart weeks={weeks} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, marginBottom: 16 }}>
          {Object.entries(CAT_COLORS).map(([k, color]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 11, color: '#3C3C43', textTransform: 'capitalize' }}>{k.charAt(0).toUpperCase() + k.slice(1)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#F8F8FC', borderRadius: 12, padding: '14px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', margin: '0 0 10px' }}>Total Hours</p>
            {Object.entries(totals).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLORS[k], flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#3C3C43', textTransform: 'capitalize', flex: 1 }}>{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{v}h</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, background: '#F8F8FC', borderRadius: 12, padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', margin: '0 0 10px', alignSelf: 'flex-start' }}>Distribution</p>
            <svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F2F2F7" strokeWidth="12" />
              {donutSegs.map(s => (
                <circle key={s.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${s.dash} ${circ - s.dash}`} strokeDashoffset={-s.offset + circ / 4} />
              ))}
            </svg>
          </div>
        </div>
        <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '14px 16px', border: '1px solid #BBF7D0' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D', margin: '0 0 8px' }}>Time Allocation Insights</p>
          {[
            `Career receives ${totalAll > 0 ? Math.round((totals.career / totalAll) * 100) : 35}% of total time`,
            'Health time trending upward — keep the momentum',
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
  const avgRate = Math.round(weeks.reduce((s, w) => s + w.rate, 0) / weeks.length)
  return (
    <Modal title="Completion Rate Analysis" subtitle="Detailed analysis and key performance indicators" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <ModalAreaChart weeks={weeks} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 16, alignItems: 'center' }}>
          <svg width="18" height="8"><line x1="0" y1="4" x2="12" y2="4" stroke="#34C759" strokeWidth="2" strokeDasharray="2 2" /><circle cx="16" cy="4" r="3" fill="white" stroke="#34C759" strokeWidth="2" /></svg>
          <span style={{ fontSize: 11, color: '#3C3C43' }}>Actual Rate</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: 8, marginBottom: 16 }}>
          {weeks.map(w => (
            <div key={w.short} style={{ background: '#F8F8FC', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#8E8E93', margin: '0 0 4px' }}>{w.short}</p>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E', margin: '0 0 4px', lineHeight: 1 }}>{w.rate}%</p>
              <p style={{ fontSize: 10, color: w.rate >= 80 ? '#16A34A' : '#8E8E93', margin: 0 }}>{w.rate >= 80 ? '✓ On target' : 'Below target'}</p>
            </div>
          ))}
        </div>
        <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '14px 16px', border: '1px solid #BBF7D0', marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D', margin: '0 0 8px' }}>Strengths</p>
          {[
            `Peak at ${weeks.reduce((b, w) => w.rate > b.rate ? w : b, weeks[0]).rate}% (${weeks.reduce((b, w) => w.rate > b.rate ? w : b, weeks[0]).label})`,
            `Average completion rate: ${avgRate}% (${avgRate >= 70 ? 'strong' : 'building'} baseline)`,
            `${weeks.filter(w => w.rate >= 80).length > 0 ? 'Upward trend visible at peak performance' : 'Consistent effort across the period'}`,
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
            `${weeks.reduce((b, w) => w.rate < b.rate ? w : b, weeks[0]).label} dip to ${weeks.reduce((b, w) => w.rate < b.rate ? w : b, weeks[0]).rate}% needs investigation`,
            avgRate < 80 ? `Consistency below 80% target — plan fewer, higher-priority tasks` : 'Maintain this strong completion rate going forward',
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < 1 ? 6 : 0 }}>
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
  const [goals, setGoals]         = useState<Goal[]>([])
  const [baseCatData, setBaseCatData] = useState<CatData[]>(BASE_CATS)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [timePeriod, setTimePeriod]   = useState('This Month')
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [mounted, setMounted]   = useState(false)
  const [monthlyWeeks, setMonthlyWeeks] = useState<WeekData[]>(BASE_WEEKS)

  // Per-chart tooltip indices
  const [momentumActive, setMomentumActive]     = useState<number | null>(null)
  const [catActive, setCatActive]               = useState<number | null>(null)
  const [timeActive, setTimeActive]             = useState<number | null>(null)
  const [completionActive, setCompletionActive] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    const realMonthWeeks = buildWeeklyData()
    setMonthlyWeeks(realMonthWeeks)

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('goals').select('id,text,category,status,progress').eq('user_id', user.id)
      const goalList = data || []
      setGoals(goalList)
      setBaseCatData(buildCatData(goalList))
      setLoading(false)
    }
    load()
  }, [])

  // Reset tooltips when period changes
  useEffect(() => {
    setMomentumActive(null)
    setCatActive(null)
    setTimeActive(null)
    setCompletionActive(null)
  }, [timePeriod])

  if (!mounted) return null

  // Compute display data for the selected period
  const displayWeeks = timePeriod === 'This Month'
    ? monthlyWeeks
    : (PERIOD_WEEKLY[timePeriod] || BASE_WEEKS)

  // Merge actual goal progress into period cat data
  const periodCatsBase = PERIOD_CATS[timePeriod] || BASE_CATS
  const displayCats = periodCatsBase.map(pc => {
    const actual = baseCatData.find(c => c.category === pc.category)
    return { ...pc, progress: actual?.progress ?? pc.progress }
  })

  const insights    = PERIOD_INSIGHTS[timePeriod] || PERIOD_INSIGHTS['This Month']
  const periodLabel = getPeriodLabel(timePeriod)
  const trend       = getTrendText(displayWeeks, timePeriod)
  const activeGoals = goals.filter(g => g.status === 'active')
  const weekStreak  = 4

  // SVG line chart dimensions (inline — same for both Momentum and Completion)
  const W = 300, H = 120, PAD = 20
  const getX = (i: number) => PAD + (i / (displayWeeks.length - 1)) * (W - PAD * 2)

  // Momentum chart
  const getScoreY = (v: number) => H - PAD - ((v / 100) * (H - PAD * 2))
  const momentumPath = displayWeeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${getX(i)},${getScoreY(w.score)}`).join(' ')
  const momentumArea = `${momentumPath} L${getX(displayWeeks.length - 1)},${H - PAD} L${getX(0)},${H - PAD} Z`

  // Stacked bar chart
  const SBW = 280, SBH = 130, SBPAD = 20
  const maxHours   = Math.max(...displayWeeks.map(w => w.career + w.health + w.finance + w.creative), 1)
  const sbBarW     = Math.min(36, (SBW - SBPAD * 2) / displayWeeks.length - 8)
  const sbGap      = ((SBW - SBPAD * 2) - sbBarW * displayWeeks.length) / (displayWeeks.length + 1)
  const getSBX     = (i: number) => SBPAD + sbGap * (i + 1) + sbBarW * i
  const toSBH      = (v: number) => (v / maxHours) * (SBH - SBPAD * 2)
  const getSBY     = (v: number) => SBH - SBPAD - toSBH(v)
  const sbYLabels  = Array.from({ length: 5 }, (_, i) => Math.round((Math.ceil(maxHours / 6) * 6 / 4) * i))

  // Completion chart
  const compW = 280, compH = 80
  const getCompX = (i: number) => 16 + (i / (displayWeeks.length - 1)) * (compW - 32)
  const getCompY = (v: number) => compH - Math.round((v / 100) * (compH - 10))
  const compPath  = displayWeeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${getCompX(i)},${getCompY(w.rate)}`).join(' ')
  const compArea  = `${compPath} L${getCompX(displayWeeks.length - 1)},${compH} L${getCompX(0)},${compH} Z`

  // Category bar chart (fixed — all bars blue, proper bounds)
  const CBW = 280, CBH = 110, CBPL = 4, CBPR = 4, CBPT = 14, CBPB = 22
  const cbCW = CBW - CBPL - CBPR, cbCH = CBH - CBPT - CBPB
  const cbGapTotal = cbCW * 0.38
  const cbBarW = (cbCW - cbGapTotal) / displayCats.length
  const cbGapW = cbGapTotal / (displayCats.length + 1)
  const getCBX  = (i: number) => CBPL + cbGapW * (i + 1) + cbBarW * i
  const getCBBarH = (v: number) => (Math.min(v, 100) / 100) * cbCH
  const getCBBarY = (v: number) => CBPT + cbCH - getCBBarH(v)
  const cbYLabels = [0, 20, 40, 60, 80]

  const periods = ['This Week', 'This Month', 'This Quarter', 'This Year']

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div
      style={{ padding: '56px 16px 100px' }}
      onClick={() => { setMomentumActive(null); setCatActive(null); setTimeActive(null); setCompletionActive(null); setShowPeriodMenu(false) }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Progress</h1>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>Track your momentum</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/progress/community')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
            border: 'none', borderRadius: 22,
            padding: '9px 16px', color: 'white', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 0 18px rgba(124,58,237,0.50), 0 4px 12px rgba(109,40,217,0.35)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          Community
        </button>
      </div>

      {/* ── Stats row (Active Goals + Week Streak only) ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {[
          { icon: '🎯', label: 'Active Goals', value: activeGoals.length || 4, iconBg: '#DBEAFE' },
          { icon: '🔥', label: 'Week Streak',  value: weekStreak,               iconBg: '#FDE68A' },
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

      {/* ── Period selector with date label ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {showPeriodMenu && (
            <div
              style={{ position: 'absolute', top: '110%', left: 0, background: 'white', borderRadius: 12, border: '0.5px solid #E5E5EA', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', minWidth: 160 }}
              onClick={e => e.stopPropagation()}
            >
              {periods.map(p => (
                <button
                  key={p}
                  onClick={() => { setTimePeriod(p); setShowPeriodMenu(false) }}
                  style={{ width: '100%', padding: '11px 16px', textAlign: 'left', background: p === timePeriod ? '#F8F8FC' : 'none', border: 'none', fontSize: 14, fontWeight: p === timePeriod ? 600 : 400, color: p === timePeriod ? '#3B7DFF' : '#1C1C1E', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '0.5px solid #F2F2F7' }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
        {periodLabel && (
          <span style={{ fontSize: 13, color: '#8E8E93', fontWeight: 400 }}>{periodLabel}</span>
        )}
      </div>

      {/* ── Momentum Score ───────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 18, padding: '16px 18px 14px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Momentum Score</h2>
          <button onClick={() => setActiveModal('momentum')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /></svg>
            <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>{trend.pct >= 0 ? '+' : ''}{trend.pct}% {trend.label}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: 'visible' }}
          onClick={e => { e.stopPropagation(); setActiveModal('momentum') }}
        >
          <defs>
            <linearGradient id="momGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B7DFF" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#3B7DFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Y-axis grid */}
          {[0, 20, 40, 60, 80].map(v => (
            <g key={v}>
              <line x1={PAD} y1={getScoreY(v)} x2={W - PAD} y2={getScoreY(v)} stroke="#F0F0F5" strokeWidth="1" strokeDasharray="3 2" />
              <text x={PAD - 3} y={getScoreY(v) + 3} textAnchor="end" fontSize="8" fill="#C7C7CC">{v}</text>
            </g>
          ))}
          <path d={momentumArea} fill="url(#momGrad)" />
          <path d={momentumPath} fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {displayWeeks.map((w, i) => (
            <g key={i} onClick={e => { e.stopPropagation(); setMomentumActive(momentumActive === i ? null : i) }} style={{ cursor: 'pointer' }}>
              <circle cx={getX(i)} cy={getScoreY(w.score)} r="14" fill="transparent" />
              <circle cx={getX(i)} cy={getScoreY(w.score)} r={momentumActive === i ? 6 : 4.5} fill={momentumActive === i ? '#3B7DFF' : 'white'} stroke="#3B7DFF" strokeWidth="2.5" />
              <text x={getX(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#8E8E93">{w.label}</text>
            </g>
          ))}
        </svg>
        {momentumActive !== null && (
          <div style={{ background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8, padding: '6px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', display: 'inline-block', marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{displayWeeks[momentumActive].label}</span>
            <span style={{ fontSize: 12, color: '#3B7DFF', marginLeft: 6 }}>score : {displayWeeks[momentumActive].score}</span>
          </div>
        )}
        <button onClick={() => setActiveModal('momentum')} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', paddingTop: 8, textDecoration: 'underline' }}>
          Click to view detailed breakdown
        </button>
      </div>

      {/* ── Progress by Category ─────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 18, padding: '16px 18px 14px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Progress by Category</h2>
          <button onClick={() => setActiveModal('category')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
        <div style={{ position: 'relative', width: '100%', paddingBottom: `${(CBH / CBW) * 100}%`, height: 0 }} onClick={e => e.stopPropagation()}>
          <svg viewBox={`0 0 ${CBW} ${CBH}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {cbYLabels.map(v => (
              <g key={v}>
                <line x1={CBPL} y1={getCBBarY(v)} x2={CBW - CBPR} y2={getCBBarY(v)} stroke="#F0F0F5" strokeWidth="1" strokeDasharray="3 2" />
                <text x={CBPL - 1} y={getCBBarY(v) + 3} textAnchor="end" fontSize="7.5" fill="#C7C7CC">{v}</text>
              </g>
            ))}
            {displayCats.map((c, i) => {
              const bx = getCBX(i)
              const bh = getCBBarH(c.progress)
              const by = getCBBarY(c.progress)
              return (
                <g key={c.category} onClick={e => { e.stopPropagation(); setCatActive(catActive === i ? null : i) }} style={{ cursor: 'pointer' }}>
                  {catActive === i && <rect x={bx - 3} y={CBPT} width={cbBarW + 6} height={cbCH} fill="#F8F8FC" rx="3" />}
                  <rect x={bx} y={by} width={cbBarW} height={bh} fill={catActive === i ? '#2D6AE8' : '#3B7DFF'} rx="4" />
                  <text x={bx + cbBarW / 2} y={CBH - 6} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{c.category}</text>
                </g>
              )
            })}
          </svg>
          {catActive !== null && (
            <div style={{ position: 'absolute', right: 0, top: '10%', background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8, padding: '6px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 5, pointerEvents: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{displayCats[catActive].category}</div>
              <div style={{ fontSize: 12, color: '#3B7DFF' }}>progress : {displayCats[catActive].progress}</div>
            </div>
          )}
        </div>
        <button onClick={() => setActiveModal('category')} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', paddingTop: 8, textDecoration: 'underline' }}>
          Click to see hours invested and tasks completed
        </button>
      </div>

      {/* ── Time Investment (Hours) ───────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 18, padding: '16px 18px 14px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Time Investment (Hours)</h2>
          <button onClick={() => setActiveModal('time')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
        <div style={{ position: 'relative', width: '100%', height: SBH + 4 }} onClick={e => e.stopPropagation()}>
          <svg width="100%" viewBox={`0 0 ${SBW} ${SBH + 4}`}>
            {sbYLabels.map(v => (
              <g key={v}>
                <line x1={SBPAD} y1={getSBY(v)} x2={SBW - SBPAD} y2={getSBY(v)} stroke="#F0F0F5" strokeWidth="1" strokeDasharray="3 2" />
                <text x={SBPAD - 2} y={getSBY(v) + 3} textAnchor="end" fontSize="7.5" fill="#C7C7CC">{v}</text>
              </g>
            ))}
            {displayWeeks.map((w, i) => {
              const bx   = getSBX(i)
              let curY = SBH - SBPAD
              return (
                <g key={i} onClick={e => { e.stopPropagation(); setTimeActive(timeActive === i ? null : i) }} style={{ cursor: 'pointer' }}>
                  {timeActive === i && <rect x={bx - 3} y={SBPAD} width={sbBarW + 6} height={SBH - SBPAD * 2} fill="rgba(0,0,0,0.04)" rx="3" />}
                  {(['career', 'health', 'finance', 'creative'] as const).map(k => {
                    const h = toSBH(w[k])
                    curY -= h
                    return <rect key={k} x={bx} y={curY} width={sbBarW} height={h} fill={CAT_COLORS[k]} />
                  })}
                  <text x={bx + sbBarW / 2} y={SBH - 4} textAnchor="middle" fontSize="8.5" fill="#8E8E93">{w.short}</text>
                </g>
              )
            })}
          </svg>
          {timeActive !== null && (
            <div style={{ position: 'absolute', right: 4, top: SBPAD, background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8, padding: '7px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 5, pointerEvents: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E', marginBottom: 3 }}>{displayWeeks[timeActive].short}</div>
              {(['career', 'health', 'finance', 'creative'] as const).map(k => (
                <div key={k} style={{ fontSize: 11, color: CAT_COLORS[k] }}>{k} : {displayWeeks[timeActive][k]}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {Object.entries(CAT_COLORS).map(([k, color]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 11, color: '#3C3C43', textTransform: 'capitalize' }}>{k}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setActiveModal('time')} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', paddingTop: 8, textDecoration: 'underline' }}>
          Click to analyze time allocation patterns
        </button>
      </div>

      {/* ── Weekly Completion Rate ────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 18, padding: '16px 18px 14px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Weekly Completion Rate</h2>
          <button onClick={() => setActiveModal('completion')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
        <svg width="100%" viewBox={`0 0 ${compW} ${compH + 20}`} style={{ overflow: 'visible' }} onClick={e => e.stopPropagation()}>
          <defs>
            <linearGradient id="compGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34C759" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#34C759" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 20, 40, 60, 80].map(v => (
            <g key={v}>
              <line x1={16} y1={getCompY(v)} x2={compW - 16} y2={getCompY(v)} stroke="#F0F0F5" strokeWidth="1" strokeDasharray="3 2" />
              <text x={14} y={getCompY(v) + 3} textAnchor="end" fontSize="8" fill="#C7C7CC">{v}</text>
            </g>
          ))}
          <path d={compArea} fill="url(#compGrad2)" />
          <path d={compPath} fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {displayWeeks.map((w, i) => (
            <g key={i} onClick={e => { e.stopPropagation(); setCompletionActive(completionActive === i ? null : i) }} style={{ cursor: 'pointer' }}>
              <circle cx={getCompX(i)} cy={getCompY(w.rate)} r="14" fill="transparent" />
              <circle cx={getCompX(i)} cy={getCompY(w.rate)} r={completionActive === i ? 6 : 4.5} fill={completionActive === i ? '#34C759' : 'white'} stroke="#34C759" strokeWidth="2.5" />
              <text x={getCompX(i)} y={compH + 14} textAnchor="middle" fontSize="9" fill="#8E8E93">{w.short}</text>
            </g>
          ))}
        </svg>
        {completionActive !== null && (
          <div style={{ background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8, padding: '6px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', display: 'inline-block', marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E' }}>{displayWeeks[completionActive].short}</span>
            <span style={{ fontSize: 12, color: '#34C759', marginLeft: 6 }}>rate : {displayWeeks[completionActive].rate}%</span>
          </div>
        )}
        <button onClick={() => setActiveModal('completion')} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3B7DFF', fontFamily: 'inherit', paddingTop: 8, textDecoration: 'underline' }}>
          Click for detailed completion metrics
        </button>
      </div>

      {/* ── Goal Progress ─────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 18, padding: '16px 18px 16px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Goal Progress</h2>
          <button onClick={() => router.push('/dashboard/goals')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#3B7DFF', fontFamily: 'inherit', padding: 0 }}>
            View All
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(activeGoals.length > 0 ? activeGoals.slice(0, 5) : [
            { id: '1', text: 'Launch personal brand as design consultant', category: 'Career',   status: 'active', progress: 45 },
            { id: '2', text: 'Save $15k emergency fund',                   category: 'Finance',  status: 'active', progress: 60 },
            { id: '3', text: 'Run 3 times per week consistently',          category: 'Health',   status: 'active', progress: 70 },
            { id: '4', text: 'Finish short story collection',              category: 'Creative', status: 'active', progress: 30 },
          ]).map(goal => (
            <button key={goal.id} onClick={() => router.push(`/dashboard/goals/${goal.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E', margin: 0, flex: 1, paddingRight: 8, lineHeight: 1.3 }}>{goal.text}</p>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', flexShrink: 0 }}>{goal.progress}%</span>
              </div>
              <div style={{ background: '#F2F2F7', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${goal.progress}%`, background: '#3B7DFF', borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Dynamic Insights ─────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 18, padding: '16px 18px 16px', border: '0.5px solid #E5E5EA', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 12px' }}>{getInsightTitle(timePeriod)}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D', margin: '0 0 10px' }}>Wins</p>
            {insights.wins.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < insights.wins.length - 1 ? 7 : 0, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 0 }}>✅</span>
                <span style={{ fontSize: 12, color: '#15803D', lineHeight: 1.4 }}>{w}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E', margin: '0 0 10px' }}>Needs Focus</p>
            {insights.focus.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < insights.focus.length - 1 ? 7 : 0, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 0 }}>⚠️</span>
                <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <button
        onClick={() => router.push('/dashboard/check-in/weekly')}
        style={{ width: '100%', padding: '15px', borderRadius: 14, marginBottom: 10, background: '#1C1C1E', border: 'none', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Run Check-In
      </button>
      <button
        onClick={() => router.push('/dashboard/progress/report')}
        style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'white', border: '1.5px solid #E5E5EA', color: '#1C1C1E', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Export Report
      </button>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {activeModal === 'momentum'   && <MomentumModal   weeks={displayWeeks} onClose={() => setActiveModal(null)} />}
      {activeModal === 'category'   && <CategoryModal   cats={displayCats}   onClose={() => setActiveModal(null)} />}
      {activeModal === 'time'       && <TimeModal        weeks={displayWeeks} onClose={() => setActiveModal(null)} />}
      {activeModal === 'completion' && <CompletionModal  weeks={displayWeeks} onClose={() => setActiveModal(null)} />}
    </div>
  )
}
