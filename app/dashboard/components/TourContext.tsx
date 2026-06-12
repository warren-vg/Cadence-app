'use client'
import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react'
import { useRouter } from 'next/navigation'
import { TOUR_STEPS, type TourStep } from '@/lib/tourConfig'
import { markFirstRunComplete } from '@/lib/db'

interface AnchorRect {
  top: number; left: number; width: number; height: number
}

interface TourContextValue {
  active: boolean
  currentStep: TourStep | null
  stepIndex: number
  totalSteps: number
  anchorRect: AnchorRect | null
  isFirstRun: boolean
  startTour: (userId: string, firstRun?: boolean) => void
  advance: () => void
  skipTour: () => void
  measureAnchor: (id: string) => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [active, setActive]       = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const [isFirstRun, setIsFirstRun] = useState(false)
  const [navTarget, setNavTarget] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  const currentStep = active ? (TOUR_STEPS[stepIndex] ?? null) : null

  // Deferred navigation — fires after state updates settle to avoid
  // "setState during render" conflicts with Next.js App Router.
  useEffect(() => {
    if (navTarget === null) return
    router.push(navTarget)
    setNavTarget(null)
  }, [navTarget, router])

  const measureAnchor = useCallback((id: string) => {
    const el = document.querySelector(`[data-tour="${id}"]`)
    if (!el) { setAnchorRect(null); return }
    const r = el.getBoundingClientRect()
    setAnchorRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [])

  const startTour = useCallback((userId: string, firstRun = false) => {
    userIdRef.current = userId
    setIsFirstRun(firstRun)
    setStepIndex(0)
    setActive(true)
    const firstStep = TOUR_STEPS[0]
    if (firstStep) setNavTarget(firstStep.route)
  }, [])

  const finishTour = useCallback(async () => {
    setActive(false)
    setAnchorRect(null)
    if (isFirstRun && userIdRef.current) {
      await markFirstRunComplete(userIdRef.current)
    }
  }, [isFirstRun])

  const advance = useCallback(async () => {
    const step = TOUR_STEPS[stepIndex]
    if (!step) return

    if (step.ctaAction === 'finish') {
      await finishTour()
      return
    }

    if (step.ctaAction === 'try') {
      const el = document.querySelector(`[data-tour="${step.anchor}"]`) as HTMLElement | null
      if (el) el.click()
      setTimeout(() => {
        const nextIndex = stepIndex + 1
        if (nextIndex >= TOUR_STEPS.length) { finishTour(); return }
        const nextStep = TOUR_STEPS[nextIndex]
        setStepIndex(nextIndex)
        setAnchorRect(null)
        if (nextStep && nextStep.route !== step.route) setNavTarget(nextStep.route)
      }, 400)
      return
    }

    const nextIndex = stepIndex + 1
    if (nextIndex >= TOUR_STEPS.length) { await finishTour(); return }

    const nextStep = TOUR_STEPS[nextIndex]
    setStepIndex(nextIndex)
    setAnchorRect(null)

    if (nextStep && nextStep.route !== step.route) {
      setNavTarget(nextStep.route)
    }
  }, [stepIndex, finishTour])

  const skipTour = useCallback(async () => {
    await finishTour()
  }, [finishTour])

  return (
    <TourContext.Provider value={{
      active, currentStep, stepIndex, totalSteps: TOUR_STEPS.length,
      anchorRect, isFirstRun,
      startTour, advance, skipTour, measureAnchor,
    }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used within TourProvider')
  return ctx
}
