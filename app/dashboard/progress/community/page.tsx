'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getFriends, getPendingRequests, sendFriendRequest,
  respondToFriendRequest, removeFriend, sendHypeOrNudge, getFriendGoals,
  type FriendProfile, type PendingRequest,
} from '@/lib/db'

interface GoalItem {
  id: string
  text: string
  category: string
  progress: number
  status: string
}

const CAT_BADGE: Record<string, { bg: string; color: string }> = {
  Career:            { bg: '#EFF6FF', color: '#3B7DFF' },
  Finance:           { bg: '#F0FFF4', color: '#16A34A' },
  Health:            { bg: '#FFF0F5', color: '#EC4899' },
  Creative:          { bg: '#FFF7ED', color: '#EA580C' },
  Education:         { bg: '#EFF6FF', color: '#3B7DFF' },
  Relationships:     { bg: '#FDF4FF', color: '#9333EA' },
  'Personal Growth': { bg: '#FDF4FF', color: '#9333EA' },
  Travel:            { bg: '#F0F9FF', color: '#0284C7' },
  Business:          { bg: '#FFFBEB', color: '#D97706' },
  Community:         { bg: '#F0FDF4', color: '#15803D' },
}
function getCatBadge(cat: string) {
  return CAT_BADGE[cat] || { bg: '#F2F2F7', color: '#8E8E93' }
}

