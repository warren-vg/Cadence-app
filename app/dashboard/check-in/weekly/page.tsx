'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toDateStr, getMonday, addDays } from '@/lib/planData'
import { supabase } from '@/lib/supabase'
import { saveReflectionToDB, getReflectionForWeek, getWeekStreakFromDB, getTasksForWeek, type DBTask } from '@/lib/db'

interface Goal {
  id: string
  text: string
  category: string
  status: string
  progress: number
}

function computeInsights(goals: Goal[]): { wins: string[]; focus: string[] } {
  const active = goals.filter(g => g.status === 'active')
  if (!active.length) return { wins: ['Keep up the consistent effort!'], focus: ['Stay consistent across all goal areas'] }
  const wins: string[]  = []
  const focus: string[] = []
  const sorted     = [...active].sort((a, b) => b.progress - a.progress)
  const struggling = active.filter(g => g.progress < 40)
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
    const catAvgs = cats.map(cat => ({
      cat,
      avg: Math.round(active.filter(g => g.category === cat).reduce((s, g) => s + g.progress, 0) / active.filter(g => g.category === cat).length),
    }))
    const weakCat = catAvgs.sort((a, b) => a.avg - b.avg)[0]
    if (weakCat.avg < 50) focus.push(`${weakCat.cat} goals need more time allocation`)
  }
  return {
    wins:  wins.length  > 0 ? wins  : ['Keep up the consistent effort!'],
    focus: focus.length > 0 ? focus : ['Stay consistent across all goal areas'],
  }
}

