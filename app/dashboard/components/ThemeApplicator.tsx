'use client'
import { useEffect } from 'react'

export default function ThemeApplicator() {
  useEffect(() => {
    const apply = () => {
      const stored = localStorage.getItem('cadence_theme') || 'automatic'
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const isDark = stored === 'dark' || (stored === 'automatic' && prefersDark)
      document.documentElement.classList.toggle('dark', isDark)
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => apply()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return null
}
