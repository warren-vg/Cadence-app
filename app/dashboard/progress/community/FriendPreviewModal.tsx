'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sendFriendRequest } from '@/lib/db'

interface TargetUser {
  id: string
  username: string
  full_name: string | null
}

type ModalState =
  | 'loading'
  | 'ready'        // happy path — show the preview
  | 'not_found'
  | 'self'
  | 'already_friends'
  | 'pending'
  | 'sent'         // success confirmation

interface Props {
  targetUsername: string   // the @username from the ?add= param
  currentUserId: string
  onClose: () => void
  onSent: () => void       // refresh the friends list after a successful send
}

const AVATAR_COLORS = ['#3B7DFF', '#7C3AED', '#16A34A', '#EA580C', '#EC4899', '#0284C7']
function avatarBg(str: string) {
  const code = str.charCodeAt(str.length - 1)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

export default function FriendPreviewModal({ targetUsername, currentUserId, onClose, onSent }: Props) {
  const [state, setState]       = useState<ModalState>('loading')
  const [target, setTarget]     = useState<TargetUser | null>(null)
  const [sending, setSending]   = useState(false)

  useEffect(() => {
    const resolve = async () => {
      // 1. Look up the target profile
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .ilike('username', targetUsername)
        .maybeSingle()

      if (!targetUser) { setState('not_found'); return }
      if (targetUser.id === currentUserId) { setState('self'); return }

      setTarget(targetUser)

      // 2. Check for an existing friendship row in either direction
      const { data: existing } = await supabase
        .from('friendships')
        .select('status')
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${targetUser.id}),` +
          `and(user_id.eq.${targetUser.id},friend_id.eq.${currentUserId})`
        )
        .maybeSingle()

      if (existing?.status === 'accepted') { setState('already_friends'); return }
      if (existing?.status === 'pending')  { setState('pending');         return }

      setState('ready')
    }
    resolve()
  }, [targetUsername, currentUserId])

  const handleSend = async () => {
    if (!target) return
    setSending(true)
    const result = await sendFriendRequest(currentUserId, target.username, 'qr')
    setSending(false)
    if (result.success) {
      setState('sent')
      onSent()
    }
    // Edge case: race condition (someone else sent in the meantime) — the
    // existing sendFriendRequest returns descriptive errors we can surface.
    if (!result.success && result.error === 'Already friends')       setState('already_friends')
    if (!result.success && result.error === 'Request already sent')  setState('pending')
  }

  // ── Shared shell ─────────────────────────────────────────────────────────────

  const initial  = (target?.full_name || target?.username || '?').charAt(0).toUpperCase()
  const bgColor  = target ? avatarBg(target.id) : '#D1D1D6'
  const nameText = target?.full_name || `@${target?.username ?? ''}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send Friend Request"
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
          position: 'relative', textAlign: 'center',
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

        {state === 'loading' && (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 14, color: '#8E8E93' }}>Looking up user…</p>
          </div>
        )}

        {state === 'not_found' && (
          <InfoState
            icon="🔍"
            title="User not found"
            body={`We couldn't find anyone with the username @${targetUsername}. The link may be outdated.`}
            onClose={onClose}
          />
        )}

        {state === 'self' && (
          <InfoState
            icon="🪞"
            title="That's your code"
            body="You scanned your own QR code. Share it with a friend so they can send you a request."
            onClose={onClose}
          />
        )}

        {state === 'already_friends' && target && (
          <InfoState
            icon="✅"
            title="Already connected"
            body={`You and @${target.username} are already friends on Cadence.`}
            onClose={onClose}
          />
        )}

        {state === 'pending' && target && (
          <InfoState
            icon="⏳"
            title="Request already pending"
            body={`There's already a pending request between you and @${target.username}.`}
            onClose={onClose}
          />
        )}

        {state === 'sent' && target && (
          <InfoState
            icon="🎉"
            title="Request sent!"
            body={`Your friend request to @${target.username} is on its way.`}
            onClose={onClose}
            ctaLabel="Done"
          />
        )}

        {state === 'ready' && target && (
          <>
            {/* Avatar */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: bgColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '8px auto 12px',
              fontSize: 28, fontWeight: 700, color: 'white',
            }}>
              {initial}
            </div>

            <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 2px' }}>
              {nameText}
            </p>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 16px' }}>
              @{target.username}
            </p>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 24px', lineHeight: 1.5 }}>
              Send a request to connect on Cadence
            </p>

            {/* Primary CTA */}
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: sending ? '#D1D1D6' : '#3B7DFF',
                color: 'white', fontSize: 15, fontWeight: 600,
                cursor: sending ? 'default' : 'pointer',
                fontFamily: 'inherit', marginBottom: 12,
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? 'Sending…' : 'Send Friend Request'}
            </button>

            {/* Cancel link */}
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, color: '#8E8E93', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Shared info/outcome state shell ──────────────────────────────────────────

function InfoState({
  icon, title, body, onClose, ctaLabel = 'Close',
}: {
  icon: string
  title: string
  body: string
  onClose: () => void
  ctaLabel?: string
}) {
  return (
    <div style={{ paddingTop: 12 }}>
      <p style={{ fontSize: 36, margin: '0 0 12px' }}>{icon}</p>
      <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>{title}</p>
      <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 24px', lineHeight: 1.55 }}>{body}</p>
      <button
        onClick={onClose}
        style={{
          width: '100%', padding: '15px', borderRadius: 14, border: 'none',
          background: '#3B7DFF', color: 'white',
          fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {ctaLabel}
      </button>
    </div>
  )
}
