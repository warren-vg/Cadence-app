'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import RewardModal from './RewardModal'
import QuietWinToast from './QuietWinToast'
import { useRewards } from '../RewardContext'
import { type DBRewardEvent } from '@/lib/rewards'

// ─── Shared sub-components ────────────────────────────────────────────────────

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 22, fontWeight: 700, color: '#1C1C1E',
      margin: '0 0 6px', textAlign: 'center', letterSpacing: '-0.3px',
    }}>
      {children}
    </p>
  )
}

function CardSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, color: '#8E8E93', margin: 0, textAlign: 'center' }}>
      {children}
    </p>
  )
}

/** Filled accent circle + floating outer ring + one entry pulse. */
function RewardIconRing({
  accent, children, reduced,
}: {
  accent: string
  children: React.ReactNode
  reduced: boolean
}) {
  return (
    <div style={{
      position: 'relative', width: 92, height: 92,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 24px',
    }}>
      {/* Outer floating ring */}
      <motion.div
        initial={reduced ? undefined : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.55 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 22, delay: 0.1 }}
        style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%', border: `2px solid ${accent}`,
        }}
      />
      {/* Single pulse — fires once after entry, then settles */}
      {!reduced && (
        <motion.div
          animate={{ scale: [1, 1.07, 1], opacity: [0.55, 0.25, 0.55] }}
          transition={{ duration: 0.9, delay: 0.65, times: [0, 0.5, 1] }}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%', border: `2px solid ${accent}`,
          }}
        />
      )}
      {/* Inner filled circle */}
      <motion.div
        initial={reduced ? undefined : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 22, delay: 0.2 }}
        style={{
          width: 72, height: 72, borderRadius: '50%', background: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 6px 24px ${accent}44`,
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}

/** Count-up animation hook. Returns current display integer. */
function useCountUp(target: number, durationMs: number, reduced: boolean): number {
  const [val, setVal] = useState(reduced ? target : 0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    if (reduced) { setVal(target); return }
    setVal(0)
    const start = Date.now()
    const tick = () => {
      const pct = Math.min((Date.now() - start) / durationMs, 1)
      setVal(Math.round(pct * target))
      if (pct < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, durationMs, reduced])
  return val
}

// ─── Individual card contents ─────────────────────────────────────────────────

// --- The First Move ---
function FirstMoveCard({ reduced }: { reduced: boolean }) {
  return (
    <>
      <RewardIconRing accent="#FF9500" reduced={reduced}>
        {/* Footprint icon — two elongated ovals offset diagonally */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
          <path d="M8 3 C5.5 3 5 5 5 8 C5 11 5.5 13 8 13 C10.5 13 11 11 11 8 C11 5 10.5 3 8 3 Z" />
          <path d="M16 11 C13.5 11 13 13 13 16 C13 19 13.5 21 16 21 C18.5 21 19 19 19 16 C19 13 18.5 11 16 11 Z" />
        </svg>
      </RewardIconRing>
      <CardTitle>Your first move.</CardTitle>
      <CardSubtitle>Momentum starts with one.</CardSubtitle>
    </>
  )
}

// --- Full Day ---
function FullDayCard({ ctx, reduced }: { ctx: Record<string, unknown>; reduced: boolean }) {
  const titles = (ctx.taskTitles as string[] | undefined) ?? []
  const extraCount = Math.max(0, ((ctx.taskCount as number | undefined) ?? titles.length) - titles.length)

  return (
    <>
      <RewardIconRing accent="#3B7DFF" reduced={reduced}>
        {/* Sun icon */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
          <line x1="4.9" y1="4.9" x2="7.1" y2="7.1" />
          <line x1="16.9" y1="16.9" x2="19.1" y2="19.1" />
          <line x1="19.1" y1="4.9" x2="16.9" y2="7.1" />
          <line x1="7.1" y1="16.9" x2="4.9" y2="19.1" />
        </svg>
      </RewardIconRing>

      {/* Task rows — light up with stagger */}
      {titles.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {titles.map((title, i) => (
            <motion.div
              key={i}
              initial={reduced ? undefined : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.3, delay: 0.5 + i * 0.09 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 8,
                background: '#F8F8FC',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#3B7DFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span style={{
                fontSize: 13, color: '#8E8E93', textDecoration: 'line-through',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {title}
              </span>
            </motion.div>
          ))}
          {extraCount > 0 && (
            <p style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', margin: 0 }}>
              +{extraCount} more
            </p>
          )}
        </div>
      )}

      <CardTitle>A full day.</CardTitle>
      <CardSubtitle>Everything you planned, done.</CardSubtitle>
    </>
  )
}

// --- Perfect Week ---
function PerfectWeekCard({ reduced }: { reduced: boolean }) {
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const CIRCUMFERENCE = 2 * Math.PI * 38  // r=38 on 100×100 viewBox
  const count = useCountUp(7, 1200, reduced)

  return (
    <>
      {/* Large ring with animated stroke-dashoffset + counting number */}
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="120" height="120" viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          {/* Background track */}
          <circle cx="50" cy="50" r="38" fill="none" stroke="#E5E5EA" strokeWidth="3" />
          {/* Animated fill */}
          <motion.circle
            cx="50" cy="50" r="38"
            fill="none" stroke="#9333EA" strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: reduced ? 0 : 0 }}
            transition={reduced ? { duration: 0 } : { duration: 1.8, ease: 'easeInOut', delay: 0.3 }}
            style={{ strokeDashoffset: reduced ? 0 : CIRCUMFERENCE }}
          />
        </svg>
        {/* Count + label */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#9333EA', margin: 0, lineHeight: 1 }}>{count}</p>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9333EA', margin: '2px 0 0', letterSpacing: 1, textTransform: 'uppercase' }}>DAYS</p>
        </div>
      </div>

      {/* 7 day circles */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
        {DAYS.map((day, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <motion.div
              initial={reduced ? undefined : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20, delay: 0.5 + i * 0.12 }}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: '#9333EA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <span style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{day}</span>
          </div>
        ))}
      </div>

      <CardTitle>A perfect week.</CardTitle>
      <CardSubtitle>You showed up every day. That&apos;s rare.</CardSubtitle>
    </>
  )
}

// --- Streak Milestone ---
function StreakMilestoneCard({ ctx, reduced }: { ctx: Record<string, unknown>; reduced: boolean }) {
  const tier = (ctx.tier as number) ?? 7
  const count = useCountUp(tier, 1000, reduced)

  return (
    <>
      {/* Custom icon ring: flame + count inside */}
      <div style={{ position: 'relative', width: 92, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <motion.div
          initial={reduced ? undefined : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.55 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 22, delay: 0.1 }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #FF9500' }}
        />
        {!reduced && (
          <motion.div
            animate={{ scale: [1, 1.07, 1], opacity: [0.55, 0.25, 0.55] }}
            transition={{ duration: 0.9, delay: 0.65, times: [0, 0.5, 1] }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #FF9500' }}
          />
        )}
        <motion.div
          initial={reduced ? undefined : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 22, delay: 0.2 }}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF9500, #FF3B30)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 24px rgba(255,149,0,0.35)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ marginBottom: 0 }}>
            <path d="M12 2C12 2 10 6 8 8C6 10 4 12 4 14C4 17.3 7.6 20 12 20C16.4 20 20 17.3 20 14C20 12 18 10 16 8C14 6 12 2 12 2Z" />
            <path d="M12 20V22" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0, lineHeight: 1 }}>{count}</p>
        </motion.div>
      </div>

      {/* Streak bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>WEEK STREAK</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#FF9500' }}>{tier}</span>
        </div>
        <div style={{ background: '#E5E5EA', borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={reduced ? { duration: 0 } : { duration: 1.2, ease: 'easeOut', delay: 0.6 }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #FF9500, #FF3B30)',
              borderRadius: 6,
            }}
          />
        </div>
      </div>

      <CardTitle>{tier}-week streak.</CardTitle>
      <CardSubtitle>You keep coming back. That&apos;s everything.</CardSubtitle>
    </>
  )
}

// --- First Reflection ---
function FirstReflectionCard({ ctx, reduced }: { ctx: Record<string, unknown>; reduced: boolean }) {
  const streak = (ctx.streak as number) ?? 1

  return (
    <>
      {/* WEEK chip */}
      <motion.div
        initial={reduced ? undefined : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 20 }}
        style={{ textAlign: 'center', marginBottom: 16 }}
      >
        <span style={{
          display: 'inline-block',
          fontSize: 12, fontWeight: 600, color: '#9333EA',
          background: '#FDF4FF', border: '1px solid #E9D5FF',
          borderRadius: 20, padding: '4px 12px', letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
          WEEK {streak}
        </span>
      </motion.div>

      <RewardIconRing accent="#9333EA" reduced={reduced}>
        {/* Open book icon */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5 C5 5 9 5 12 6 L12 20 C9 19 5 19 3 19 Z" />
          <path d="M21 5 C19 5 15 5 12 6 L12 20 C15 19 19 19 21 19 Z" />
        </svg>
      </RewardIconRing>

      {/* Reflection lines — animate as if writing */}
      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        {[0.85, 0.70, 0.50].map((width, i) => (
          <div key={i} style={{ width: '100%', height: 8, background: '#F2F2F7', borderRadius: 4, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${width * 100}%` }}
              transition={reduced ? { duration: 0 } : { duration: 0.5, delay: 0.8 + i * 0.18, ease: 'easeOut' }}
              style={{ height: '100%', background: '#DDD6FE', borderRadius: 4 }}
            />
          </div>
        ))}
      </div>

      <CardTitle>Your first reflection.</CardTitle>
      <CardSubtitle>This is the habit that compounds.</CardSubtitle>
    </>
  )
}

