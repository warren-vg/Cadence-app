'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  checkUsernameAvailable,
  setUsername as saveUsername,
  canChangeUsername,
  generateUsernameSuggestions,
} from '@/lib/db'
import { useTour } from '../components/TourContext'

interface Profile {
  id: string
  full_name: string
  username: string | null
  email: string
  avatar_url: string | null
}

// ─── Username modal validation (mirrors onboarding/username logic) ────────────
type UsernameCheckStatus =
  | 'idle' | 'checking' | 'available' | 'taken' | 'reserved'
  | 'too_short' | 'too_long' | 'bad_format'

function usernameClientValidate(v: string): UsernameCheckStatus | null {
  if (!v) return 'idle'
  if (v.length < 3) return 'too_short'
  if (v.length > 20) return 'too_long'
  if (!/^[a-zA-Z]/.test(v)) return 'bad_format'
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'bad_format'
  return null
}

interface UsernameStatusUI {
  borderColor: string
  icon: 'none' | 'check' | 'x' | 'warning' | 'spinner'
  bannerBg: string; bannerBorder: string; bannerText: string; bannerColor: string
}

function getUsernameUI(status: UsernameCheckStatus, value: string): UsernameStatusUI {
  switch (status) {
    case 'available': return { borderColor: '#16A34A', icon: 'check', bannerBg: '#F0FFF4', bannerBorder: '#BBF7D0', bannerText: '✓ Available — looks great!', bannerColor: '#16A34A' }
    case 'taken':     return { borderColor: '#DC2626', icon: 'x', bannerBg: '#FFF5F5', bannerBorder: '#FECACA', bannerText: 'Already taken — try another', bannerColor: '#DC2626' }
    case 'reserved':  return { borderColor: '#DC2626', icon: 'x', bannerBg: '#FFF5F5', bannerBorder: '#FECACA', bannerText: 'Reserved — try another', bannerColor: '#DC2626' }
    case 'too_short': return { borderColor: '#FF9500', icon: 'warning', bannerBg: '#FFF7ED', bannerBorder: '#FED7AA', bannerText: 'Too short — minimum 3 characters', bannerColor: '#D97706' }
    case 'too_long':  return { borderColor: '#DC2626', icon: 'x', bannerBg: '#FFF5F5', bannerBorder: '#FECACA', bannerText: 'Too long — maximum 20 characters', bannerColor: '#DC2626' }
    case 'bad_format': return { borderColor: '#DC2626', icon: 'x', bannerBg: '#FFF5F5', bannerBorder: '#FECACA', bannerText: !/^[a-zA-Z]/.test(value) ? 'Must start with a letter' : 'Only letters, numbers, and underscores', bannerColor: '#DC2626' }
    case 'checking':  return { borderColor: '#D1D1D6', icon: 'spinner', bannerBg: '', bannerBorder: '', bannerText: '', bannerColor: '' }
    default:          return { borderColor: '#D1D1D6', icon: 'none', bannerBg: '', bannerBorder: '', bannerText: '', bannerColor: '' }
  }
}

interface NotificationPrefs {
  weeklyReviewReminder: boolean
  dailyPlanReminder: boolean
  goalProgressUpdates: boolean
  friendActivity: boolean
}

interface InAppNotifPrefs {
  morning_touchpoint: boolean
  weekly_review: boolean
  streak_milestone: boolean
  ai_insight: boolean
  goal_progress: boolean
  monthly_snapshot: boolean
}

type ThemeOption = 'automatic' | 'light' | 'dark'

const DEFAULT_NOTIFS: NotificationPrefs = {
  weeklyReviewReminder: true, dailyPlanReminder: true, goalProgressUpdates: false, friendActivity: true,
}

const DEFAULT_IN_APP_PREFS: InAppNotifPrefs = {
  morning_touchpoint: true,
  weekly_review:      true,
  streak_milestone:   true,
  ai_insight:         true,
  goal_progress:      true,
  monthly_snapshot:   true,
}

function loadTheme(): ThemeOption {
  try {
    const t = localStorage.getItem('cadence_theme')
    if (t === 'light' || t === 'dark' || t === 'automatic') return t
  } catch { /* ignore */ }
  return 'automatic'
}

