import BottomNav from './components/BottomNav'
import UsernameBackfillModal from './components/UsernameBackfillModal'
import TourShell from './components/TourShell'
import { RewardProvider } from './components/RewardContext'
import RewardDisplay from './components/rewards/RewardDisplay'
import ThemeApplicator from './components/ThemeApplicator'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TourShell>
      <RewardProvider>
        <div
          className="theme-layout"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
          }}
        >
          <ThemeApplicator />
          {/* Blocks app access for users without a @username (post-migration backfill) */}
          <UsernameBackfillModal />
          <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 104 }}>
            {children}
          </div>
          <BottomNav />
          {/* Reward modals and toasts — rendered above nav, below nothing */}
          <RewardDisplay />
        </div>
      </RewardProvider>
    </TourShell>
  )
}
