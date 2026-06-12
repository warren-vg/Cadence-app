'use client'
import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'

interface Props {
  userId: string
  onClose: () => void
}

const AVATAR_COLORS = ['#3B7DFF', '#7C3AED', '#16A34A', '#EA580C', '#EC4899', '#0284C7']
function avatarBg(str: string) {
  const code = str.charCodeAt(str.length - 1)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

export default function QRCodeModal({ userId, onClose }: Props) {
  const [username, setUsername]       = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState('')
  const hiddenCanvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('username, full_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setUsername(data?.username ?? null)
        setDisplayName(data?.full_name || data?.username || '')
        setLoading(false)
      })
  }, [userId])

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const deepLink = username
    ? `${siteUrl}/dashboard/progress/community?add=${username}`
    : ''

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleShare = async () => {
    if (!deepLink) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Connect with me on Cadence',
          text: `Add @${username} on Cadence to track goals together.`,
          url: deepLink,
        })
      } catch {
        // user cancelled share sheet — no action needed
      }
    } else {
      await navigator.clipboard.writeText(deepLink)
      showToast('Link copied to clipboard')
    }
  }

  const handleSaveImage = () => {
    const canvas = hiddenCanvasRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `cadence-${username ?? 'qr'}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const initial = displayName.charAt(0).toUpperCase() || '?'
  const bgColor = avatarBg(userId)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="My QR Code"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px', zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: 24,
          padding: '24px 24px 28px',
          maxWidth: 340, width: '100%',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: '#F2F2F7', border: 'none', borderRadius: '50%',
            width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {loading ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 14, color: '#8E8E93' }}>Loading…</p>
          </div>
        ) : username === null ? (
          /* No username — prompt user to set one */
          <div style={{ textAlign: 'center', paddingTop: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#F2F2F7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <circle cx="17.5" cy="17.5" r="3.5"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>
              Set a username first
            </p>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 20px', lineHeight: 1.5 }}>
              You need a @username before your QR code can be generated.
            </p>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: '#3B7DFF', color: 'white',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Go to Settings
            </button>
          </div>
        ) : (
          /* Happy path */
          <>
            {/* Avatar */}
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: bgColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: 28, fontWeight: 700, color: 'white',
              }}>
                {initial}
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>
                {displayName}
              </p>
              <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>
                @{username}
              </p>
            </div>

            {/* QR card — white background is required for reliable scanning */}
            <div style={{
              background: 'white',
              borderRadius: 16,
              border: '0.5px solid #E5E5EA',
              padding: '20px',
              margin: '16px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <QRCodeSVG
                value={deepLink}
                size={200}
                bgColor="#ffffff"
                fgColor="#1C1C1E"
                level="M"
                marginSize={1}
              />
              <p style={{
                fontSize: 13, color: '#8E8E93',
                margin: '14px 0 0', textAlign: 'center',
              }}>
                Have a friend scan this to connect
              </p>
            </div>

            {/* Share / Save row */}
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 0, borderTop: '0.5px solid #E5E5EA',
              marginTop: 4,
            }}>
              <button
                onClick={handleShare}
                style={{
                  flex: 1, padding: '14px 0',
                  background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: 14, fontWeight: 600, color: '#3B7DFF',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share
              </button>

              <div style={{ width: '0.5px', height: 20, background: '#E5E5EA' }} />

              <button
                onClick={handleSaveImage}
                style={{
                  flex: 1, padding: '14px 0',
                  background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: 14, fontWeight: 600, color: '#3B7DFF',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Save image
              </button>
            </div>
          </>
        )}

        {/* Hidden canvas used only for PNG download */}
        <div ref={hiddenCanvasRef} style={{ position: 'absolute', left: -9999, top: -9999 }}>
          {username && (
            <QRCodeCanvas
              value={deepLink}
              size={400}
              bgColor="#ffffff"
              fgColor="#1C1C1E"
              level="M"
              marginSize={2}
            />
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
            background: '#1C1C1E', color: 'white',
            padding: '12px 20px', borderRadius: 12,
            fontSize: 14, fontWeight: 500, zIndex: 300,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)',
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
