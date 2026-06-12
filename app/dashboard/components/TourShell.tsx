'use client'
import { TourProvider } from './TourContext'
import CoachmarkOverlay from './CoachmarkOverlay'

export default function TourShell({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider>
      {children}
      <CoachmarkOverlay />
    </TourProvider>
  )
}
