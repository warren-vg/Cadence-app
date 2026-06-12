'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TimeOfDay = 'morning' | 'afternoon' | 'night'

type DayCapacity = {
  hours: number
  time_of_day: TimeOfDay
}

type CapacitySchedule = {
  monday: DayCapacity
  tuesday: DayCapacity
  wednesday: DayCapacity
  thursday: DayCapacity
  friday: DayCapacity
  saturday: DayCapacity
  sunday: DayCapacity
}

const DAYS: { key: keyof CapacitySchedule; label: string }[] = [
  { key: 'monday',    label: 'Mon' },
  { key: 'tuesday',   label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday',  label: 'Thu' },
  { key: 'friday',    label: 'Fri' },
  { key: 'saturday',  label: 'Sat' },
  { key: 'sunday',    label: 'Sun' },
]

const DEFAULT_SCHEDULE: CapacitySchedule = {
  monday:    { hours: 2, time_of_day: 'morning' },
  tuesday:   { hours: 2, time_of_day: 'morning' },
  wednesday: { hours: 2, time_of_day: 'morning' },
  thursday:  { hours: 2, time_of_day: 'morning' },
  friday:    { hours: 2, time_of_day: 'morning' },
  saturday:  { hours: 3, time_of_day: 'afternoon' },
  sunday:    { hours: 3, time_of_day: 'afternoon' },
}

function MorningIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 18a5 5 0 0 0-10 0"/>
      <line x1="12" y1="2" x2="12" y2="9"/>
      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/>
      <line x1="1" y1="18" x2="3" y2="18"/>
      <line x1="21" y1="18" x2="23" y2="18"/>
      <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/>
    </svg>
  )
}

function AfternoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/>
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="4" y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="6.34" y1="17.66" x2="4.93" y2="19.07"/>
      <line x1="19.07" y1="4.93" x2="17.66" y2="6.34"/>
    </svg>
  )
}

function NightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function GoalsCapacityPage() {
  const router = useRouter()
  const [schedule, setSchedule] = useState<CapacitySchedule>(DEFAULT_SCHEDULE)
  const [isOnboarded, setIsOnboarded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('capacity_schedule, onboarding_complete')
        .eq('id', user.id)
        .single()
      if (profile?.onboarding_complete) setIsOnboarded(true)
      if (profile?.capacity_schedule) setSchedule(profile.capacity_schedule as CapacitySchedule)
    }
    load()
  }, [])

  const totalHours = DAYS.reduce((sum, d) => sum + (schedule[d.key]?.hours || 0), 0)

  const updateHours = (day: keyof CapacitySchedule, raw: string) => {
    const val = parseInt(raw, 10)
    const hours = isNaN(val) ? 0 : Math.max(0, Math.min(24, val))
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], hours } }))
  }

  const updateTimeOfDay = (day: keyof CapacitySchedule, time_of_day: TimeOfDay) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], time_of_day } }))
  }

  const saveAndNavigate = async (scheduleToSave: CapacitySchedule) => {
    setSaving(true)
    try {
      const weeklyCapacity = DAYS.reduce((sum, d) => sum + (scheduleToSave[d.key]?.hours || 0), 0)
      sessionStorage.setItem('onboarding_capacity', JSON.stringify(scheduleToSave))
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({
          capacity_schedule: scheduleToSave,
          weekly_capacity: weeklyCapacity,
        }).eq('id', user.id)
      }
      router.push(isOnboarded ? '/dashboard/settings' : '/onboarding/energy')
    } catch (err) {
      console.error('Capacity save error:', err)
      setSaving(false)
    }
  }

  const handleContinue = () => saveAndNavigate(schedule)

  const handleUseDefaults = () => {
    setSchedule(DEFAULT_SCHEDULE)
    saveAndNavigate(DEFAULT_SCHEDULE)
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>

      {/* Back */}
      <button
        onClick={() => router.push('/onboarding/work-schedule')}
        style={{
          background: 'none', border: 'none', fontSize: 16, color: '#3C3C43',
          cursor: 'pointer', padding: 0, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Back
      </button>

      {/* Progress bar — 6 steps, first 3 filled */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5, 6].map(step => (
          <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: step <= 3 ? '#3B7DFF' : '#D1D1D6' }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 20 }}>Step 3 of 6</p>

      {/* Heading */}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: '0 0 6px' }}>
        Goals Capacity
      </h1>
      <p style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.5, margin: '0 0 24px' }}>
        How much time can you dedicate to your goals each day?
      </p>

      {/* Weekly Capacity summary card */}
      <div style={{
        background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
        borderRadius: 18, padding: '18px 20px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Weekly Capacity</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: '2px 0 0' }}>
            {totalHours.toFixed(1)} hours
          </p>
        </div>
      </div>

      {/* Day cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {DAYS.map(({ key, label }) => {
          const day = schedule[key]
          return (
            <div
              key={key}
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '16px 18px',
                border: '0.5px solid #E5E5EA',
              }}
            >
              {/* Day name + hours input */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>{label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={day.hours}
                    onChange={e => updateHours(key, e.target.value)}
                    style={{
                      width: 52,
                      padding: '8px 0',
                      borderRadius: 10,
                      border: '0.5px solid #D1D1D6',
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#1C1C1E',
                      textAlign: 'center',
                      background: '#F8F8FC',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>hours</p>
                </div>
              </div>

              {/* Time-of-day pill row */}
              <div style={{ display: 'flex', gap: 8 }}>
                {(['morning', 'afternoon', 'night'] as TimeOfDay[]).map(tod => {
                  const selected = day.time_of_day === tod
                  return (
                    <button
                      key={tod}
                      onClick={() => updateTimeOfDay(key, tod)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 4px',
                        borderRadius: 20,
                        border: selected ? 'none' : '0.5px solid #E5E5EA',
                        background: selected ? '#3B7DFF' : 'white',
                        color: selected ? 'white' : '#8E8E93',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {tod === 'morning' && <MorningIcon />}
                      {tod === 'afternoon' && <AfternoonIcon />}
                      {tod === 'night' && <NightIcon />}
                      {tod.charAt(0).toUpperCase() + tod.slice(1)}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tip banner */}
      <div style={{
        background: '#EFF6FF',
        border: '1px solid #DBEAFE',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 32,
      }}>
        <p style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 1.5, margin: 0 }}>
          <strong>Tip:</strong> Be realistic with your time. It&apos;s better to commit to 1-2 hours daily and build consistency than to overcommit.
        </p>
      </div>

      {/* Continue CTA */}
      <button
        onClick={handleContinue}
        disabled={saving}
        style={{
          width: '100%', padding: '15px', borderRadius: 14, border: 'none',
          background: '#3B7DFF', color: 'white',
          fontSize: 15, fontWeight: 600,
          cursor: saving ? 'default' : 'pointer',
          fontFamily: 'inherit',
          opacity: saving ? 0.6 : 1,
          marginBottom: 16,
        }}
      >
        Continue
      </button>

      {/* Use suggested defaults link */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleUseDefaults}
          disabled={saving}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: '#3B7DFF', fontFamily: 'inherit',
          }}
        >
          Use suggested defaults
        </button>
      </div>
    </div>
  )
}
