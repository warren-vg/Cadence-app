'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const EMPLOYMENT_TYPES = [
  { id: 'full-time',        label: 'Full-time' },
  { id: 'part-time',        label: 'Part-time' },
  { id: 'self-employed',    label: 'Self-employed' },
  { id: 'not-working',      label: 'Not working / Student' },
] as const

const WORK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const TIMEZONE_DISPLAY: Record<string, string> = {
  'America/New_York':    'Eastern Time (ET)',
  'America/Chicago':     'Central Time (CT)',
  'America/Denver':      'Mountain Time (MT)',
  'America/Los_Angeles': 'Pacific Time (PT)',
  'America/Anchorage':   'Alaska Time (AKT)',
  'Pacific/Honolulu':    'Hawaii Time (HT)',
  'Europe/London':       'Greenwich Mean Time (GMT)',
  'Europe/Paris':        'Central European Time (CET)',
  'Asia/Tokyo':          'Japan Standard Time (JST)',
  'Australia/Sydney':    'Australian Eastern Time (AET)',
}

type EmploymentType = 'full-time' | 'part-time' | 'self-employed' | 'not-working'

export default function WorkSchedulePage() {
  const router = useRouter()
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full-time')
  const [workDays, setWorkDays]             = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [startTime, setStartTime]           = useState('09:00')
  const [endTime, setEndTime]               = useState('17:00')
  const [timezone, setTimezone]             = useState('America/New_York')
  const [timeError, setTimeError]           = useState('')

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected) setTimezone(detected)
  }, [])

  const toggleDay = (day: string) => {
    setWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const tzLabel = TIMEZONE_DISPLAY[timezone] || timezone

  const handleContinue = () => {
    if (employmentType !== 'not-working') {
      if (workDays.length === 0) { setTimeError('Please select at least one work day.'); return }
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      if (eh * 60 + em <= sh * 60 + sm) {
        setTimeError('End time must be after start time.')
        return
      }
    }
    setTimeError('')

    const schedule = {
      employmentType,
      workDays:      employmentType === 'not-working' ? [] : workDays,
      workStartTime: employmentType === 'not-working' ? null : startTime,
      workEndTime:   employmentType === 'not-working' ? null : endTime,
      timezone,
    }
    sessionStorage.setItem('onboarding_work_schedule', JSON.stringify(schedule))
    router.push('/onboarding/energy')
  }

  const noWork = employmentType === 'not-working'

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>

      {/* Back */}
      <button
        onClick={() => router.push('/onboarding/goals')}
        style={{ background: 'none', border: 'none', fontSize: 16, color: '#3C3C43', cursor: 'pointer', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        ← Back
      </button>

      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map(step => (
          <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: step <= 2 ? '#3B7DFF' : '#D1D1D6' }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 20 }}>Step 2 of 5</p>

      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Your Work Schedule</h1>
      <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.5, marginBottom: 24 }}>
        So we never schedule personal goals during your work hours.
      </p>

      {/* Employment Type */}
      <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '0.5px solid #D1D1D6' }}>
        <p style={{ fontSize: 14, color: '#8E8E93', marginBottom: 12 }}>I am currently</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {EMPLOYMENT_TYPES.map(et => (
            <button
              key={et.id}
              onClick={() => setEmploymentType(et.id)}
              style={{
                padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                border: 'none', fontSize: 14, fontWeight: employmentType === et.id ? 700 : 400,
                background: employmentType === et.id ? '#3B7DFF' : '#F2F2F7',
                color:      employmentType === et.id ? 'white'   : '#3C3C43',
              }}
            >
              {et.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work Days */}
      {!noWork && (
        <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '0.5px solid #D1D1D6' }}>
          <p style={{ fontSize: 14, color: '#8E8E93', marginBottom: 12 }}>Work days</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {WORK_DAYS.map(day => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  border: 'none', fontSize: 13, fontWeight: 600,
                  background: workDays.includes(day) ? '#3B7DFF' : '#F2F2F7',
                  color:      workDays.includes(day) ? 'white'   : '#8E8E93',
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Work Hours */}
      {!noWork && (
        <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 16, border: '0.5px solid #D1D1D6' }}>
          <p style={{ fontSize: 14, color: '#8E8E93', marginBottom: 12 }}>Work hours</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, color: '#8E8E93', marginBottom: 4 }}>From</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8F8FC', borderRadius: 10, padding: '10px 12px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', flex: 1 }}
                />
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            <div>
              <p style={{ fontSize: 11, color: '#8E8E93', marginBottom: 4 }}>To</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8F8FC', borderRadius: 10, padding: '10px 12px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: '#1C1C1E', fontFamily: 'inherit', outline: 'none', flex: 1 }}
                />
              </div>
            </div>
          </div>
          {timeError && (
            <p style={{ fontSize: 12, color: '#FF3B30', marginTop: 8, margin: '8px 0 0' }}>{timeError}</p>
          )}
        </div>
      )}

      {/* Timezone */}
      <div style={{ background: 'white', borderRadius: 16, padding: '16px', marginBottom: 32, border: '0.5px solid #D1D1D6' }}>
        <p style={{ fontSize: 14, color: '#8E8E93', marginBottom: 12 }}>Your timezone</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8F8FC', borderRadius: 10, padding: '12px 14px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          <span style={{ fontSize: 14, color: '#1C1C1E', fontWeight: 500 }}>{tzLabel}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => { sessionStorage.removeItem('onboarding_work_schedule'); router.push('/onboarding/energy') }}
          style={{ flex: 1, padding: '16px', background: 'white', border: '0.5px solid #D1D1D6', borderRadius: 16, fontSize: 16, fontWeight: 500, color: '#3C3C43', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Skip for now
        </button>
        <button
          onClick={handleContinue}
          style={{ flex: 2, padding: '16px', background: '#3B7DFF', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
