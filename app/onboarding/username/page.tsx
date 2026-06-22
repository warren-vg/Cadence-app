'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { checkUsernameAvailable, setUsername, generateUsernameSuggestions } from '@/lib/db'

// ─── Validation helpers ───────────────────────────────────────────────────────

type CheckStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'reserved'
  | 'too_short'
  | 'too_long'
  | 'bad_format'

function clientValidate(v: string): CheckStatus | null {
  if (!v) return 'idle'
  if (v.length < 3) return 'too_short'
  if (v.length > 20) return 'too_long'
  if (!/^[a-zA-Z]/.test(v)) return 'bad_format'
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'bad_format'
  return null // valid format — needs DB check
}

interface StatusUI {
  borderColor: string
  icon: 'none' | 'check' | 'x' | 'warning' | 'spinner'
  bannerBg: string
  bannerBorder: string
  bannerText: string
  bannerColor: string
}

function getUI(status: CheckStatus, value: string): StatusUI {
  switch (status) {
    case 'available':
      return {
        borderColor: '#16A34A', icon: 'check',
        bannerBg: '#F0FFF4', bannerBorder: '#BBF7D0',
        bannerText: '✓ Available — looks great!', bannerColor: '#16A34A',
      }
    case 'taken':
      return {
        borderColor: '#DC2626', icon: 'x',
        bannerBg: '#FFF5F5', bannerBorder: '#FECACA',
        bannerText: 'Already taken — try another', bannerColor: '#DC2626',
      }
    case 'reserved':
      return {
        borderColor: '#DC2626', icon: 'x',
        bannerBg: '#FFF5F5', bannerBorder: '#FECACA',
        bannerText: 'Reserved — try another', bannerColor: '#DC2626',
      }
    case 'too_short':
      return {
        borderColor: '#FF9500', icon: 'warning',
        bannerBg: '#FFF7ED', bannerBorder: '#FED7AA',
        bannerText: 'Too short — minimum 3 characters', bannerColor: '#D97706',
      }
    case 'too_long':
      return {
        borderColor: '#DC2626', icon: 'x',
        bannerBg: '#FFF5F5', bannerBorder: '#FECACA',
        bannerText: 'Too long — maximum 20 characters', bannerColor: '#DC2626',
      }
    case 'bad_format':
      return {
        borderColor: '#DC2626', icon: 'x',
        bannerBg: '#FFF5F5', bannerBorder: '#FECACA',
        bannerText: !/^[a-zA-Z]/.test(value)
          ? 'Must start with a letter'
          : 'Only letters, numbers, and underscores',
        bannerColor: '#DC2626',
      }
    case 'checking':
      return {
        borderColor: '#D1D1D6', icon: 'spinner',
        bannerBg: '', bannerBorder: '', bannerText: '', bannerColor: '',
      }
    default:
      return {
        borderColor: '#D1D1D6', icon: 'none',
        bannerBg: '', bannerBorder: '', bannerText: '', bannerColor: '',
      }
  }
}

// ─── Icon components ──────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%', background: '#16A34A', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2 7 5 10 11 3" />
      </svg>
    </div>
  )
}

function XIcon() {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%', background: '#DC2626', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
        <line x1="3" y1="3" x2="10" y2="10" />
        <line x1="10" y1="3" x2="3" y2="10" />
      </svg>
    </div>
  )
}

function WarningIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 3L2 21h20L12 3z" fill="#FF9500" />
      <line x1="12" y1="10" x2="12" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="18.5" r="1" fill="white" />
    </svg>
  )
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes _cadence_spin { to { transform: rotate(360deg) } }`}</style>
      <svg
        width="22" height="22" viewBox="0 0 24 24" fill="none"
        style={{ animation: '_cadence_spin 0.8s linear infinite', flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10" stroke="#E5E5EA" strokeWidth="2.5" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsernameOnboardingPage() {
  const router = useRouter()

  const [userId, setUserId]           = useState<string | null>(null)
  const [firstName, setFirstName]     = useState('')
  const [value, setValue]             = useState('')
  const [status, setStatus]           = useState<CheckStatus>('idle')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [toast, setToast]             = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── On mount: auth check + suggestions ────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, full_name, onboarding_complete')
        .eq('id', user.id)
        .single()

      // Onboarding already finished — skip this step
      if (profile?.onboarding_complete) { router.replace('/dashboard'); return }

      setUserId(user.id)
      const name = (profile?.full_name ?? '').split(' ')[0] || 'user'
      setFirstName(name)

      setLoadingSuggestions(true)
      const s = await generateUsernameSuggestions(name)
      setSuggestions(s)
      setLoadingSuggestions(false)
    }
    init()
  }, [])

  // ─── Debounced availability check ──────────────────────────────────────────
  const handleChange = useCallback((raw: string) => {
    // Strip spaces; allow only valid-ish chars while typing
    const v = raw.replace(/\s/g, '')
    setValue(v)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const local = clientValidate(v)
    if (local !== null) {
      setStatus(local)
      return
    }

    // Valid format — debounce the DB check
    setStatus('checking')
    debounceRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(v)
      if (result.available) {
        setStatus('available')
      } else {
        const next = result.reason === 'reserved' ? 'reserved' : 'taken'
        setStatus(next)
        if (next === 'taken') {
          // Refresh suggestions excluding the taken one
          setLoadingSuggestions(true)
          const fresh = await generateUsernameSuggestions(firstName)
          setSuggestions(fresh)
          setLoadingSuggestions(false)
        }
      }
    }, 300)
  }, [firstName])

  // ─── Chip tap: populate input and immediately check ─────────────────────────
  const handleChipClick = (chip: string) => {
    setValue(chip)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Suggestions are pre-verified available, but confirm to be safe
    setStatus('checking')
    debounceRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(chip)
      setStatus(result.available ? 'available' : (result.reason === 'reserved' ? 'reserved' : 'taken'))
    }, 100)
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleContinue = async () => {
    if (!userId || status !== 'available' || submitting) return
    setSubmitting(true)
    const ok = await setUsername(userId, value)
    if (!ok) { setSubmitting(false); return }

    // Mark onboarding complete
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId)

    setToast(`Welcome, @${value}!`)
    setTimeout(() => router.push('/dashboard'), 1600)
  }

  // ─── Derived UI ─────────────────────────────────────────────────────────────
  const ui = getUI(status, value)
  const canSubmit = status === 'available' && !submitting

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto', paddingBottom: 48, minHeight: '100vh', background: 'white' }}>

      {/* Back */}
      <button
        onClick={() => router.back()}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 15, color: '#3C3C43', fontFamily: 'inherit',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      {/* Progress bar — Step 7 of 7 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5, 6, 7].map(step => (
          <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: '#3B7DFF' }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 28 }}>Step 7 of 7</p>

      {/* Gradient @ icon */}
      <div style={{
        width: 60, height: 60, borderRadius: 16, marginBottom: 20,
        background: 'linear-gradient(135deg, #3B7DFF 0%, #9333EA 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'white', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>@</span>
      </div>

      {/* Title + subtitle */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>
        Choose your username
      </h1>
      <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.5, margin: '0 0 28px' }}>
        This is how friends will find you. You can change it later if needed.
      </p>

      {/* Input card */}
      <div style={{
        background: 'white', borderRadius: 16, padding: '16px',
        border: `1.5px solid ${ui.borderColor}`,
        transition: 'border-color 0.15s',
        marginBottom: 20,
      }}>
        {/* @ prefix + input + status icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#8E8E93', fontSize: 17, fontWeight: 500, flexShrink: 0 }}>@</span>
          <input
            type="text"
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder="your_username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'none',
              fontSize: 17, color: '#1C1C1E', fontFamily: 'inherit', padding: '2px 0',
            }}
          />
          {ui.icon === 'check'   && <CheckIcon />}
          {ui.icon === 'x'       && <XIcon />}
          {ui.icon === 'warning' && <WarningIcon />}
          {ui.icon === 'spinner' && <Spinner />}
        </div>

        {/* Status banner — only shown when value is non-empty and we have a message */}
        {value && ui.bannerText && (
          <div style={{
            background: ui.bannerBg, border: `1px solid ${ui.bannerBorder}`,
            borderRadius: 8, padding: '9px 12px', marginTop: 12,
          }}>
            <span style={{ fontSize: 13, color: ui.bannerColor, fontWeight: 500 }}>
              {ui.bannerText}
            </span>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>✦</span> Try these suggestions
        </p>
        {loadingSuggestions ? (
          <p style={{ fontSize: 13, color: '#C7C7CC' }}>Finding available names…</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => handleChipClick(s)}
                style={{
                  background: '#EFF6FF', color: '#3B7DFF',
                  border: '1px solid #DBEAFE', borderRadius: 20,
                  padding: '7px 16px', fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                @{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={handleContinue}
        disabled={!canSubmit}
        style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 'none',
          background: canSubmit
            ? 'linear-gradient(135deg, #3B7DFF 0%, #9333EA 100%)'
            : '#D1D1D6',
          color: 'white', fontSize: 16, fontWeight: 600,
          cursor: canSubmit ? 'pointer' : 'default',
          fontFamily: 'inherit',
          transition: 'background 0.2s',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'Saving…' : 'Continue'}
      </button>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: '#1C1C1E', color: 'white', padding: '12px 20px',
          borderRadius: 12, fontSize: 14, fontWeight: 500,
          zIndex: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
