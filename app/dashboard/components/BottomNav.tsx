'use client'
import { usePathname, useRouter } from 'next/navigation'

const tabs = [
  {
    label: 'Home',
    path: '/dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#3B7DFF' : 'none'} stroke={active ? '#3B7DFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: 'Goals',
    path: '/dashboard/goals',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3B7DFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" fill={active ? '#3B7DFF' : '#8E8E93'} />
      </svg>
    ),
  },
  {
    label: 'Plan',
    path: '/dashboard/plan',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3B7DFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    label: 'Mentor',
    path: '/dashboard/mentor',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3B7DFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    label: 'Cadence',
    path: '/dashboard/progress',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#3B7DFF' : '#8E8E93'}>
        <rect x="1"  y="10" width="2.5" height="4"  rx="1.25" />
        <rect x="5"  y="7"  width="2.5" height="10" rx="1.25" />
        <rect x="9"  y="4"  width="2.5" height="16" rx="1.25" />
        <rect x="13" y="2"  width="2.5" height="20" rx="1.25" />
        <rect x="17" y="5"  width="2.5" height="14" rx="1.25" />
        <rect x="21" y="9"  width="2.5" height="6"  rx="1.25" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    /* Outer wrapper: fixed, full-width, pointer-events none so page scrolls through the gap */
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      paddingLeft: 20, paddingRight: 20,
      paddingTop: 12,
      zIndex: 100,
      pointerEvents: 'none',
      display: 'flex',
      justifyContent: 'center',
    }}>
      {/* Pill card: pointer-events re-enabled */}
      <div style={{
        width: '100%',
        maxWidth: 370,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.60)',
        backdropFilter: 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%)',
        borderRadius: 9999,
        border: '0.5px solid rgba(255, 255, 255, 0.80)',
        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.14), 0 2px 10px rgba(0, 0, 0, 0.08)',
        padding: '6px 8px',
        pointerEvents: 'all',
      }}>
        {tabs.map(tab => {
          const active = tab.path === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(tab.path)

          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '7px 4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                gap: 2,
                position: 'relative',
              }}
            >
              {/* Selected backing pill with glow */}
              {active && (
                <span style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 9999,
                  background: 'rgba(59, 125, 255, 0.10)',
                  boxShadow: '0 2px 12px rgba(59, 125, 255, 0.18)',
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }} />
              )}
              <span
                key={active ? 'active' : 'inactive'}
                className={active ? 'icon-pulse' : undefined}
                style={{ position: 'relative', lineHeight: 0 }}
              >
                {tab.icon(active)}
              </span>
              <span style={{
                position: 'relative',
                fontSize: 10,
                fontWeight: active ? 600 : 400,
                color: active ? '#3B7DFF' : '#8E8E93',
                letterSpacing: active ? '-0.1px' : 0,
                transition: 'color 0.2s ease, font-weight 0.2s ease',
              }}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
