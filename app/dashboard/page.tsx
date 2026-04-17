'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    getProfile()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#F2F2F7', padding: '32px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', background: 'white', borderRadius: 24, padding: '28px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E' }}>Dashboard</h1>
          <button onClick={handleLogout} style={{ fontSize: 14, color: '#8E8E93', background: 'none', border: 'none', cursor: 'pointer' }}>Log out</button>
        </div>
        <p style={{ color: '#3C3C43', fontSize: 16 }}>Welcome back, <strong>{profile?.username || 'User'}</strong> 👋</p>
        <p style={{ fontSize: 13, color: '#8E8E93', marginTop: 4 }}>Onboarding complete: {profile?.onboarding_complete ? 'Yes' : 'No'}</p>
        <div style={{ marginTop: 24, padding: 16, background: '#F0FDF4', borderRadius: 12, border: '1px solid #BBF7D0' }}>
          <p style={{ color: '#15803D', fontWeight: 500, fontSize: 15 }}>✅ Phase 4 complete — Supabase auth + profile read/write is working.</p>
        </div>
      </div>
    </div>
  )
}