const AVATAR_COLORS = ['#3B7DFF', '#7C3AED', '#16A34A', '#EA580C', '#EC4899', '#0284C7']
function avatarBg(str: string) {
  const code = str.charCodeAt(str.length - 1)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

// ─── Friend Card ──────────────────────────────────────────────────────────────

function FriendCard({ friend, goals, hyped, nudged, cooldownMsg, onHype, onNudge, onRemove }: {
  friend: FriendProfile
  goals: GoalItem[]
  hyped: boolean
  nudged: boolean
  cooldownMsg: string | null
  onHype: () => void
  onNudge: () => void
  onRemove: () => void
}) {
  const [showGoals, setShowGoals] = useState(true)
  const initial = friend.username.charAt(0).toUpperCase()
  const bg      = avatarBg(friend.friend_id)
  const topProgress = goals.length > 0 ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0

  return (
    <div style={{ background: 'white', borderRadius: 20, padding: '18px', border: '0.5px solid #E5E5EA' }}>
      {/* Friend header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.username}</p>
          <p style={{ fontSize: 12, color: '#8E8E93', margin: '1px 0 0' }}>@{friend.username}</p>
        </div>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14, padding: '12px 8px', background: '#F8F8FC', borderRadius: 12 }}>
        {[
          { label: 'Active Goals', value: goals.length },
          { label: 'Avg Progress', value: goals.length > 0 ? `${topProgress}%` : '—' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', margin: '0 0 2px' }}>{s.value}</p>
            <p style={{ fontSize: 11, color: '#8E8E93', margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cooldown message */}
      {cooldownMsg && (
        <p style={{ fontSize: 12, color: '#D97706', background: '#FFFBEB', borderRadius: 8, padding: '6px 10px', margin: '0 0 10px', border: '0.5px solid #FDE68A' }}>
          {cooldownMsg}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          onClick={onHype}
          style={{
            flex: 1, padding: '10px', borderRadius: 10,
            background: hyped ? '#FFF7ED' : 'white',
            border: hyped ? '1px solid #FDE68A' : '0.5px solid #E5E5EA',
            color: hyped ? '#D97706' : '#3C3C43',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={hyped ? '#FF9500' : 'none'} stroke={hyped ? '#D97706' : '#8E8E93'} strokeWidth="2" strokeLinecap="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          {hyped ? 'Hyped!' : 'Hype Up'}
        </button>
        <button
          onClick={onNudge}
          style={{
            flex: 1, padding: '10px', borderRadius: 10,
            background: nudged ? '#EFF6FF' : 'white',
            border: nudged ? '1px solid #DBEAFE' : '0.5px solid #E5E5EA',
            color: nudged ? '#1D4ED8' : '#3C3C43',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={nudged ? '#3B7DFF' : '#8E8E93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {nudged ? 'Nudged!' : 'Nudge'}
        </button>
      </div>

      {/* Goals section */}
      {goals.length > 0 && (
        <>
          <button
            onClick={() => setShowGoals(v => !v)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 10px', fontFamily: 'inherit' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="#3B7DFF" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', flex: 1, textAlign: 'left' }}>Active Goals</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round">
              {showGoals ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
            </svg>
          </button>
          {showGoals && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {goals.map(goal => {
                const badge = getCatBadge(goal.category)
                return (
                  <div key={goal.id} style={{ background: '#F8F8FC', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', margin: 0, flex: 1, paddingRight: 8, lineHeight: 1.3 }}>{goal.text}</p>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#3B7DFF', flexShrink: 0 }}>{goal.progress}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: 20 }}>{goal.category}</span>
                    </div>
                    <div style={{ background: '#E5E5EA', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${goal.progress}%`, background: 'linear-gradient(90deg, #3B7DFF 0%, #8B5CF6 100%)', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const router = useRouter()
  const [userId, setUserId]   = useState<string | null>(null)
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [friendGoals, setFriendGoals] = useState<Record<string, GoalItem[]>>({})
  const [hypedIds, setHypedIds]   = useState<Set<string>>(new Set())
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set())
  const [cooldowns, setCooldowns] = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(true)
  const [showAddForm, setShowAddForm]   = useState(false)
  const [addInput, setAddInput]         = useState('')
  const [addError, setAddError]         = useState('')
  const [addSending, setAddSending]     = useState(false)

  const loadAll = async (uid: string) => {
    const [friendsList, pendingList] = await Promise.all([
      getFriends(uid),
      getPendingRequests(uid),
    ])
    setFriends(friendsList)
    setPending(pendingList)

    if (friendsList.length > 0) {
      const goalsMap: Record<string, GoalItem[]> = {}
      await Promise.all(friendsList.map(async f => {
        goalsMap[f.friend_id] = await getFriendGoals(f.friend_id)
      }))
      setFriendGoals(goalsMap)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      await loadAll(user.id)
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return null

  const incomingCount = pending.filter(r => r.direction === 'incoming').length

  const handleAdd = async () => {
    const val = addInput.trim()
    if (!val || !userId) { setAddError('Please enter a username.'); return }
    setAddSending(true)
    const result = await sendFriendRequest(userId, val)
    if (!result.success) {
      setAddError(result.error || 'Could not send request.')
      setAddSending(false)
      return
    }
    setAddInput('')
    setAddError('')
    setShowAddForm(false)
    setAddSending(false)
    await loadAll(userId)
  }

  const handleRespond = async (requestId: string, accept: boolean) => {
    if (!userId) return
    await respondToFriendRequest(requestId, accept)
    await loadAll(userId)
  }

  const handleRemove = async (friendId: string) => {
    if (!userId) return
    await removeFriend(userId, friendId)
    setFriends(prev => prev.filter(f => f.friend_id !== friendId))
  }

  const handleHype = async (friendId: string) => {
    if (!userId) return
    const result = await sendHypeOrNudge(userId, friendId, 'hype')
    if (result.success) {
      setHypedIds(prev => new Set([...prev, friendId]))
    } else if (result.onCooldown) {
      setCooldowns(prev => ({ ...prev, [friendId]: result.error || 'Already hyped today' }))
      setHypedIds(prev => new Set([...prev, friendId]))
      setTimeout(() => setCooldowns(prev => { const n = { ...prev }; delete n[friendId]; return n }), 3000)
    }
  }

  const handleNudge = async (friendId: string) => {
    if (!userId) return
    const result = await sendHypeOrNudge(userId, friendId, 'nudge')
    if (result.success) {
      setNudgedIds(prev => new Set([...prev, friendId]))
    } else if (result.onCooldown) {
      setCooldowns(prev => ({ ...prev, [friendId]: result.error || 'Already nudged today' }))
      setNudgedIds(prev => new Set([...prev, friendId]))
      setTimeout(() => setCooldowns(prev => { const n = { ...prev }; delete n[friendId]; return n }), 3000)
    }
  }

  return (
    <div style={{ padding: '0 0 16px' }}>
      {/* Header */}
      <div style={{ padding: '56px 16px 16px', background: 'white', borderBottom: '0.5px solid #E5E5EA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button
              onClick={() => router.back()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#3B7DFF', fontSize: 14, fontFamily: 'inherit' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              Progress
            </button>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1C1E', margin: 0 }}>Community</h1>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '3px 0 0' }}>Connect and grow together</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#3B7DFF', border: 'none', borderRadius: 20,
              padding: '9px 16px', color: 'white', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', marginTop: 36,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Add Friend
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Add Friend form */}
        {showAddForm && (
          <div style={{ background: 'linear-gradient(135deg, #3B52FF 0%, #7C3AED 100%)', borderRadius: 20, padding: '20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>Add a Friend</p>
              <button
                onClick={() => { setShowAddForm(false); setAddError(''); setAddInput('') }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '0 0 12px' }}>Enter their Cadence username</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={addInput}
                onChange={e => { setAddInput(e.target.value); setAddError('') }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="username"
                style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: 'none', outline: 'none', fontSize: 14, color: '#1C1C1E', fontFamily: 'inherit', background: 'rgba(255,255,255,0.95)' }}
              />
              <button
                onClick={handleAdd}
                disabled={addSending}
                style={{ padding: '11px 18px', borderRadius: 10, background: 'white', border: 'none', fontSize: 14, fontWeight: 700, color: '#3B52FF', cursor: addSending ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: addSending ? 0.7 : 1 }}
              >
                {addSending ? 'Sending…' : 'Send'}
              </button>
            </div>
            {addError && <p style={{ fontSize: 12, color: 'rgba(255,200,200,1)', margin: '8px 0 0' }}>{addError}</p>}
          </div>
        )}

        {/* Pending requests */}
        {pending.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#3C3C43', marginBottom: 10 }}>
              Pending Requests {incomingCount > 0 && <span style={{ background: '#FF3B30', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1px 7px', marginLeft: 6 }}>{incomingCount}</span>}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(req => (
                <div key={req.id} style={{ background: 'white', borderRadius: 16, padding: '14px 16px', border: '0.5px solid #E5E5EA', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarBg(req.from_id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                    {req.username.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', margin: 0 }}>{req.username}</p>
                    <p style={{ fontSize: 12, color: '#8E8E93', margin: '1px 0 0' }}>{req.direction === 'incoming' ? 'Wants to connect' : 'Request sent'}</p>
                  </div>
                  {req.direction === 'incoming' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleRespond(req.id, true)} style={{ padding: '7px 14px', borderRadius: 8, background: '#3B7DFF', border: 'none', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Accept</button>
                      <button onClick={() => handleRespond(req.id, false)} style={{ padding: '7px 14px', borderRadius: 8, background: '#F2F2F7', border: 'none', fontSize: 13, fontWeight: 500, color: '#3C3C43', cursor: 'pointer', fontFamily: 'inherit' }}>Decline</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#8E8E93', background: '#F2F2F7', padding: '4px 10px', borderRadius: 20 }}>Pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {friends.length === 0 && (
          <div style={{ background: 'white', borderRadius: 20, padding: '40px 20px', border: '0.5px solid #E5E5EA', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', margin: '0 0 8px' }}>Build Your Community</h2>
            <p style={{ fontSize: 14, color: '#8E8E93', margin: '0 0 20px', lineHeight: 1.5, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
              Add friends to share progress, create accountability, and celebrate wins together. Enter their username to get started.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1C1C1E', border: 'none', borderRadius: 14, padding: '13px 24px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              Add Your First Friend
            </button>
          </div>
        )}

        {/* Friends list */}
        {friends.length > 0 && (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#3C3C43', marginBottom: 12 }}>
              Your Community ({friends.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {friends.map(friend => (
                <FriendCard
                  key={friend.friendship_id}
                  friend={friend}
                  goals={friendGoals[friend.friend_id] || []}
                  hyped={hypedIds.has(friend.friend_id)}
                  nudged={nudgedIds.has(friend.friend_id)}
                  cooldownMsg={cooldowns[friend.friend_id] || null}
                  onHype={() => handleHype(friend.friend_id)}
                  onNudge={() => handleNudge(friend.friend_id)}
                  onRemove={() => handleRemove(friend.friend_id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Accountability benefits card */}
        <div style={{ background: 'linear-gradient(135deg, #3B52FF 0%, #7C3AED 100%)', borderRadius: 20, padding: '20px', marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0 }}>Accountability Boosts Results</p>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.5 }}>
            Studies show people with accountability partners are <strong style={{ color: 'white' }}>65% more likely</strong> to achieve their goals. Build your circle and grow together.
          </p>
        </div>
      </div>
    </div>
  )
}
