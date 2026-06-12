'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { selectInsight, type InsightTemplate } from '@/lib/onboardingInsights'

type CapacityDay = { hours: number; time_of_day: string }
type CapacitySchedule = Record<string, CapacityDay>

const DAY_KEYS   = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface ActiveGoal { text: string; category: string }

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function YourFirstWeekPage() {
  const router = useRouter()
  const [goals, setGoals]                   = useState<ActiveGoal[]>([])
  const [capacitySchedule, setCapacitySchedule] = useState<CapacitySchedule | null>(null)
  const [weeklyCapacity, setWeeklyCapacity] = useState(0)
  const [insight, setInsight]               = useState<InsightTemplate | null>(null)
  const [openAccordion, setOpenAccordion]   = useState<number>(0)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: goalsData }, { data: profileData }] = await Promise.all([
        supabase.from('goals').select('text, category').eq('user_id', user.id).eq('status', 'active').order('priority'),
        supabase.from('profiles').select('capacity_schedule, weekly_capacity, work_schedule').eq('id', user.id).single(),
      ])

      const activeGoals: ActiveGoal[] = goalsData || []
      setGoals(activeGoals)

      let cap = 0
      let cs: CapacitySchedule | null = null
      let primaryTimeOfDay = ''

      if (profileData?.capacity_schedule) {
        cs = profileData.capacity_schedule as CapacitySchedule
        setCapacitySchedule(cs)
        cap = parseFloat(Object.values(cs).reduce((s, d) => s + d.hours, 0).toFixed(1))

        const todCounts: Record<string, number> = {}
        Object.values(cs).forEach(d => { todCounts[d.time_of_day] = (todCounts[d.time_of_day] || 0) + 1 })
        primaryTimeOfDay = Object.entries(todCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
      } else if (profileData?.weekly_capacity) {
        cap = profileData.weekly_capacity
      }

      setWeeklyCapacity(cap)

      setInsight(selectInsight({
        goalCount:       activeGoals.length,
        weeklyCapacity:  cap,
        primaryTimeOfDay,
        employmentType:  profileData?.work_schedule?.employmentType,
      }))
    }
    init()
  }, [])

  const toggle = (i: number) => setOpenAccordion(prev => prev === i ? -1 : i)

  const maxDayHours = capacitySchedule
    ? Math.max(...DAY_KEYS.map(k => capacitySchedule[k]?.hours ?? 0), 1)
    : 1

  const CATEGORY_COLORS: Record<string, string> = {
    Health: '#34C759', Career: '#3B7DFF', Finance: '#FF9500',
    Relationships: '#AF52DE', Learning: '#5856D6', Creative: '#FF2D55',
    Personal: '#8E8E93',
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto', paddingBottom: 48 }}>

      {/* Progress Bar — 6 of 7 filled */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5, 6, 7].map(step => (
          <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: step <= 6 ? '#3B7DFF' : '#D1D1D6' }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 24 }}>Step 6 of 7</p>

      {/* Heading */}
      <h1 style={{ fontSize: 30, fontWeight: 800, color: '#1C1C1E', margin: '0 0 6px' }}>Your First Week</h1>
      <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.5, marginBottom: 28 }}>
        Here&apos;s everything you&apos;ve set up and why it will work.
      </p>

      {/* Accordion 1 — Your Commitment */}
      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #E5E5EA', marginBottom: 10, overflow: 'hidden' }}>
        <button
          onClick={() => toggle(0)}
          style={{
            width: '100%', padding: '16px 18px', background: 'none', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>Your Commitment</p>
          </div>
          <ChevronIcon open={openAccordion === 0} />
        </button>

        {openAccordion === 0 && (
          <div style={{ padding: '0 18px 18px', borderTop: '0.5px solid #F2F2F7' }}>
            {goals.length > 0 ? (
              <>
                <p style={{ fontSize: 13, color: '#8E8E93', margin: '14px 0 10px' }}>Active goals</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {goals.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[g.category] ?? '#3B7DFF', flexShrink: 0 }} />
                      <p style={{ fontSize: 14, color: '#1C1C1E', margin: 0, flex: 1 }}>{g.text}</p>
                      <span style={{ fontSize: 11, color: '#8E8E93', background: '#F2F2F7', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{g.category}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 14, color: '#8E8E93', margin: '14px 0 0' }}>No active goals yet — you can add them from the Goals screen.</p>
            )}

            {weeklyCapacity > 0 && (
              <div style={{ marginTop: 16, background: '#F8F8FC', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 14, color: '#3C3C43', margin: 0 }}>Weekly time committed</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#3B7DFF', margin: 0 }}>{weeklyCapacity}h</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accordion 2 — Why This Works */}
      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #E5E5EA', marginBottom: 10, overflow: 'hidden' }}>
        <button
          onClick={() => toggle(1)}
          style={{
            width: '100%', padding: '16px 18px', background: 'none', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#AF52DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>Why This Works</p>
          </div>
          <ChevronIcon open={openAccordion === 1} />
        </button>

        {openAccordion === 1 && insight && (
          <div style={{ padding: '0 18px 18px', borderTop: '0.5px solid #F2F2F7' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '16px 0 8px' }}>{insight.title}</p>
            <p style={{ fontSize: 14, color: '#3C3C43', lineHeight: 1.6, margin: 0 }}>{insight.body}</p>
          </div>
        )}
      </div>

      {/* Accordion 3 — Your Week at a Glance */}
      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #E5E5EA', marginBottom: 28, overflow: 'hidden' }}>
        <button
          onClick={() => toggle(2)}
          style={{
            width: '100%', padding: '16px 18px', background: 'none', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FFF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>Your Week at a Glance</p>
          </div>
          <ChevronIcon open={openAccordion === 2} />
        </button>

        {openAccordion === 2 && (
          <div style={{ padding: '0 18px 18px', borderTop: '0.5px solid #F2F2F7' }}>
            {capacitySchedule ? (
              <>
                <p style={{ fontSize: 13, color: '#8E8E93', margin: '14px 0 12px' }}>Hours available per day</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DAY_KEYS.map((key, i) => {
                    const hours = capacitySchedule[key]?.hours ?? 0
                    const tod   = capacitySchedule[key]?.time_of_day ?? ''
                    const pct   = Math.round((hours / maxDayHours) * 100)
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#3C3C43', width: 28, flexShrink: 0 }}>{DAY_LABELS[i]}</span>
                        <div style={{ flex: 1, background: '#F2F2F7', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#3B7DFF', borderRadius: 4, transition: 'width 0.3s ease' }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#3C3C43', width: 32, textAlign: 'right', flexShrink: 0 }}>{hours}h</span>
                        {tod && (
                          <span style={{ fontSize: 11, color: '#8E8E93', width: 60, flexShrink: 0 }}>
                            {tod.charAt(0).toUpperCase() + tod.slice(1)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 14, color: '#8E8E93', margin: '14px 0 0' }}>
                {weeklyCapacity > 0
                  ? `You've committed ${weeklyCapacity}h per week to your goals.`
                  : 'Add your capacity in Settings to see your weekly schedule here.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push('/onboarding/username')}
        style={{
          width: '100%', padding: '17px', background: '#3B7DFF', border: 'none',
          borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Continue
      </button>
    </div>
  )
}
