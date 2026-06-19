'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMonday, addDays, toDateStr, CONSTANTS } from '@/lib/planData'
import { getWeekStreakFromDB, type DBTask } from '@/lib/db'
import EmptyState from '@/app/dashboard/components/EmptyState'

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

// ─── Chart colors ─────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  career:   '#3B7DFF',
  health:   '#34C759',
  finance:  '#FF9500',
  creative: '#9333EA',
}

// ─── Waveform palette (premium muted tones) ───────────────────────────────────

const WAVE_CAT_COLORS: Record<string, string> = {
  career:           '#5B85E8',
  health:           '#3DB87B',
  finance:          '#7B62D4',
  creative:         '#E07070',
  'personal growth': '#C9963B',
  personal:         '#C9963B',
}
function waveColor(cat: string): string {
  return WAVE_CAT_COLORS[cat.toLowerCase()] ?? '#9B9BDF'
}

function getWaveformInsight(tasks: DBTask[]): string {
  if (tasks.length === 0) return 'Log your first completed task to see your rhythm emerge.'
  const byCategory: Record<string, number> = {}
  tasks.forEach(t => {
    const cat = t.category.toLowerCase()
    byCategory[cat] = (byCategory[cat] || 0) + t.duration
  })
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  if (!sorted.length) return 'Start completing tasks to see your rhythm emerge.'
  const [topCat, topHours] = sorted[0]
  const name = topCat.charAt(0).toUpperCase() + topCat.slice(1)
  return `${name} work is leading your rhythm this week — ${topHours.toFixed(1)}h logged.`
}

// ─── WaveformRhythmChart ──────────────────────────────────────────────────────

