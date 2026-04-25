'use client'
import { useRouter } from 'next/navigation'

export default function OnboardingCompletePage() {
  const router = useRouter()

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>

      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map(step => (
          <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: '#3B7DFF' }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 32 }}>Step 5 of 5</p>

      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1C1C1E', marginBottom: 8 }}>You&apos;re all set!</h1>
      <p style={{ fontSize: 16, color: '#3C3C43', lineHeight: 1.5, marginBottom: 28 }}>
        Your personal operating system is ready. Let&apos;s build momentum.
      </p>

      {/* Setup Complete Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #3B52FF 0%, #2D7DFF 100%)',
        borderRadius: 18, padding: '20px 22px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>Setup Complete</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '2px 0 0' }}>Your system is personalized and ready</p>
        </div>
      </div>

      {/* Feature List */}
      {[
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
            </svg>
          ),
          title: 'Your Goals',
          sub: 'Track and refine your top priorities',
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          ),
          title: 'Smart Planning',
          sub: 'AI-powered weekly and daily plans',
        },
        {
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="17 7 22 7 22 12"/>
            </svg>
          ),
          title: 'Progress Tracking',
          sub: 'See your momentum and celebrate wins',
        },
      ].map(item => (
        <div
          key={item.title}
          style={{
            background: 'white', borderRadius: 14, padding: '16px 18px', marginBottom: 10,
            border: '0.5px solid #E5E5EA', display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#EFF6FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {item.icon}
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>{item.title}</p>
            <p style={{ fontSize: 13, color: '#8E8E93', margin: '2px 0 0' }}>{item.sub}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      ))}

      {/* Pro tip */}
      <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '14px 16px', marginBottom: 32, border: '0.5px solid #BFDBFE' }}>
        <p style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 1.5, margin: 0 }}>
          <strong>Pro tip:</strong> Start each week with a quick review to stay aligned with your goals and maintain momentum.
        </p>
      </div>

      <button
        onClick={() => router.push('/dashboard')}
        style={{
          width: '100%', padding: '17px', background: '#3B7DFF', border: 'none',
          borderRadius: 16, fontSize: 16, fontWeight: 700, color: 'white',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Launch Cadence
      </button>
    </div>
  )
}