// --- Goal Complete ---
function GoalCompleteCard({ ctx, reduced }: { ctx: Record<string, unknown>; reduced: boolean }) {
  const goalTitle = (ctx.goalTitle as string | undefined) ?? 'Goal'
  const GOLD = '#D97706'

  return (
    <>
      {/* Gold rings radiating outward — overlay behind the icon ring */}
      <div style={{ position: 'relative', width: 92, height: 92, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!reduced && [0, 1, 2].map(i => (
          <motion.div
            key={i}
            initial={{ scale: 0.85, opacity: 0.7 }}
            animate={{ scale: 1.4 + i * 0.25, opacity: 0 }}
            transition={{ duration: 1.3, delay: 0.3 + i * 0.22, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${GOLD}` }}
          />
        ))}
        {/* Outer floating ring */}
        <motion.div
          initial={reduced ? undefined : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.55 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 22, delay: 0.1 }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${GOLD}` }}
        />
        {/* Inner gold circle */}
        <motion.div
          initial={reduced ? undefined : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 22, delay: 0.2 }}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `linear-gradient(135deg, #FBBF24, ${GOLD})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 6px 24px ${GOLD}55`,
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>
      </div>

      {/* Goal title pill */}
      <motion.div
        initial={reduced ? undefined : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.4, delay: 0.85 }}
        style={{
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 12, padding: '10px 16px', marginBottom: 20,
        }}
      >
        <p style={{
          fontSize: 14, fontWeight: 600, color: '#1C1C1E',
          margin: '0 0 2px', textAlign: 'center',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {goalTitle.length > 36 ? goalTitle.slice(0, 36) + '…' : goalTitle}
        </p>
        <p style={{ fontSize: 12, color: GOLD, margin: 0, textAlign: 'center' }}>goal · completed</p>
      </motion.div>

      <CardTitle>Goal complete.</CardTitle>
      <CardSubtitle>You finished what you started.</CardSubtitle>
    </>
  )
}

// --- Back in Rhythm ---
function BackInRhythmCard({ reduced }: { reduced: boolean }) {
  // Momentum wave path — dips then rises (simplified illustrative path)
  const PATH = 'M4 28 C20 28 28 38 50 38 C72 38 78 20 96 14'
  const PATH_LEN = 120  // approximate; used for dashoffset animation

  return (
    <>
      <RewardIconRing accent="#FF9500" reduced={reduced}>
        {/* Metronome icon */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="20" y2="21" />
          <path d="M8.5 21 L11.5 4 L12.5 4 L15.5 21 Z" />
          <line x1="12" y1="21" x2="18" y2="10" />
          <circle cx="18.5" cy="9" r="1.5" fill="white" />
          <line x1="10" y1="13" x2="14" y2="13" />
        </svg>
      </RewardIconRing>

      {/* Momentum line — draws left-to-right */}
      <div style={{ margin: '0 0 20px', height: 56, position: 'relative' }}>
        <svg width="100%" height="56" viewBox="0 0 100 56" preserveAspectRatio="none">
          {/* Background track */}
          <path d={PATH} fill="none" stroke="#E5E5EA" strokeWidth="2.5" strokeLinecap="round" />
          {/* Animated foreground line */}
          <motion.path
            d={PATH}
            fill="none"
            stroke="#FF9500"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={PATH_LEN}
            initial={{ strokeDashoffset: PATH_LEN }}
            animate={{ strokeDashoffset: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 1.2, ease: 'easeInOut', delay: 0.5 }}
          />
          {/* End dot */}
          <motion.circle
            cx="96" cy="14" r="4" fill="#FF9500"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20, delay: 1.6 }}
          />
        </svg>
      </div>

      {/* "Momentum restored" pill */}
      <motion.div
        initial={reduced ? undefined : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.35, delay: 1.0 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          background: '#FFF7ED', border: '1px solid #FED7AA',
          borderRadius: 20, padding: '6px 14px', marginBottom: 20,
          width: 'fit-content', margin: '0 auto 20px',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF9500' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>Momentum restored</span>
      </motion.div>

      <CardTitle>Back in rhythm.</CardTitle>
      <CardSubtitle>Right where you left off.</CardSubtitle>
    </>
  )
}

// ─── Main RewardDisplay ───────────────────────────────────────────────────────

/**
 * Reads the current reward from context and renders either a RewardModal
 * or a QuietWinToast. Mount this once in the dashboard layout.
 */
export default function RewardDisplay() {
  const { current, dismiss } = useRewards()
  const reduced = useReducedMotion() ?? false

  const isQuietWin = current?.reward_type === 'quiet_win'
  const ctx = (current?.context ?? {}) as Record<string, unknown>

  function renderContent(reward: DBRewardEvent) {
    switch (reward.reward_type) {
      case 'first_move':    return <FirstMoveCard reduced={reduced} />
      case 'full_day':      return <FullDayCard ctx={ctx} reduced={reduced} />
      case 'perfect_week':  return <PerfectWeekCard reduced={reduced} />
      case 'streak_milestone': return <StreakMilestoneCard ctx={ctx} reduced={reduced} />
      case 'first_reflection': return <FirstReflectionCard ctx={ctx} reduced={reduced} />
      case 'goal_complete':    return <GoalCompleteCard ctx={ctx} reduced={reduced} />
      case 'back_in_rhythm':   return <BackInRhythmCard reduced={reduced} />
      default: return null
    }
  }

  return (
    <>
      {/* Full-screen modal rewards */}
      <RewardModal
        open={!!(current && !isQuietWin)}
        onClose={dismiss}
      >
        {current && !isQuietWin && renderContent(current)}
      </RewardModal>

      {/* Inline quiet win toast */}
      <QuietWinToast
        reward={isQuietWin ? current : null}
        onDismiss={dismiss}
      />
    </>
  )
}