export default function WeeklyReviewPage() {
  const router = useRouter()
  const [wins, setWins]             = useState('')
  const [challenges, setChallenges] = useState('')
  const [learnings, setLearnings]   = useState('')
  const [nextFocus, setNextFocus]   = useState('')
  const [showInsights, setShowInsights] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  const [streak, setStreak]         = useState(0)
  const [weekTasksList, setWeekTasksList] = useState<DBTask[]>([])
  const [goals, setGoals]           = useState<Goal[]>([])

  useEffect(() => {
    setMounted(true)
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const monday = getMonday(new Date())
      const weekOf = toDateStr(monday)
      const [existing, currentStreak, weekTasks, { data: goalsData }] = await Promise.all([
        getReflectionForWeek(user.id, weekOf),
        getWeekStreakFromDB(user.id),
        getTasksForWeek(user.id, monday),
        supabase.from('goals').select('id, text, category, status, progress').eq('user_id', user.id),
      ])
      setStreak(currentStreak)
      setWeekTasksList(weekTasks)
      setGoals((goalsData || []) as Goal[])
      if (existing) {
        setWins(existing.wins)
        setChallenges(existing.challenges)
        setLearnings(existing.learnings)
        setNextFocus(existing.next_week_focus)
      }
    }
    init()
  }, [])

  if (!mounted) return null

  const today  = new Date()
  const monday = getMonday(today)
  const sunday = addDays(monday, 6)

  const summary = {
    totalTasks:     weekTasksList.length,
    completedTasks: weekTasksList.filter(t => t.completed).length,
    totalHours:     parseFloat(weekTasksList.reduce((s, t) => s + t.duration, 0).toFixed(1)),
  }

  const weekScore = summary.totalTasks > 0
    ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
    : 0

  const insights = computeInsights(goals)
  const allInsights = [...insights.wins, ...insights.focus]

  const handleSave = async () => {
    if (!userId) return
    const weekOf = toDateStr(monday)
    await saveReflectionToDB(userId, {
      week_of:         weekOf,
      wins,
      challenges,
      learnings,
      next_week_focus: nextFocus,
      week_score:      weekScore,
    })
    const newStreak = await getWeekStreakFromDB(userId)
    setStreak(newStreak)
    setSubmitted(true)
  }

  const handleBuildNext = () => {
    router.push('/dashboard/plan/weekly')
  }

  if (submitted) {
    return (
      <div style={{ padding: '0 0 16px' }}>
        <div style={{ padding: '56px 16px 16px', background: 'white', borderBottom: '0.5px solid #E5E5EA' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Review Saved</h1>
        </div>
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F0FFF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>Week logged!</p>
          <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 6px' }}>Your reflection has been saved.</p>
          {streak > 0 && (
            <p style={{ fontSize: 14, color: '#D97706', fontWeight: 600, margin: '0 0 32px' }}>
              🔥 {streak} week streak — keep it going!
            </p>
          )}
          <button
            onClick={handleBuildNext}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: '#3B7DFF', border: 'none', color: 'white',
              fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Build Next Week
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 16px' }}>

      {/* Header */}
      <div style={{ padding: '56px 16px 16px', background: 'white', borderBottom: '0.5px solid #E5E5EA' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Plan
        </button>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Weekly Review</h1>
        <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>
          Week of {monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
          {sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Week Score Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
          borderRadius: 18, padding: '20px', marginBottom: 14, color: 'white',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 13, opacity: 0.8, margin: '0 0 4px' }}>Week Score</p>
              <p style={{ fontSize: 44, fontWeight: 800, margin: '0 0 12px', lineHeight: 1 }}>{weekScore}</p>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: 'Completed', value: `${summary.completedTasks}/${summary.totalTasks}` },
                  { label: 'Hours',     value: `${summary.totalHours}h` },
                  { label: 'Streak',    value: streak > 0 ? `${streak} wks 🔥` : 'New streak' },
                ].map(s => (
                  <div key={s.label}>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 1px' }}>{s.value}</p>
                    <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
          </div>
        </div>

        {/* Reflection Forms */}
        {[
          { label: 'What went well this week?',   placeholder: 'Celebrate your wins, big and small...', value: wins,       setter: setWins       },
          { label: 'What blocked your progress?', placeholder: 'What got in the way?',                  value: challenges, setter: setChallenges  },
          { label: 'What did you learn?',          placeholder: 'Key insights and lessons...',           value: learnings,  setter: setLearnings  },
          { label: 'Next week focus',              placeholder: "What's the one thing to prioritize?",   value: nextFocus,  setter: setNextFocus  },
        ].map(field => (
          <div key={field.label} style={{
            background: 'white', borderRadius: 14, padding: '16px',
            border: '0.5px solid #E5E5EA', marginBottom: 10,
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: '0 0 10px' }}>{field.label}</p>
            <textarea
              value={field.value}
              onChange={e => field.setter(e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              maxLength={2000}
              style={{
                width: '100%', border: '0.5px solid #E5E5EA', borderRadius: 10,
                padding: '12px', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit',
                resize: 'none', outline: 'none', boxSizing: 'border-box',
                background: '#F8F8FC',
              }}
            />
          </div>
        ))}

        {/* Goal-derived Insights */}
        {showInsights && (
          <div style={{
            background: '#EFF6FF', borderRadius: 14, padding: '16px',
            border: '1px solid #DBEAFE', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1D4ED8', margin: 0 }}>Weekly Insights</p>
            </div>
            {allInsights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < allInsights.length - 1 ? 8 : 0 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3B7DFF', marginTop: 7, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 1.5 }}>{ins}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowInsights(v => !v)}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, marginBottom: 10,
            background: 'white', border: '0.5px solid #E5E5EA', color: '#1C1C1E',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {showInsights ? 'Hide Insights' : 'Generate Insights'}
        </button>

        {/* Save Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              background: 'white', border: '0.5px solid #E5E5EA', color: '#3C3C43',
              fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
            onClick={() => router.back()}
          >
            Skip Reflection
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 2, padding: '13px', borderRadius: 12,
              background: '#3B7DFF', border: 'none', color: 'white',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Save & Continue
          </button>
        </div>

        <button
          onClick={handleBuildNext}
          style={{
            width: '100%', padding: '15px', borderRadius: 14,
            background: '#1C1C1E', border: 'none', color: 'white',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Build Next Week
        </button>
      </div>
    </div>
  )
}