function saveTheme(t: ThemeOption) {
  try { localStorage.setItem('cadence_theme', t) } catch { /* ignore */ }
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 50, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer',
        background: on ? '#34C759' : '#E5E5EA',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        padding: 0,
      }}
      aria-checked={on}
      role="switch"
    >
      <div style={{
        width: 26, height: 26, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 2, left: on ? 22 : 2,
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, margin: '24px 0 8px 4px' }}>
      {label}
    </p>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'white', borderRadius: 16, border: '0.5px solid #E5E5EA',
      overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  )
}

function RowItem({
  icon, label, sublabel, right, onClick, danger, noBorder,
}: {
  icon?: React.ReactNode
  label: string
  sublabel?: string
  right?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  noBorder?: boolean
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 16px',
        borderBottom: noBorder ? 'none' : '0.5px solid #F2F2F7',
        cursor: onClick ? 'pointer' : 'default',
        background: 'white',
      }}
    >
      {icon && (
        <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: danger ? '#FF3B30' : '#1C1C1E', margin: 0 }}>{label}</p>
        {sublabel && <p style={{ fontSize: 12, color: '#8E8E93', margin: '2px 0 0' }}>{sublabel}</p>}
      </div>
      {right}
    </div>
  )
}

function ChevronRight({ color = '#C7C7CC' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { startTour } = useTour()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFS)
  const [notifPrefs, setNotifPrefs]       = useState<InAppNotifPrefs>(DEFAULT_IN_APP_PREFS)
  const [theme, setTheme] = useState<ThemeOption>('automatic')
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)
  // Username
  const [currentUsername, setCurrentUsername] = useState<string | null>(null)
  const [usernameAllowed, setUsernameAllowed]   = useState(true)
  const [usernameNextChange, setUsernameNextChange] = useState<Date | null>(null)
  const [showUsernameModal, setShowUsernameModal]   = useState(false)
  const [modalValue, setModalValue]           = useState('')
  const [modalStatus, setModalStatus]         = useState<UsernameCheckStatus>('idle')
  const [modalSuggestions, setModalSuggestions] = useState<string[]>([])
  const [modalLoadingSuggs, setModalLoadingSuggs] = useState(false)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const modalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
    setTheme(loadTheme())

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, notifications, notification_preferences')
        .eq('id', user.id)
        .single()

      const displayName = data?.full_name || ''
      const handle      = data?.username   || null

      setProfile({ id: user.id, full_name: displayName, username: handle, email: user.email || '', avatar_url: data?.avatar_url || null })
      setName(displayName)
      setSavedName(displayName)
      setCurrentUsername(handle)
      setNotifications((data?.notifications as NotificationPrefs | null) ?? DEFAULT_NOTIFS)
      setNotifPrefs((data?.notification_preferences as InAppNotifPrefs | null) ?? DEFAULT_IN_APP_PREFS)

      if (handle) {
        const cooldown = await canChangeUsername(user.id)
        setUsernameAllowed(cooldown.allowed)
        setUsernameNextChange(cooldown.nextChangeDate)
      }

      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({ full_name: name.trim(), notifications, notification_preferences: notifPrefs }).eq('id', profile.id)
      saveTheme(theme)
      setName(name.trim())
      setSavedName(name.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleEditUsername = useCallback(async () => {
    if (!usernameAllowed) {
      const dateStr = usernameNextChange?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) ?? ''
      showToast(`Username can be changed again on ${dateStr}`)
      return
    }
    const firstName = (name || '').split(' ')[0] || 'user'
    setModalValue('')
    setModalStatus('idle')
    setShowUsernameModal(true)
    setModalLoadingSuggs(true)
    const s = await generateUsernameSuggestions(firstName)
    setModalSuggestions(s)
    setModalLoadingSuggs(false)
  }, [usernameAllowed, usernameNextChange, name, currentUsername])

  const handleModalChange = useCallback((raw: string) => {
    const v = raw.replace(/\s/g, '')
    setModalValue(v)
    if (modalDebounceRef.current) clearTimeout(modalDebounceRef.current)
    const local = usernameClientValidate(v)
    if (local !== null) { setModalStatus(local); return }
    setModalStatus('checking')
    modalDebounceRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(v)
      if (result.available) {
        setModalStatus('available')
      } else {
        const next = result.reason === 'reserved' ? 'reserved' : 'taken'
        setModalStatus(next)
        if (next === 'taken') {
          setModalLoadingSuggs(true)
          const firstName = (name || '').split(' ')[0] || 'user'
          const fresh = await generateUsernameSuggestions(firstName)
          setModalSuggestions(fresh)
          setModalLoadingSuggs(false)
        }
      }
    }, 300)
  }, [name])

  const handleModalChip = useCallback((chip: string) => {
    setModalValue(chip)
    if (modalDebounceRef.current) clearTimeout(modalDebounceRef.current)
    setModalStatus('checking')
    modalDebounceRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(chip)
      setModalStatus(result.available ? 'available' : (result.reason === 'reserved' ? 'reserved' : 'taken'))
    }, 100)
  }, [])

  const handleModalSave = async () => {
    if (!profile || modalStatus !== 'available' || modalSubmitting) return
    setModalSubmitting(true)
    const ok = await saveUsername(profile.id, modalValue)
    if (!ok) { setModalSubmitting(false); return }
    setCurrentUsername(modalValue)
    setUsernameAllowed(false)
    const next = new Date(); next.setDate(next.getDate() + 30)
    setUsernameNextChange(next)
    setShowUsernameModal(false)
    setModalSubmitting(false)
    showToast(`Username updated to @${modalValue}`)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleExportData = async () => {
    if (!profile) return
    const uid = profile.id
    const [
      { data: goals },
      { data: tasks },
      { data: projects },
      { data: scheduleItems },
      { data: quarterlyReviews },
    ] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', uid),
      supabase.from('tasks').select('*').eq('user_id', uid),
      supabase.from('projects').select('*').eq('user_id', uid),
      supabase.from('schedule_items').select('*').eq('user_id', uid),
      supabase.from('quarterly_reviews').select('*').eq('user_id', uid),
    ])
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: { name, email: profile.email },
      goals: goals || [],
      tasks: tasks || [],
      projects: projects || [],
      scheduleItems: scheduleItems || [],
      quarterlyReviews: quarterlyReviews || [],
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cadence-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleNotif = (key: keyof NotificationPrefs) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleInAppNotif = (key: keyof InAppNotifPrefs) => {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const themeLabel = theme === 'automatic' ? 'Automatic' : theme === 'light' ? 'Light' : 'Dark'
  const initials = name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'

  if (!mounted || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8E8E93', fontSize: 15 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '56px 16px 32px', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>More</h1>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>Quick access and settings</p>
        </div>
      </div>

      {/* Avatar + name preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0 8px' }}>
        <div style={{
          width: 58, height: 58, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{initials}</span>
        </div>
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>{name || 'Your Name'}</p>
          <p style={{ fontSize: 13, color: '#8E8E93', margin: '2px 0 0' }}>{profile?.email}</p>
        </div>
      </div>

      {/* Quick Access */}
      <SectionLabel label="Quick Access" />
      <Card>
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="2" y="15" width="6" height="6" rx="1"/><rect x="10" y="3" width="12" height="6" rx="1"/><rect x="10" y="15" width="12" height="6" rx="1"/></svg>}
          label="Projects"
          sublabel="Manage your campaigns and work"
          right={<ChevronRight />}
          onClick={() => router.push('/dashboard/projects')}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9B59B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
          label="Opportunity Filter"
          sublabel="Evaluate new opportunities"
          right={<ChevronRight />}
          onClick={() => router.push('/dashboard/opportunity')}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
          label="Quarterly Review"
          sublabel="Reflect and pivot"
          right={<ChevronRight />}
          onClick={() => router.push('/dashboard/check-in/quarterly')}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          label="Monthly Snapshots"
          sublabel="Your story, month by month."
          right={<ChevronRight />}
          onClick={() => router.push('/dashboard/snapshots')}
          noBorder
        />
      </Card>

      {/* Profile */}
      <SectionLabel label="Profile" />
      <Card>
        <div style={{ padding: '4px 16px 0' }}>
          {/* Name */}
          <div style={{ padding: '12px 0', borderBottom: '0.5px solid #F2F2F7' }}>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 4px' }}>Name</p>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              style={{
                width: '100%', border: 'none', outline: 'none', fontSize: 15,
                color: '#1C1C1E', background: 'transparent', fontFamily: 'inherit',
                padding: 0,
              }}
            />
          </div>

          {/* Username */}
          <div style={{ padding: '12px 0', borderBottom: '0.5px solid #F2F2F7' }}>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 6px' }}>Username</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                flex: 1, fontSize: 15, color: currentUsername ? '#1C1C1E' : '#C7C7CC',
                background: '#F8F8FC', borderRadius: 10, padding: '10px 12px',
                border: '0.5px solid #E5E5EA',
              }}>
                {currentUsername ? `@${currentUsername}` : 'Not set'}
              </div>
              <button
                onClick={handleEditUsername}
                style={{
                  background: '#EFF6FF', color: '#3B7DFF', border: 'none',
                  borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                Edit
              </button>
            </div>
            {usernameNextChange && (
              <p style={{ fontSize: 12, color: '#8E8E93', margin: '6px 0 0' }}>
                You can change your username again on{' '}
                {usernameNextChange.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Email */}
          <div style={{ padding: '12px 0', borderBottom: '0.5px solid #F2F2F7' }}>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 4px' }}>Email</p>
            <p style={{ fontSize: 15, color: '#3C3C43', margin: 0 }}>{profile?.email}</p>
          </div>

          {/* Save name button — slides in when name is dirty */}
          <div style={{
            overflow: 'hidden',
            maxHeight: name !== savedName ? '62px' : '0',
            opacity: name !== savedName ? 1 : 0,
            transition: 'max-height 0.25s ease, opacity 0.2s ease',
          }}>
            <div style={{ padding: '14px 0 2px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: '100%', background: saved ? '#34C759' : '#3B7DFF',
                  border: 'none', borderRadius: 10, padding: '12px',
                  color: 'white', fontSize: 15, fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.3s',
                }}
              >
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <SectionLabel label="Notifications" />
      <Card>
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
          label="Weekly Review"
          sublabel="Remind me Sunday evenings"
          right={<Toggle on={notifications.weeklyReviewReminder} onToggle={() => toggleNotif('weeklyReviewReminder')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          label="Daily Plan"
          sublabel="Morning reminder to plan my day"
          right={<Toggle on={notifications.dailyPlanReminder} onToggle={() => toggleNotif('dailyPlanReminder')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>}
          label="Goal Progress"
          sublabel="Milestone and progress updates"
          right={<Toggle on={notifications.goalProgressUpdates} onToggle={() => toggleNotif('goalProgressUpdates')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
          label="Friend Activity"
          sublabel="Hypes and nudges from friends"
          right={<Toggle on={notifications.friendActivity} onToggle={() => toggleNotif('friendActivity')} />}
          noBorder
        />
      </Card>

      {/* Notification Preferences (in-app) */}
      <SectionLabel label="Notification Preferences" />
      <Card>
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 00-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/></svg>}
          label="Morning Touchpoint"
          sublabel="Daily check-in nudge"
          right={<Toggle on={notifPrefs.morning_touchpoint} onToggle={() => toggleInAppNotif('morning_touchpoint')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          label="Weekly Review"
          sublabel="End-of-week reflection prompt"
          right={<Toggle on={notifPrefs.weekly_review} onToggle={() => toggleInAppNotif('weekly_review')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z"/></svg>}
          label="Streak Milestones"
          sublabel="Celebrate consistency wins"
          right={<Toggle on={notifPrefs.streak_milestone} onToggle={() => toggleInAppNotif('streak_milestone')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#AF52DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8A6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></svg>}
          label="AI Insights"
          sublabel="Tips from your AI mentor"
          right={<Toggle on={notifPrefs.ai_insight} onToggle={() => toggleInAppNotif('ai_insight')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>}
          label="Goal Progress"
          sublabel="Milestone and completion alerts"
          right={<Toggle on={notifPrefs.goal_progress} onToggle={() => toggleInAppNotif('goal_progress')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
          label="Monthly Snapshot"
          sublabel="When your snapshot is ready"
          right={<Toggle on={notifPrefs.monthly_snapshot} onToggle={() => toggleInAppNotif('monthly_snapshot')} />}
          noBorder
        />
      </Card>

      {/* Daily Touchpoints */}
      <SectionLabel label="Daily Touchpoints" />
      <Card>
        <RowItem
          icon={
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 18a5 5 0 00-10 0"/>
                <line x1="12" y1="2" x2="12" y2="9"/>
                <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/>
                <line x1="1" y1="18" x2="3" y2="18"/>
                <line x1="21" y1="18" x2="23" y2="18"/>
                <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/>
              </svg>
            </div>
          }
          label="Morning"
          sublabel="Today's one thing & day starter"
          right={<ChevronRight />}
          onClick={() => router.push('/dashboard/touchpoint/morning')}
        />
        <RowItem
          icon={
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #48B4E0 0%, #3B7DFF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            </div>
          }
          label="Midday"
          sublabel="Progress check & afternoon focus"
          right={<ChevronRight />}
          onClick={() => router.push('/dashboard/touchpoint/midday')}
        />
        <RowItem
          icon={
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #9333EA 0%, #6B21A8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            </div>
          }
          label="Evening"
          sublabel="Daily reflection & tomorrow's intention"
          right={<ChevronRight />}
          onClick={() => router.push('/dashboard/touchpoint/evening')}
          noBorder
        />
      </Card>

      {/* Appearance */}
      <SectionLabel label="Appearance" />
      <Card>
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
          label="Theme"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, color: '#8E8E93' }}>{themeLabel}</span>
              <ChevronRight />
            </div>
          }
          onClick={() => setShowThemePicker(true)}
          noBorder
        />
      </Card>

      {/* AI Preferences */}
      <SectionLabel label="AI Preferences" />
      <Card>
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9B59B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
          label="Rebuild Priority Stack"
          sublabel="Re-prioritize your goals"
          right={<ChevronRight />}
          onClick={() => router.push('/dashboard/goals')}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
          label="Update Energy Rhythm"
          sublabel="Adjust your daily schedule"
          right={<ChevronRight />}
          onClick={() => router.push('/onboarding/energy')}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          label="Work Schedule"
          sublabel="Set your available working hours"
          right={<ChevronRight />}
          onClick={() => router.push('/onboarding/work-schedule')}
          noBorder
        />
      </Card>

      {/* Help & Tips */}
      <SectionLabel label="Help & Tips" />
      <Card>
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>}
          label="Take the App Tour"
          sublabel="Replay the guided walkthrough"
          right={<ChevronRight />}
          onClick={() => { if (profile?.id) startTour(profile.id, false) }}
          noBorder
        />
      </Card>

      {/* Data & Privacy */}
      <SectionLabel label="Data & Privacy" />
      <Card>
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
          label="Export All Data"
          right={<ChevronRight />}
          onClick={handleExportData}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
          label="Sign Out"
          right={<ChevronRight />}
          onClick={handleSignOut}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
          label="Delete Account"
          danger
          right={<ChevronRight color="#FF3B30" />}
          onClick={() => setShowDeleteConfirm(true)}
          noBorder
        />
      </Card>

      {/* Version */}
      <p style={{ textAlign: 'center', fontSize: 12, color: '#C7C7CC', marginTop: 24 }}>Cadence v1.0.0</p>

      {/* Username edit modal */}
      {showUsernameModal && (() => {
        const ui = getUsernameUI(modalStatus, modalValue)
        const canSave = modalStatus === 'available' && !modalSubmitting
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
            onClick={() => setShowUsernameModal(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', width: '100%', maxWidth: 480 }}
            >
              {/* Drag handle */}
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D1D6', margin: '0 auto 20px' }} />

              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 4px' }}>Edit username</h3>
              <p style={{ fontSize: 13, color: '#8E8E93', margin: '0 0 20px' }}>
                3–20 chars · letters, numbers, underscores · must start with a letter
              </p>

              {/* Input */}
              <div style={{
                background: 'white', borderRadius: 14, padding: '14px',
                border: `1.5px solid ${ui.borderColor}`, transition: 'border-color 0.15s', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#8E8E93', fontSize: 17, fontWeight: 500, flexShrink: 0 }}>@</span>
                  <input
                    type="text" value={modalValue} onChange={e => handleModalChange(e.target.value)}
                    placeholder="your_username" autoComplete="off" autoCapitalize="none" spellCheck={false}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 16, color: '#1C1C1E', fontFamily: 'inherit', padding: '2px 0' }}
                  />
                  {ui.icon === 'check' && (
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="2 6 5 9 10 3" /></svg>
                    </div>
                  )}
                  {ui.icon === 'x' && (
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="3" x2="9" y2="9" /><line x1="9" y1="3" x2="3" y2="9" /></svg>
                    </div>
                  )}
                  {ui.icon === 'warning' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M12 3L2 21h20L12 3z" fill="#FF9500" />
                      <line x1="12" y1="10" x2="12" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="12" cy="18.5" r="1" fill="white" />
                    </svg>
                  )}
                </div>
                {modalValue && ui.bannerText && (
                  <div style={{ background: ui.bannerBg, border: `1px solid ${ui.bannerBorder}`, borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
                    <span style={{ fontSize: 13, color: ui.bannerColor, fontWeight: 500 }}>{ui.bannerText}</span>
                  </div>
                )}
              </div>

              {/* Suggestions */}
              {modalLoadingSuggs ? (
                <p style={{ fontSize: 13, color: '#C7C7CC', marginBottom: 20 }}>Finding available names…</p>
              ) : modalSuggestions.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>✦</span> Try these suggestions
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {modalSuggestions.map(s => (
                      <button key={s} onClick={() => handleModalChip(s)} style={{ background: '#EFF6FF', color: '#3B7DFF', border: '1px solid #DBEAFE', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                        @{s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleModalSave} disabled={!canSave}
                style={{
                  width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                  background: canSave ? 'linear-gradient(135deg, #3B7DFF 0%, #9333EA 100%)' : '#D1D1D6',
                  color: 'white', fontSize: 15, fontWeight: 600,
                  cursor: canSave ? 'pointer' : 'default', fontFamily: 'inherit',
                  opacity: modalSubmitting ? 0.7 : 1,
                }}
              >
                {modalSubmitting ? 'Saving…' : 'Save Username'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: '#1C1C1E', color: 'white', padding: '12px 20px', borderRadius: 12,
          fontSize: 14, fontWeight: 500, zIndex: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)',
        }}>
          {toast}
        </div>
      )}

      {/* Theme Picker Modal */}
      {showThemePicker && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200,
          }}
          onClick={() => setShowThemePicker(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px', width: '100%', maxWidth: 480 }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D1D6', margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 16px' }}>Appearance</h3>
            {(['automatic', 'light', 'dark'] as ThemeOption[]).map(opt => (
              <button
                key={opt}
                onClick={() => { setTheme(opt); setShowThemePicker(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '14px 16px', marginBottom: 8,
                  borderRadius: 12, border: theme === opt ? '2px solid #3B7DFF' : '2px solid #F2F2F7',
                  background: theme === opt ? '#EFF6FF' : 'white', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E', textTransform: 'capitalize' }}>{opt}</span>
                {theme === opt && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '0 24px',
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>Delete Account?</h3>
              <p style={{ fontSize: 14, color: '#8E8E93', margin: 0, lineHeight: 1.5 }}>
                This will permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #E5E5EA',
                  background: 'white', fontSize: 15, fontWeight: 600, color: '#1C1C1E',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!profile) return
                  try {
                    await fetch('/api/delete-account', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: profile.id }),
                    })
                  } catch { /* ignore — sign out regardless */ }
                  await supabase.auth.signOut()
                  router.push('/login')
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                  background: '#FF3B30', fontSize: 15, fontWeight: 700, color: 'white',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
