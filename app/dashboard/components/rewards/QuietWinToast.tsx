'use client'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { type DBRewardEvent } from '@/lib/rewards'

interface QuietWinToastProps {
  reward: DBRewardEvent | null
  onDismiss: () => void
}

/**
 * Inline Quiet Win toast. No scrim, no takeover.
 * Lavender tint, "Nice." accent, auto-dismisses after 2 s.
 * Positioned fixed at bottom above the nav bar.
 */
export default function QuietWinToast({ reward, onDismiss }: QuietWinToastProps) {
  const reduced = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!reward) return
    timerRef.current = setTimeout(onDismiss, 2000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [reward, onDismiss])

  const category = (reward?.context as Record<string, string> | undefined)?.category ?? ''

  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          key={reward.id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={onDismiss}
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 350,
            cursor: 'pointer',
            maxWidth: 'calc(100vw - 32px)',
            width: 'max-content',
          }}
        >
          {/* Soft lavender bloom behind the toast */}
          {!reduced && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              aria-hidden
              style={{
                position: 'absolute',
                inset: -8,
                borderRadius: 20,
                background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
          )}

          <div
            style={{
              position: 'relative',
              background: '#F5F3FF',
              border: '1px solid #DDD6FE',
              borderRadius: 12,
              padding: '11px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
            }}
          >
            {/* Small check circle */}
            <div style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#7C3AED',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <span style={{ fontSize: 14, fontWeight: 500, color: '#5B21B6', whiteSpace: 'nowrap' }}>
              {category ? `${category} task` : 'Deep work session'}{' '}
              <span style={{ color: '#7C3AED', fontWeight: 600 }}>Nice.</span>
            </span>

            <button
              onClick={e => { e.stopPropagation(); onDismiss() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4, display: 'flex', alignItems: 'center' }}
              aria-label="Dismiss"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <p style={{ fontSize: 11, color: '#8B5CF6', textAlign: 'center', margin: '5px 0 0', opacity: 0.75 }}>
            Quiet wins add up.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
