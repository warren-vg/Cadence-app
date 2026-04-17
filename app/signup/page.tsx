'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    setLoading(true)
    setError('')
    const { data, error: signupError } = await supabase.auth.signUp({ email, password })
    if (signupError) { setError(signupError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').insert({ id: data.user.id, username: name, onboarding_complete: false })
    }
    router.push('/dashboard')
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F2F2F7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
      
      {/* App icon */}
      <div style={{ width: 72, height: 72, background: '#3B7DFF', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <span style={{ color: 'white', fontSize: 32 }}>✦</span>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>Cadence</h1>
      <p style={{ fontSize: 15, color: '#8E8E93', marginBottom: 36, textAlign: 'center' }}>Turn big goals into weekly systems</p>

      {/* Card */}
      <div style={{ background: 'white', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 400 }}>
        
        {/* Google */}
        <button onClick={handleGoogle} style={{ width: '100%', border: '0.5px solid #D1D1D6', borderRadius: 14, padding: '14px', fontSize: 16, fontWeight: 500, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, color: '#1C1C1E' }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <div style={{ flex: 1, height: '0.5px', background: '#D1D1D6' }} />
          <span style={{ fontSize: 13, color: '#8E8E93' }}>or</span>
          <div style={{ flex: 1, height: '0.5px', background: '#D1D1D6' }} />
        </div>

        {/* Fields */}
        {[
          { placeholder: 'Your name', value: name, setter: setName, type: 'text' },
          { placeholder: 'Email', value: email, setter: setEmail, type: 'email' },
          { placeholder: 'Password', value: password, setter: setPassword, type: 'password' },
        ].map(({ placeholder, value, setter, type }) => (
          <input key={placeholder} type={type} placeholder={placeholder} value={value}
            onChange={e => setter(e.target.value)}
            style={{ width: '100%', background: '#F2F2F7', border: 'none', borderRadius: 12, padding: '14px 16px', fontSize: 15, marginBottom: 10, boxSizing: 'border-box', outline: 'none', color: '#1C1C1E' }}
          />
        ))}

        {error && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button onClick={handleSignup} disabled={loading}
          style={{ width: '100%', background: '#3B7DFF', color: 'white', border: 'none', borderRadius: 14, padding: 16, fontSize: 17, fontWeight: 600, cursor: 'pointer', marginTop: 4, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Creating account...' : 'Get Started'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 14, color: '#8E8E93', marginTop: 16 }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#3B7DFF', textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </div>
  )
}