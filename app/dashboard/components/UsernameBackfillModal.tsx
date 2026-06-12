'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { checkUsernameAvailable, setUsername, generateUsernameSuggestions } from '@/lib/db'

// ─── Validation (mirrors onboarding/username logic) ────────────────────────────

type CheckStatus =
  | 'idle' | 'checking' | 'available' | 'taken' | 'reserved'
  | 'too_short' | 'too_long' | 'bad_format'

function clientValidate(v: string): CheckStatus | null {
  if (!v) return 'idle'
  if (v.length < 3) return 'too_short'
  if (v.length > 20) return 'too_long'
  if (!/^[a-zA-Z]/.test(v)) return 'bad_format'
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'bad_format'
  return null
}

interface StatusUI {
  borderColor: string
  icon: 'none' | 'check' | 'x' | 'warning' | 'spinner'
  bannerBg: string; bannerBorder: string; bannerText: string; bannerColor: string
}

function getUI(status: CheckStatus, value: string): StatusUI {
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function UsernameBackfillModal() {
  const [show, setShow]               = useState(false)
  const [userId, setUserId]           = useState<string | null>(null)
  const [firstName, setFirstName]     = useState('user')
  const [value, setValue]             = useState('')
  const [status, setStatus]           = useState<CheckStatus>('idle')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggs, setLoadingSuggs] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', user.id)
        .single()
      if (data?.username) return  // already has a handle — nothing to do
      setUserId(user.id)
      const name = (data?.full_name ?? '').split(' ')[0] || 'user'
      setFirstName(name)
      setShow(true)
      setLoadingSuggs(true)
      const s = await generateUsernameSuggestions(name)
      setSuggestions(s)
      setLoadingSuggs(false)
    }
    check()
  }, [])

  const handleChange = useCallback((raw: string) => {
    const v = raw.replace(/\s/g, '')
    setValue(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const local = clientValidate(v)
    if (local !== null) { setStatus(local); return }
    setStatus('checking')
    debounceRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(v)
      if (result.available) {
        setStatus('available')
      } else {
        const next = result.reason === 'reserved' ? 'reserved' : 'taken'
        setStatus(next)
        if (next === 'taken') {
          setLoadingSuggs(true)
          const fresh = await generateUsernameSuggestions(firstName)
          setSuggestions(fresh)
          setLoadingSuggs(false)
        }
      }
    }, 300)
  }, [firstName])

  const handleChip = useCallback((chip: string) => {
    setValue(chip)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setStatus('checking')
    debounceRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(chip)
      setStatus(result.available ? 'available' : (result.reason === 'reserved' ? 'reserved' : 'taken'))
    }, 100)
  }, [])

  const handleContinue = async () => {
    if (!userId || status !== 'available' || submitting) return
    setSubmitting(true)
    const ok = await setUsername(userId, value)
    if (!ok) { setSubmitting(false); return }
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId)
    setShow(false)
  }

  if (!show) return null

  const ui = getUI(status, value)
  const canSubmit = status === 'available' && !submitting

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'white', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      <div style={{ padding: '56px 20px 48px', maxWidth: 480, margin: '0 auto', width: '100%' }}>

        {/* Gradient @ icon */}
        <div style={{
          width: 60, height: 60, borderRadius: 16, marginBottom: 20,
          background: 'linear-gradient(135deg, #3B7DFF 0%, #9333EA 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'white', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>@</span>
        </div>

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
          transition: 'border-color 0.15s', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#8E8E93', fontSize: 17, fontWeight: 500, flexShrink: 0 }}>@</span>
            <input
              type="text" value={value} onChange={e => handleChange(e.target.value)}
              placeholder="your_username" autoComplete="off" autoCapitalize="none" spellCheck={false}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 17, color: '#1C1C1E', fontFamily: 'inherit', padding: '2px 0' }}
            />
            {ui.icon === 'check' && (
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 7 5 10 11 3" /></svg>
              </div>
            )}
            {ui.icon === 'x' && (
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="3" x2="10" y2="10" /><line x1="10" y1="3" x2="3" y2="10" /></svg>
              </div>
            )}
            {ui.icon === 'warning' && (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12 3L2 21h20L12 3z" fill="#FF9500" />
                <line x1="12" y1="10" x2="12" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="18.5" r="1" fill="white" />
              </svg>
            )}
            {ui.icon === 'spinner' && (
              <>
                <style>{`@keyframes _bf_spin { to { transform: rotate(360deg) } }`}</style>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ animation: '_bf_spin 0.8s linear infinite', flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" stroke="#E5E5EA" strokeWidth="2.5" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </>
            )}
          </div>
          {value && ui.bannerText && (
            <div style={{ background: ui.bannerBg, border: `1px solid ${ui.bannerBorder}`, borderRadius: 8, padding: '9px 12px', marginTop: 12 }}>
              <span style={{ fontSize: 13, color: ui.bannerColor, fontWeight: 500 }}>{ui.bannerText}</span>
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✦</span> Try these suggestions
          </p>
          {loadingSuggs ? (
            <p style={{ fontSize: 13, color: '#C7C7CC' }}>Finding available names…</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map(s => (
                <button
                  key={s} onClick={() => handleChip(s)}
                  style={{ background: '#EFF6FF', color: '#3B7DFF', border: '1px solid #DBEAFE', borderRadius: 20, padding: '7px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  @{s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleContinue} disabled={!canSubmit}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: canSubmit ? 'linear-gradient(135deg, #3B7DFF 0%, #9333EA 100%)' : '#D1D1D6',
            color: 'white', fontSize: 16, fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'default',
            fontFamily: 'inherit', opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
