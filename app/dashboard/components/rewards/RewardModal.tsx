'use client'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

interface RewardModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

/**
 * Shared shell for all full-screen reward modals.
 * Dimmed scrim → centered frosted card → close X top-right → glass streak sweep.
 * All motion degrades to static fade under prefers-reduced-motion.
 */
export default function RewardModal({ open, onClose, children }: RewardModalProps) {
  const reduced = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        // Scrim
        <motion.div
          key="reward-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px',
            zIndex: 400,
          }}
        >
          {/* Card — stops click-through to scrim */}
          <motion.div
            key="reward-card"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={
              reduced
                ? { duration: 0.2 }
                : { type: 'spring', stiffness: 300, damping: 28, mass: 0.9 }
            }
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 28,
              padding: '40px 28px 36px',
              maxWidth: 340,
              width: '100%',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#F2F2F7',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                zIndex: 1,
              }}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3C3C43" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Glass streak sweep — runs once on entry */}
            {!reduced && (
              <motion.div
                initial={{ x: '-110%' }}
                animate={{ x: '220%' }}
                transition={{ duration: 0.85, ease: 'easeOut', delay: 0.35 }}
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.10) 50%, transparent 75%)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
            )}

            {/* Card content */}
            <div style={{ position: 'relative', zIndex: 0 }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
