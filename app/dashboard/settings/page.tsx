'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string
  username: string
  email: string
  avatar_url: string | null
}

interface NotificationPrefs {
  weeklyReviewReminder: boolean
  dailyPlanReminder: boolean
  goalProgressUpdates: boolean
}

type ThemeOption = 'automatic' | 'light' | 'dark'

const PREFS_KEY = 'cadence_settings_prefs'

function loadPrefs(): { notifications: NotificationPrefs; theme: ThemeOption } {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {
    notifications: { weeklyReviewReminder: true, dailyPlanReminder: true, goalProgressUpdates: false },
    theme: 'automatic',
  }
}

function savePrefs(prefs: { notifications: NotificationPrefs; theme: ThemeOption }) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
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
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    weeklyReviewReminder: true, dailyPlanReminder: true, goalProgressUpdates: false,
  })
  const [theme, setTheme] = useState<ThemeOption>('automatic')
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prefs = loadPrefs()
    setNotifications(prefs.notifications)
    setTheme(prefs.theme)

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', user.id)
        .single()

      setProfile({ id: user.id, username: data?.username || '', email: user.email || '', avatar_url: data?.avatar_url || null })
      setName(data?.username || '')
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({ username: name.trim() }).eq('id', profile.id)
      savePrefs({ notifications, theme })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleExportData = async () => {
    if (!profile) return
    const { data: goals } = await supabase.from('goals').select('*').eq('user_id', profile.id)
    const blob = new Blob([JSON.stringify({ profile: { name, email: profile.email }, goals }, null, 2)], { type: 'application/json' })
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
          noBorder
        />
      </Card>

      {/* Profile */}
      <SectionLabel label="Profile" />
      <Card>
        <div style={{ padding: '4px 16px 0' }}>
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
          <div style={{ padding: '12px 0' }}>
            <p style={{ fontSize: 12, color: '#8E8E93', margin: '0 0 4px' }}>Email</p>
            <p style={{ fontSize: 15, color: '#3C3C43', margin: 0 }}>{profile?.email}</p>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <SectionLabel label="Notifications" />
      <Card>
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
          label="Weekly Review Reminder"
          sublabel="Sunday evenings at 6 PM"
          right={<Toggle on={notifications.weeklyReviewReminder} onToggle={() => toggleNotif('weeklyReviewReminder')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          label="Daily Plan Reminder"
          sublabel="Every morning at 8 AM"
          right={<Toggle on={notifications.dailyPlanReminder} onToggle={() => toggleNotif('dailyPlanReminder')} />}
        />
        <RowItem
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>}
          label="Goal Progress Updates"
          sublabel="When milestones are reached"
          right={<Toggle on={notifications.goalProgressUpdates} onToggle={() => toggleNotif('goalProgressUpdates')} />}
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

      {/* Save Changes */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', marginTop: 32,
          background: saved ? '#34C759' : '#3B7DFF',
          border: 'none', borderRadius: 14, padding: '15px',
          color: 'white', fontSize: 16, fontWeight: 700,
          cursor: saving ? 'default' : 'pointer',
          fontFamily: 'inherit', transition: 'background 0.3s',
        }}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
      </button>

      {/* Version */}
      <p style={{ textAlign: 'center', fontSize: 12, color: '#C7C7CC', marginTop: 20 }}>Cadence v1.0.0</p>

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
