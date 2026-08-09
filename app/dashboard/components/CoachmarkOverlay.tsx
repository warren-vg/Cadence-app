'use client'
import { useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useTour } from './TourContext'
import { TOUR_STEPS } from '@/lib/tourConfig'

const CARD_WIDTH = 340
const SPOTLIGHT_PAD = 10

export default function CoachmarkOverlay() {
  const { active, currentStep, stepIndex, anchorRect, measureAnchor, advance, skipTour } = useTour()
  const reduceMotion = useReducedMotion()

  // Measure anchor on step change, then retry after layout settles
  useEffect(() => {
    if (!active || !currentStep) return
    measureAnchor(currentStep.anchor)
    const retry = setTimeout(() => measureAnchor(currentStep.anchor), 200)
    return () => clearTimeout(retry)
  }, [active, currentStep?.id, measureAnchor])

  // Re-measure on resize
  useEffect(() => {
    if (!active || !currentStep) return
    const onResize = () => measureAnchor(currentStep.anchor)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active, currentStep, measureAnchor])

  if (!active || !currentStep) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 375
  const vh = typeof window !== 'undefined' ? window.innerHeight : 812

  // ── Card positioning ──────────────────────────────────────────────────────
  let cardStyle: React.CSSProperties = {}
  let arrowOnTop = false // true = caret points upward (card is below anchor)

  if (anchorRect) {
    const spotBottom = anchorRect.top + anchorRect.height + SPOTLIGHT_PAD
    const spotTop    = anchorRect.top - SPOTLIGHT_PAD
    const spaceBelow = vh - spotBottom
    const spaceAbove = spotTop

    if (spaceBelow >= 240 || spaceBelow >= spaceAbove) {
      // Place card below anchor
      cardStyle = { top: spotBottom + 16, bottom: 'auto' }
      arrowOnTop = true
    } else {
      // Place card above anchor
      cardStyle = { bottom: vh - spotTop + 16, top: 'auto' }
      arrowOnTop = false
    }

    // Horizontal: center over anchor, clamped to viewport
    const idealLeft = (anchorRect.left + anchorRect.width / 2) - CARD_WIDTH / 2
    cardStyle.left = Math.max(16, Math.min(vw - CARD_WIDTH - 16, idealLeft))
  } else {
    // No anchor found — center card vertically
    cardStyle = {
      top: Math.max(80, vh / 2 - 160),
      left: Math.max(16, (vw - CARD_WIDTH) / 2),
    }
  }

  // Caret horizontal position (relative to card left edge, pointing at anchor center)
  const caretLeft = anchorRect
    ? Math.max(16, Math.min(CARD_WIDTH - 28, (anchorRect.left + anchorRect.width / 2) - (cardStyle.left as number) - 8))
    : CARD_WIDTH / 2 - 8

  // ── Animation variants ────────────────────────────────────────────────────
  const cardVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit:    { opacity: 0 },
      }
    : {
        initial: { opacity: 0, scale: 0.91, y: arrowOnTop ? -12 : 12 },
        animate: { opacity: 1, scale: 1,    y: 0 },
        exit:    { opacity: 0, scale: 0.95, y: arrowOnTop ? -6 : 6 },
      }

  const cardTransition = reduceMotion
    ? { duration: 0.15 }
    : { type: 'spring' as const, stiffness: 360, damping: 26, mass: 0.85 }

  // ── Spotlight SVG geometry ────────────────────────────────────────────────
  const sl = anchorRect ? anchorRect.left  - SPOTLIGHT_PAD : -1
  const st = anchorRect ? anchorRect.top   - SPOTLIGHT_PAD : -1
  const sw = anchorRect ? anchorRect.width  + SPOTLIGHT_PAD * 2 : 0
  const sh = anchorRect ? anchorRect.height + SPOTLIGHT_PAD * 2 : 0

  return (
    <>
      {/* Click blocker — no-op; tapping the scrim does nothing */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={currentStep.title}
        style={{ position: 'fixed', inset: 0, zIndex: 400 }}
        onClick={e => e.stopPropagation()}
      />

      {/* SVG scrim with spotlight cutout (visual only, no pointer events) */}
      <svg
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          zIndex: 401,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {anchorRect && (
              <rect x={sl} y={st} width={sw} height={sh} rx={14} fill="black" />
            )}
          </mask>
        </defs>
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-spotlight-mask)"
        />
        {/* Subtle ring around the spotlight */}
        {anchorRect && (
          <rect
            x={sl - 1} y={st - 1} width={sw + 2} height={sh + 2}
            rx={15} fill="none"
            stroke="rgba(255,255,255,0.25)" strokeWidth={1.5}
          />
        )}
      </svg>

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.id}
          variants={cardVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={cardTransition}
          style={{
            position: 'fixed',
            width: CARD_WIDTH,
            zIndex: 402,
            ...cardStyle,
          }}
        >
          <div style={{
            background: 'var(--c-surface)',
            borderRadius: 20,
            padding: '22px 20px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            position: 'relative',
          }}>
            {/* Directional caret */}
            {anchorRect && (
              <div style={{
                position: 'absolute',
                left: caretLeft,
                ...(arrowOnTop ? { top: -8 } : { bottom: -8 }),
                width: 16, height: 9,
                background: 'var(--c-surface)',
                clipPath: arrowOnTop
                  ? 'polygon(50% 0%, 0% 100%, 100% 100%)'
                  : 'polygon(0% 0%, 100% 0%, 50% 100%)',
                // Match the card's drop-shadow
                filter: 'drop-shadow(0 -2px 2px rgba(0,0,0,0.06))',
              }} />
            )}

            {/* Blue accent dot */}
            <div style={{
              width: 44, height: 44,
              borderRadius: '50%',
              background: '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <div style={{
                width: 16, height: 16,
                borderRadius: '50%',
                background: '#3B7DFF',
              }} />
            </div>

            {/* Title */}
            <p style={{
              fontSize: 18, fontWeight: 700, color: 'var(--c-text-1)',
              margin: '0 0 8px', textAlign: 'center', lineHeight: 1.3,
            }}>
              {currentStep.title}
            </p>

            {/* Body */}
            <p style={{
              fontSize: 14, color: 'var(--c-text-2)',
              margin: '0 0 20px', textAlign: 'center', lineHeight: 1.55,
            }}>
              {currentStep.body}
            </p>

            {/* Primary CTA */}
            <button
              onClick={advance}
              style={{
                width: '100%', padding: '15px',
                borderRadius: 14, border: 'none',
                background: '#3B7DFF', color: 'white',
                fontSize: 15, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {currentStep.ctaLabel}
            </button>

            {/* Progress dots + Skip */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
            }}>
              {/* Pill-style progress indicators */}
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === stepIndex ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === stepIndex ? '#3B7DFF' : '#D1D1D6',
                      transition: reduceMotion ? 'none' : 'width 0.22s ease, background 0.22s ease',
                    }}
                  />
                ))}
              </div>

              <button
                onClick={skipTour}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: 'var(--c-text-2)',
                  fontFamily: 'inherit', padding: 0,
                }}
              >
                Skip tour
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
