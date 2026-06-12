'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getNotifications, getUnreadCount,
  markNotificationRead, markAllNotificationsRead,
  type DBNotification,
} from '@/lib/db'

// ─── Icon map ────────────────────────────────────────────────────────────────

const ICON_CONFIG: Record<string, { bg: string; stroke: string }> = {
  sunrise:   { bg: '#FFF7ED', stroke: '#FF9500' },
  calendar:  { bg: '#EFF6FF', stroke: '#3B7DFF' },
  flame:     { bg: '#FFF7ED', stroke: '#FF3B30' },
  lightbulb: { bg: '#FDF4FF', stroke: '#AF52DE' },
  target:    { bg: '#F0FFF4', stroke: '#16A34A' },
  chart:     { bg: '#EFF6FF', stroke: '#3B7DFF' },
}

function NotifIconSvg({ iconKey }: { iconKey: string | null }) {
  const k = iconKey ?? 'calendar'
  const cfg = ICON_CONFIG[k] ?? ICON_CONFIG.calendar
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      background: cfg.bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {k === 'sunrise' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cfg.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 18a5 5 0 00-10 0"/><line x1="12" y1="2" x2="12" y2="9"/>
          <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/>
          <line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/>
        </svg>
      )}
      {k === 'calendar' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cfg.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )}
      {k === 'flame' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cfg.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z"/>
        </svg>
      )}
      {k === 'lightbulb' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cfg.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/>
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8A6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/>
        </svg>
      )}
      {k === 'target' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cfg.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
      )}
      {k === 'chart' && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cfg.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
          <polyline points="16 7 22 7 22 13"/>
        </svg>
      )}
    </div>
  )
}

function relativeTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationBell({ floating = false }: { floating?: boolean }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [userId, setUserId]           = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen]               = useState(false)
  const [notifications, setNotifications] = useState<DBNotification[]>([])

  // All hooks must be declared before any conditional return (Rules of Hooks).
  const refreshCount = useCallback(async (uid: string) => {
    const count = await getUnreadCount(uid)
    setUnreadCount(count)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      await refreshCount(user.id)
    }
    init()
  }, [refreshCount])

  // Poll every 60 s
  useEffect(() => {
    if (!userId) return
    const id = setInterval(() => refreshCount(userId), 60000)
    return () => clearInterval(id)
  }, [userId, refreshCount])

  // Floating mode: don't render on home (bell is inline in the header there)
  if (floating && pathname === '/dashboard') return null

  const handleOpen = async () => {
    if (!userId) return
    setOpen(true)
    const notifs = await getNotifications(userId)
    setNotifications(notifs)
  }

  const handleClose = () => setOpen(false)

  const handleMarkAllRead = async () => {
    if (!userId) return
    await markAllNotificationsRead(userId)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const handleTap = async (notif: DBNotification) => {
    if (!userId) return
    if (!notif.read) {
      await markNotificationRead(notif.id, userId)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
    if (notif.action_url) {
      setOpen(false)
      router.push(notif.action_url)
    }
  }

  const bellBtn = (
    <button
      onClick={handleOpen}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 4, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      aria-label="Notifications"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
      {unreadCount > 0 && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          minWidth: 17, height: 17, borderRadius: '50%',
          background: '#FF3B30',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: 'white', lineHeight: 1,
          pointerEvents: 'none',
        }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </div>
      )}
    </button>
  )

  const panel = open && (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 200,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '85%', maxWidth: 420,
        background: 'white', zIndex: 201,
        display: 'flex', flexDirection: 'column',
        transform: 'translateX(0)',
        animation: 'slideInRight 0.25s ease-out',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '56px 18px 16px',
          borderBottom: '0.5px solid #E5E5EA', flexShrink: 0,
        }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Notifications</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {notifications.some(n => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#3B7DFF', fontFamily: 'inherit', padding: 0 }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={handleClose}
              style={{
                background: '#F2F2F7', border: 'none', borderRadius: '50%',
                width: 30, height: 30, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: '0 0 6px' }}>You&apos;re all caught up</p>
              <p style={{ fontSize: 13, color: '#8E8E93', margin: 0 }}>No notifications yet.</p>
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => handleTap(notif)}
                style={{
                  display: 'flex', gap: 12, padding: '14px 16px',
                  borderBottom: '0.5px solid #F2F2F7',
                  borderLeft: notif.read ? '3px solid transparent' : '3px solid #3B7DFF',
                  cursor: 'pointer', background: 'white',
                }}
              >
                <NotifIconSvg iconKey={notif.icon_key} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: '0 0 3px' }}>
                    {notif.title}
                  </p>
                  <p style={{
                    fontSize: 13, color: '#3C3C43', margin: '0 0 4px',
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {notif.message}
                  </p>
                  <p style={{ fontSize: 12, color: '#8E8E93', margin: 0 }}>{relativeTime(notif.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '0.5px solid #E5E5EA', flexShrink: 0 }}>
          <button
            onClick={() => { setOpen(false); router.push('/dashboard/settings') }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', background: '#F8F8FC', border: '0.5px solid #E5E5EA',
              borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: '#1C1C1E' }}>Notification Preferences</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  )

  if (floating) {
    return (
      <>
        <div style={{ position: 'fixed', top: 60, right: 16, zIndex: 150 }}>
          {bellBtn}
        </div>
        {panel}
      </>
    )
  }

  return (
    <>
      {bellBtn}
      {panel}
    </>
  )
}
