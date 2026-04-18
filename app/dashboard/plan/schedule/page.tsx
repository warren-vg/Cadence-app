'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  toDateStr, getScheduleForDate, saveSchedule, getAllSchedule, formatTime, addMinutes,
  type ScheduleBlock,
} from '@/lib/planData'

const CAT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  work:     { bg: '#EFF6FF', color: '#3B7DFF', border: '#DBEAFE' },
  personal: { bg: '#FDF4FF', color: '#9333EA', border: '#E9D5FF' },
  health:   { bg: '#FFF0F5', color: '#EC4899', border: '#FBCFE8' },
  creative: { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
  break:    { bg: '#F0FFF4', color: '#16A34A', border: '#BBF7D0' },
}

const CAT_LABELS: Record<string, string> = {
  work: 'Work', personal: 'Personal', health: 'Health', creative: 'Creative', break: 'Break',
}

interface EditState {
  id: string
  title: string
  startTime: string
  duration: number
  category: string
  isFlexible: boolean
}

export default function ScheduleManagerPage() {
  const router = useRouter()
  const [items, setItems] = useState<ScheduleBlock[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [mounted, setMounted] = useState(false)
  const [dateOffset, setDateOffset] = useState(0)

  const today = new Date()
  const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dateOffset)
  const dateStr = toDateStr(targetDate)
  const displayDate = dateOffset === 0 ? 'Today' : targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const fullDate = targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    setItems(getScheduleForDate(dateStr))
  }, [mounted, dateStr])

  if (!mounted) return null

  const totalMinutes = items.reduce((s, i) => s + i.duration, 0)
  const flexCount = items.filter(i => i.isFlexible).length

  const startEdit = (item: ScheduleBlock) => {
    setEditId(item.id)
    setEdit({ id: item.id, title: item.title, startTime: item.startTime, duration: item.duration, category: item.category, isFlexible: item.isFlexible })
  }

  const saveEdit = () => {
    if (!edit) return
    const all = getAllSchedule()
    const updated = all.map(i => i.id === edit.id ? { ...i, ...edit } : i)
    // Cascade flexible items after edit
    const dayItems = updated
      .filter(i => i.date === dateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

    let prevEnd = edit.startTime
    let hitEdited = false
    for (let i = 0; i < dayItems.length; i++) {
      if (dayItems[i].id === edit.id) {
        hitEdited = true
        prevEnd = addMinutes(edit.startTime, edit.duration)
        continue
      }
      if (hitEdited && dayItems[i].isFlexible) {
        const newStart = prevEnd
        const idx = updated.findIndex(x => x.id === dayItems[i].id)
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], startTime: newStart }
          prevEnd = addMinutes(newStart, updated[idx].duration)
        }
      } else if (hitEdited) {
        const itemStart = dayItems[i].startTime
        prevEnd = addMinutes(itemStart, dayItems[i].duration)
      }
    }

    saveSchedule(updated)
    setItems(updated.filter(i => i.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime)))
    setEditId(null)
    setEdit(null)
  }

  const deleteItem = (id: string) => {
    const all = getAllSchedule()
    const updated = all.filter(i => i.id !== id)
    saveSchedule(updated)
    setItems(updated.filter(i => i.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime)))
  }

  return (
    <div style={{ padding: '0 0 16px' }}>

      {/* Header */}
      <div style={{ padding: '56px 16px 16px', background: 'white', borderBottom: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <button
              onClick={() => router.back()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              Plan
            </button>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Schedule Manager</h1>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>Adjust your daily rhythm</p>
          </div>
          <div style={{ paddingTop: 36 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
        </div>

        {/* Date Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button onClick={() => setDateOffset(o => o - 1)} style={navBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', flex: 1, textAlign: 'center' }}>
            {displayDate} <span style={{ fontWeight: 400, color: '#8E8E93', fontSize: 13 }}>· {fullDate.split(',').slice(1).join(',').trim()}</span>
          </span>
          <button onClick={() => setDateOffset(o => o + 1)} style={navBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Dynamic Scheduling Banner */}
        <div style={{
          background: '#EFF6FF', borderRadius: 14, padding: '14px 16px',
          border: '1px solid #DBEAFE', marginBottom: 14,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1D4ED8', margin: '0 0 2px' }}>Dynamic Scheduling Active</p>
            <p style={{ fontSize: 13, color: '#3B82F6', margin: 0 }}>When you adjust an item, flexible tasks will automatically shift to maintain your schedule flow.</p>
          </div>
        </div>

        {/* Schedule Items */}
        {items.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: 16, padding: '40px 20px', textAlign: 'center',
            border: '0.5px solid #E5E5EA', marginBottom: 14, color: '#8E8E93',
          }}>
            <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px', color: '#3C3C43' }}>No schedule blocks</p>
            <p style={{ fontSize: 13, margin: 0 }}>Add time blocks to structure your day.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {items.map(item => {
              const catStyle = CAT_COLORS[item.category] || CAT_COLORS.work
              const endTime = addMinutes(item.startTime, item.duration)
              const durationHrs = item.duration / 60

              if (editId === item.id && edit) {
                return (
                  <div key={item.id} style={{
                    background: 'white', borderRadius: 16, padding: '16px',
                    border: '2px solid #3B7DFF',
                  }}>
                    <input
                      value={edit.title}
                      onChange={e => setEdit(v => v ? { ...v, title: e.target.value } : v)}
                      style={{
                        width: '100%', border: '0.5px solid #E5E5EA', borderRadius: 8,
                        padding: '10px 12px', fontSize: 15, fontFamily: 'inherit',
                        marginBottom: 10, boxSizing: 'border-box', outline: 'none',
                      }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, color: '#8E8E93', display: 'block', marginBottom: 4 }}>Start Time</label>
                        <input
                          type="time"
                          value={edit.startTime}
                          onChange={e => setEdit(v => v ? { ...v, startTime: e.target.value } : v)}
                          style={{ width: '100%', border: '0.5px solid #E5E5EA', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: '#8E8E93', display: 'block', marginBottom: 4 }}>Duration (min)</label>
                        <input
                          type="number"
                          value={edit.duration}
                          onChange={e => setEdit(v => v ? { ...v, duration: parseInt(e.target.value) || 30 } : v)}
                          style={{ width: '100%', border: '0.5px solid #E5E5EA', borderRadius: 8, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                    </div>
                    <select
                      value={edit.category}
                      onChange={e => setEdit(v => v ? { ...v, category: e.target.value } : v)}
                      style={{ width: '100%', border: '0.5px solid #E5E5EA', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box', outline: 'none' }}
                    >
                      {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <input
                        type="checkbox"
                        id={`flex-${item.id}`}
                        checked={edit.isFlexible}
                        onChange={e => setEdit(v => v ? { ...v, isFlexible: e.target.checked } : v)}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <label htmlFor={`flex-${item.id}`} style={{ fontSize: 14, color: '#3C3C43', cursor: 'pointer' }}>Flexible (auto-adjusts)</label>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveEdit} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#3B7DFF', border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                      <button onClick={() => { setEditId(null); setEdit(null) }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#F2F2F7', border: 'none', color: '#3C3C43', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                      <button onClick={() => deleteItem(item.id)} style={{ padding: '10px 14px', borderRadius: 10, background: '#FFF0F0', border: 'none', color: '#FF3B30', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={item.id} style={{
                  background: 'white', borderRadius: 16, padding: '16px 18px',
                  border: '0.5px solid #E5E5EA',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span style={{ fontSize: 13, color: '#8E8E93' }}>
                        {formatTime(item.startTime)} - {formatTime(endTime)}
                      </span>
                      <span style={{ fontSize: 12, color: '#8E8E93' }}>({durationHrs % 1 === 0 ? durationHrs : durationHrs.toFixed(1)} {durationHrs <= 1 ? 'hr' : 'hrs'})</span>
                      {item.isFlexible && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#3B7DFF', background: '#EFF6FF', borderRadius: 20, padding: '1px 7px' }}>Flexible</span>
                      )}
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E', margin: '0 0 6px' }}>{item.title}</p>
                    <span style={{
                      fontSize: 12, fontWeight: 500,
                      background: catStyle.bg, color: catStyle.color,
                      padding: '2px 8px', borderRadius: 20,
                    }}>
                      {CAT_LABELS[item.category] || item.category}
                    </span>
                  </div>
                  <button
                    onClick={() => startEdit(item)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 12px' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Daily Summary */}
        <div style={{
          background: 'white', borderRadius: 16, padding: '18px',
          border: '0.5px solid #E5E5EA', marginBottom: 14,
        }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 14px' }}>Daily Summary</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ background: '#F8F8FC', borderRadius: 12, padding: '14px' }}>
              <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 4px' }}>Total Scheduled</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>
                {Math.floor(totalMinutes / 60)}h {totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : '0m'}
              </p>
            </div>
            <div style={{ background: '#F8F8FC', borderRadius: 12, padding: '14px' }}>
              <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 4px' }}>Flexible Blocks</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>{flexCount}</p>
            </div>
          </div>
        </div>

        {/* Scheduling Tips */}
        <div style={{
          background: '#FFFBEB', borderRadius: 14, padding: '16px',
          border: '1px solid #FDE68A',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#F59E0B" strokeWidth="2" fill="none" /></svg>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#92400E', margin: 0 }}>Scheduling Tips</p>
          </div>
          {[
            'Mark routine tasks as "Flexible" for automatic adjustments',
            'Changes cascade forward to maintain schedule flow',
            "Fixed items won't move unless there's a direct conflict",
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < 2 ? 6 : 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D97706', marginTop: 7, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#92400E' }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'white', border: '0.5px solid #E5E5EA', borderRadius: 8,
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0,
}
