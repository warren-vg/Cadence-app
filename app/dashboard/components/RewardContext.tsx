'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { type DBRewardEvent, markRewardSeen, getUnseenRewards } from '@/lib/rewards'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RewardContextValue {
  /** Queue newly-earned rewards for display. Respects pacing governor. */
  queueRewards: (rewards: DBRewardEvent[]) => void
  /** Load and queue unseen rewards from the DB (call on dashboard mount). */
  loadUnseenRewards: (userId: string) => Promise<void>
  /** The reward currently being shown (null when queue is empty). */
  current: DBRewardEvent | null
  /** Dismiss the current reward and advance the queue. */
  dismiss: () => void
}

const RewardContext = createContext<RewardContextValue | null>(null)

// ─── Pacing governor ──────────────────────────────────────────────────────────
// At most one full-screen takeover reward per session.
// quiet_win is inline-only and exempt from this limit.

const TAKEOVER_TYPES = new Set([
  'first_move', 'full_day', 'perfect_week', 'streak_milestone',
  'first_reflection', 'goal_complete', 'back_in_rhythm',
])

interface QueueState {
  queue: DBRewardEvent[]
  current: DBRewardEvent | null
}

function pickNext(
  items: DBRewardEvent[],
  takeoverShown: boolean,
): { next: DBRewardEvent | null; remaining: DBRewardEvent[] } {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const isTakeover = TAKEOVER_TYPES.has(item.reward_type)
    if (isTakeover && takeoverShown) continue   // governor: skip takeover if one already shown
    const remaining = [...items.slice(0, i), ...items.slice(i + 1)]
    return { next: item, remaining }
  }
  return { next: null, remaining: [] }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RewardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QueueState>({ queue: [], current: null })
  const takeoverShownRef = useRef(false)

  const queueRewards = useCallback((rewards: DBRewardEvent[]) => {
    if (rewards.length === 0) return
    setState(prev => {
      const combined = [...prev.queue, ...rewards]
      if (prev.current !== null) {
        // Something is already showing; just append to queue
        return { ...prev, queue: combined }
      }
      // Nothing showing — surface the first eligible item immediately
      const { next, remaining } = pickNext(combined, takeoverShownRef.current)
      if (next && TAKEOVER_TYPES.has(next.reward_type)) takeoverShownRef.current = true
      return { queue: remaining, current: next }
    })
  }, [])

  const loadUnseenRewards = useCallback(async (userId: string) => {
    const unseen = await getUnseenRewards(userId)
    if (unseen.length > 0) queueRewards(unseen)
  }, [queueRewards])

  const dismiss = useCallback(() => {
    setState(prev => {
      if (prev.current) markRewardSeen(prev.current.id, prev.current.user_id)
      const { next, remaining } = pickNext(prev.queue, takeoverShownRef.current)
      if (next && TAKEOVER_TYPES.has(next.reward_type)) takeoverShownRef.current = true
      return { queue: remaining, current: next }
    })
  }, [])

  return (
    <RewardContext.Provider value={{
      queueRewards,
      loadUnseenRewards,
      current: state.current,
      dismiss,
    }}>
      {children}
    </RewardContext.Provider>
  )
}

export function useRewards(): RewardContextValue {
  const ctx = useContext(RewardContext)
  if (!ctx) throw new Error('useRewards must be used inside RewardProvider')
  return ctx
}