function WaveformRhythmChart({ allTasks }: { allTasks: DBTask[] }) {
  const today = new Date()
  const monday = getMonday(today)
  const weekStart = toDateStr(monday)
  const weekEnd = toDateStr(addDays(monday, 6))

  const weekTasks = allTasks
    .filter(t => t.completed && t.date >= weekStart && t.date <= weekEnd)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.scheduled_time.localeCompare(b.scheduled_time)
    })

  const insight = getWaveformInsight(weekTasks)

  // One Meaningful Move: highest-priority completed task per day
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const ommIds = new Set<string>()
  const byDate: Record<string, DBTask[]> = {}
  weekTasks.forEach(t => { (byDate[t.date] = byDate[t.date] || []).push(t) })
  Object.values(byDate).forEach(dayTasks => {
    const omm = [...dayTasks].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    )[0]
    if (omm) ommIds.add(omm.id)
  })

  const n = weekTasks.length
  const W = 320, H = 148, PAD_X = 14, PAD_TOP = 14, PAD_BOT = 8
  const chartW = W - PAD_X * 2
  const chartH = H - PAD_TOP - PAD_BOT
  const BASE = PAD_TOP + chartH

  const barW = n > 0 ? Math.max(6, Math.min(16, (chartW / Math.max(n, 1)) * 0.62)) : 10
  const step = n > 1 ? (chartW - barW) / (n - 1) : 0
  const maxDur = Math.max(...weekTasks.map(t => t.duration), 0.5)

  const getCX = (i: number) => n === 1 ? PAD_X + chartW / 2 : PAD_X + barW / 2 + i * step
  const getBarH = (dur: number) => Math.max(10, (dur / maxDur) * chartH * 0.88)
  const getBarY = (dur: number) => BASE - getBarH(dur)

  const usedCats = [...new Set(weekTasks.map(t => t.category.toLowerCase()))]
  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${addDays(monday, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  return (
    <div style={{ background: 'white', borderRadius: 18, padding: '16px 18px 14px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Weekly Rhythm</h2>
        <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 400 }}>{weekLabel}</span>
      </div>
      <p style={{ fontSize: 13, color: '#3C3C43', lineHeight: 1.45, margin: '0 0 12px' }}>{insight}</p>

      {n === 0 ? (
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: '#C7C7CC' }}>Complete tasks to see your rhythm here.</span>
        </div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
          {/* Baseline */}
          <line x1={PAD_X} y1={BASE} x2={W - PAD_X} y2={BASE} stroke="#F0F0F5" strokeWidth="1" />

          {weekTasks.map((t, i) => {
            const cx = getCX(i)
            const barH = getBarH(t.duration)
            const barY = getBarY(t.duration)
            const color = waveColor(t.category)
            const isOMM = ommIds.has(t.id)
            const rx = barW / 2

            return (
              <g key={t.id}>
                {/* OMM ring — outer glow */}
                {isOMM && (
                  <rect
                    x={cx - rx - 5} y={barY - 5}
                    width={barW + 10} height={barH + 10}
                    rx={rx + 5}
                    fill="none" stroke={color} strokeWidth="1.5" opacity={0.45}
                  />
                )}
                {/* OMM ring — white halo */}
                {isOMM && (
                  <rect
                    x={cx - rx - 3} y={barY - 3}
                    width={barW + 6} height={barH + 6}
                    rx={rx + 3}
                    fill="none" stroke="white" strokeWidth="3"
                  />
                )}
                {/* Bar */}
                <rect
                  x={cx - rx} y={barY}
                  width={barW} height={barH}
                  rx={rx} ry={rx}
                  fill={color}
                  opacity={isOMM ? 1 : 0.82}
                />
              </g>
            )
          })}
        </svg>
      )}

      {usedCats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: 10 }}>
          {usedCats.map(cat => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: waveColor(cat), flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#8E8E93' }}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ActivityCalendar ─────────────────────────────────────────────────────────

function ActivityCalendar({
  allTasks,
  monthOffset,
  onPrev,
  onNext,
}: {
  allTasks: DBTask[]
  monthOffset: number
  onPrev: () => void
  onNext: () => void
}) {
  const today = new Date()
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = new Date(year, month, 1).getDay()

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad2(month + 1)}-01`
  const monthEnd   = `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`
  const todayStr   = toDateStr(today)

  const hoursPerDay: Record<string, number> = {}
  allTasks.filter(t => t.completed && t.date >= monthStart && t.date <= monthEnd).forEach(t => {
    hoursPerDay[t.date] = (hoursPerDay[t.date] || 0) + t.duration
  })
  const maxHours = Math.max(...Object.values(hoursPerDay), 0.1)

  // Count active days in the viewed range
  const activeDayCount = Object.values(hoursPerDay).filter(h => h > 0).length

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const cells: Array<{ day: number; dateStr: string } | null> = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return { day: d, dateStr: `${year}-${pad2(month + 1)}-${pad2(d)}` }
    }),
  ]

  const isCurrentMonth = monthOffset === 0

  return (
    <div style={{ background: 'white', borderRadius: 18, padding: '16px 18px 14px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Activity</h2>
          <p style={{ fontSize: 12, color: '#8E8E93', margin: '2px 0 0' }}>
            {activeDayCount} active {activeDayCount === 1 ? 'day' : 'days'} this {isCurrentMonth ? 'month' : 'period'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onPrev}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#8E8E93', display: 'flex', alignItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E', whiteSpace: 'nowrap' }}>{monthLabel}</span>
          <button
            onClick={onNext}
            disabled={isCurrentMonth}
            style={{ background: 'none', border: 'none', cursor: isCurrentMonth ? 'default' : 'pointer', padding: 4, color: isCurrentMonth ? '#D1D1D6' : '#8E8E93', display: 'flex', alignItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAY_NAMES.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 500, color: '#8E8E93', paddingBottom: 4 }}>{d}</div>
        ))}
      </div>

      {/* Calendar cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} style={{ height: 36 }} />

          const hours = hoursPerDay[cell.dateStr] || 0
          const isToday = cell.dateStr === todayStr
          const isActive = hours > 0
          // Dot size: 8px baseline, scales up to 22px
          const dotSize = isActive ? 8 + (hours / maxHours) * 14 : 0
          // Opacity: 0.35 to 1.0
          const dotOpacity = isActive ? 0.35 + (hours / maxHours) * 0.65 : 0

          return (
            <div key={i} style={{ height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {/* Activity dot */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  width: dotSize, height: dotSize,
                  borderRadius: '50%',
                  background: '#2563EB',
                  opacity: dotOpacity,
                }} />
              )}
              {/* Today ring */}
              {isToday && (
                <div style={{
                  position: 'absolute',
                  width: 26, height: 26,
                  borderRadius: '50%',
                  border: '1.5px solid #2563EB',
                }} />
              )}
              {/* Day number */}
              <span style={{
                position: 'relative', zIndex: 1,
                fontSize: 11,
                fontWeight: isToday ? 700 : 400,
                color: isToday
                  ? '#2563EB'
                  : (isActive && dotSize >= 18 ? 'white' : '#8E8E93'),
              }}>
                {cell.day}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB' }} />
          <span style={{ fontSize: 11, color: '#8E8E93' }}>Active day</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '1.5px solid #2563EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, color: '#2563EB', fontWeight: 700 }}>{today.getDate()}</span>
          </div>
          <span style={{ fontSize: 11, color: '#8E8E93' }}>Today</span>
        </div>
      </div>
    </div>
  )
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function getISOWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7)
}

function buildWeeklyDataFromTasks(tasks: DBTask[], reflByWeek: Record<string, number> = {}): WeekData[] {
  const today = new Date()
  const weeks: WeekData[] = []
  for (let w = 3; w >= 0; w--) {
    const monday    = getMonday(addDays(today, -w * 7))
    const weekStart = toDateStr(monday)
    const weekEnd   = toDateStr(addDays(monday, 6))
    const wt        = tasks.filter(t => t.date >= weekStart && t.date <= weekEnd)
    const completed = wt.filter(t => t.completed).length
    const total     = wt.length
    const hours     = parseFloat(wt.reduce((s, t) => s + t.duration, 0).toFixed(1))
    const rate      = total > 0 ? Math.round((completed / total) * 100) : 0
    const byCat     = (cat: string) =>
      parseFloat(wt.filter(t => t.category.toLowerCase() === cat).reduce((s, t) => s + t.duration, 0).toFixed(1))
    const isoWeek   = getISOWeekNumber(monday)
    const score     = reflByWeek[weekStart] ?? rate
    weeks.push({ label: `Week ${isoWeek}`, short: `W${isoWeek}`, score, completed, total, hours, rate, efficiency: rate, career: byCat('career'), health: byCat('health'), finance: byCat('finance'), creative: byCat('creative') })
  }
  return weeks
}

function buildDailyDataFromTasks(tasks: DBTask[]): WeekData[] {
  const today  = new Date()
  const monday = getMonday(today)
  const todayStr = toDateStr(today)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const days: WeekData[] = []
  for (let d = 0; d < 7; d++) {
    const day    = addDays(monday, d)
    const dayStr = toDateStr(day)
    if (dayStr > todayStr) break
    const dt = tasks.filter(t => t.date === dayStr)
    const completed = dt.filter(t => t.completed).length
    const total  = dt.length
    const hours  = parseFloat(dt.reduce((s, t) => s + t.duration, 0).toFixed(1))
    const rate   = total > 0 ? Math.round((completed / total) * 100) : 0
    const byCat  = (cat: string) => parseFloat(dt.filter(t => t.category.toLowerCase() === cat).reduce((s, t) => s + t.duration, 0).toFixed(1))
    days.push({ label: dayNames[d], short: dayNames[d], score: rate, completed, total, hours, rate, efficiency: rate, career: byCat('career'), health: byCat('health'), finance: byCat('finance'), creative: byCat('creative') })
  }
  return days
}

function buildQuarterlyDataFromTasks(tasks: DBTask[]): WeekData[] {
  const now = new Date()
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3
  const months: WeekData[] = []
  for (let m = 0; m < 3; m++) {
    const monthDate = new Date(now.getFullYear(), qStartMonth + m, 1)
    if (monthDate > now) break
    const nextMonth = new Date(now.getFullYear(), qStartMonth + m + 1, 1)
    const monthStart = toDateStr(monthDate)
    const monthEnd   = toDateStr(new Date(nextMonth.getTime() - 86400000))
    const mt = tasks.filter(t => t.date >= monthStart && t.date <= monthEnd)
    const completed = mt.filter(t => t.completed).length
    const total  = mt.length
    const hours  = parseFloat(mt.reduce((s, t) => s + t.duration, 0).toFixed(1))
    const rate   = total > 0 ? Math.round((completed / total) * 100) : 0
    const byCat  = (cat: string) => parseFloat(mt.filter(t => t.category.toLowerCase() === cat).reduce((s, t) => s + t.duration, 0).toFixed(1))
    const label  = monthDate.toLocaleDateString('en-US', { month: 'short' })
    months.push({ label, short: label, score: rate, completed, total, hours, rate, efficiency: rate, career: byCat('career'), health: byCat('health'), finance: byCat('finance'), creative: byCat('creative') })
  }
  return months
}

function buildYearlyDataFromTasks(tasks: DBTask[]): WeekData[] {
  const now  = new Date()
  const year = now.getFullYear()
  const quarters: WeekData[] = []
  for (let q = 0; q < 4; q++) {
    const qStart = new Date(year, q * 3, 1)
    if (qStart > now) break
    const qEnd     = new Date(year, q * 3 + 3, 0)
    const qStartStr = toDateStr(qStart)
    const qEndStr   = toDateStr(qEnd)
    const qt = tasks.filter(t => t.date >= qStartStr && t.date <= qEndStr)
    const completed = qt.filter(t => t.completed).length
    const total  = qt.length
    const hours  = parseFloat(qt.reduce((s, t) => s + t.duration, 0).toFixed(1))
    const rate   = total > 0 ? Math.round((completed / total) * 100) : 0
    const byCat  = (cat: string) => parseFloat(qt.filter(t => t.category.toLowerCase() === cat).reduce((s, t) => s + t.duration, 0).toFixed(1))
    quarters.push({ label: `Q${q + 1}`, short: `Q${q + 1}`, score: rate, completed, total, hours, rate, efficiency: rate, career: byCat('career'), health: byCat('health'), finance: byCat('finance'), creative: byCat('creative') })
  }
  return quarters
}

function buildCatDataFromTasks(goals: Goal[], tasks: DBTask[]): CatData[] {
  const active = goals.filter(g => g.status === 'active')
  return ['Career', 'Finance', 'Health', 'Creative'].map(cat => {
    const matching = active.filter(g => g.category === cat)
    const progress = matching.length > 0
      ? Math.round(matching.reduce((s, g) => s + (g.progress || 0), 0) / matching.length) : 0
    const catTasks = tasks.filter(t => t.category === cat)
    const hours    = parseFloat(catTasks.reduce((s, t) => s + t.duration, 0).toFixed(1))
    const taskCount = catTasks.length
    const efficiency = hours > 0 ? parseFloat((taskCount / hours).toFixed(1)) : 0
    return { category: cat, progress, hours, tasks: taskCount, efficiency }
  })
}



function computeInsights(goals: Goal[]): { wins: string[]; focus: string[] } {
  const active = goals.filter(g => g.status === 'active')
  if (!active.length) return { wins: ['Keep up the consistent effort!'], focus: ['Stay consistent across all goal areas'] }
  const wins: string[]  = []
  const focus: string[] = []
  const sorted     = [...active].sort((a, b) => b.progress - a.progress)
  const struggling = active.filter(g => g.progress < CONSTANTS.PROGRESS_STRUGGLING_THRESHOLD)
  if (sorted[0] && sorted[0].progress >= 70) {
    const t = sorted[0].text
    wins.push(`${t.length > 42 ? t.slice(0, 42) + '…' : t} at ${sorted[0].progress}%`)
  }
  const avg = Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length)
  wins.push(`Overall average progress: ${avg}%`)
  const completed = active.filter(g => g.progress >= 100)
  if (completed.length > 0) wins.push(`${completed.length} goal(s) at 100%!`)
  if (struggling[0]) {
    const t = struggling[0].text
    focus.push(`${t.length > 42 ? t.slice(0, 42) + '…' : t} needs attention (${struggling[0].progress}%)`)
  }
  const cats = [...new Set(active.map(g => g.category))]
  if (cats.length > 1) {
    const catAvgs = cats.map(cat => ({ cat, avg: Math.round(active.filter(g => g.category === cat).reduce((s, g) => s + g.progress, 0) / active.filter(g => g.category === cat).length) }))
    const weakCat = catAvgs.sort((a, b) => a.avg - b.avg)[0]
    if (weakCat.avg < 50) focus.push(`${weakCat.cat} goals need more time allocation`)
  }
  return {
    wins:  wins.length  > 0 ? wins  : ['Keep up the consistent effort!'],
    focus: focus.length > 0 ? focus : ['Stay consistent across all goal areas'],
  }
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
  const [goals, setGoals]                 = useState<Goal[]>([])
  const [allTasks, setAllTasks]           = useState<DBTask[]>([])
  const [activeModal, setActiveModal]     = useState<ModalType>(null)
  const [timePeriod, setTimePeriod]       = useState('This Month')
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [mounted, setMounted]             = useState(false)
  const [weeklyData, setWeeklyData]       = useState<WeekData[]>([])
  const [monthlyWeeks, setMonthlyWeeks]   = useState<WeekData[]>([])
  const [quarterlyData, setQuarterlyData] = useState<WeekData[]>([])
  const [yearlyData, setYearlyData]       = useState<WeekData[]>([])
  const [weekStreak, setWeekStreak]       = useState(0)
  const [calMonthOffset, setCalMonthOffset] = useState(0)

  // Per-chart tooltip indices
  const [momentumActive, setMomentumActive]     = useState<number | null>(null)
  const [catActive, setCatActive]               = useState<number | null>(null)
  const [timeActive, setTimeActive]             = useState<number | null>(null)
  const [completionActive, setCompletionActive] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const today        = new Date()
      const yearStart    = toDateStr(new Date(today.getFullYear(), 0, 1))
      const fourWeeksAgo = toDateStr(addDays(getMonday(today), -21))

      const [{ data: goalData }, { data: taskData }, streakVal, { data: reflData }] = await Promise.all([
        supabase.from('goals').select('id,text,category,status,progress').eq('user_id', user.id),
        supabase.from('tasks').select('*').eq('user_id', user.id).gte('date', yearStart).order('date', { ascending: true }),
        getWeekStreakFromDB(user.id),
        supabase.from('weekly_reflections').select('week_of, week_score').eq('user_id', user.id).gte('week_of', fourWeeksAgo),
      ])

      const goalList   = (goalData || []) as Goal[]
      const taskList   = (taskData || []) as DBTask[]
      const reflByWeek = Object.fromEntries(((reflData || []) as { week_of: string; week_score: number }[]).map(r => [r.week_of, r.week_score]))
      setGoals(goalList)
      setAllTasks(taskList)
      setWeeklyData(buildDailyDataFromTasks(taskList))
      setMonthlyWeeks(buildWeeklyDataFromTasks(taskList, reflByWeek))
      setQuarterlyData(buildQuarterlyDataFromTasks(taskList))
      setYearlyData(buildYearlyDataFromTasks(taskList))
      setWeekStreak(streakVal)
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
  const displayWeeks =
    timePeriod === 'This Week'    ? weeklyData :
    timePeriod === 'This Month'   ? monthlyWeeks :
    timePeriod === 'This Quarter' ? quarterlyData :
    timePeriod === 'This Year'    ? yearlyData :
    []

  // Period-filtered category data from real tasks
  const periodStart =
    timePeriod === 'This Week'    ? toDateStr(getMonday(new Date())) :
    timePeriod === 'This Month'   ? toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) :
    timePeriod === 'This Quarter' ? toDateStr(new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1)) :
    toDateStr(new Date(new Date().getFullYear(), 0, 1))
  const periodTasks = allTasks.filter(t => t.date >= periodStart)
  const displayCats = buildCatDataFromTasks(goals, periodTasks)

  const insights    = computeInsights(goals)
  const periodLabel = getPeriodLabel(timePeriod)
  const trend       = getTrendText(displayWeeks, timePeriod)
  const activeGoals = goals.filter(g => g.status === 'active')

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Cadence</h1>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>Your rhythm over time.</p>
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

      {/* ── Period badge for Cadence section ─────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 20,
          padding: '7px 14px', fontSize: 14, fontWeight: 500, color: '#1C1C1E',
        }}>
          This Week
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
      </div>

      {/* ── Waveform Rhythm Chart ─────────────────────────────────────────── */}
      <WaveformRhythmChart allTasks={allTasks} />

      {/* ── Activity Calendar ─────────────────────────────────────────────── */}
      <ActivityCalendar
        allTasks={allTasks}
        monthOffset={calMonthOffset}
        onPrev={() => setCalMonthOffset(v => v - 1)}
        onNext={() => setCalMonthOffset(v => Math.min(v + 1, 0))}
      />

      {/* ── Stats row (Active Goals + Week Streak only) ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {[
          { icon: '🎯', label: 'Active Goals', value: activeGoals.length, iconBg: '#DBEAFE' },
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
      <div data-tour="progress-momentum-chart" style={{ background: 'white', borderRadius: 18, padding: '16px 18px 14px', border: '0.5px solid #E5E5EA', marginBottom: 12 }}>
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
          {activeGoals.length === 0 ? (
            <EmptyState
              icon="📈"
              iconBg="#EFF6FF"
              title="No active goals yet"
              body="Set your first goal to start tracking progress and momentum here."
              ctaLabel="Set a Goal"
              onCta={() => router.push('/dashboard/goals')}
            />
          ) : activeGoals.slice(0, 5).map(goal => (
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
