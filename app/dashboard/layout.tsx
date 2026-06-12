import BottomNav from './components/BottomNav'
import NotificationBell from './components/NotificationBell'
import UsernameBackfillModal from './components/UsernameBackfillModal'
import TourShell from './components/TourShell'
import { RewardProvider } from './components/RewardContext'
import RewardDisplay from './components/rewards/RewardDisplay'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TourShell>
      <RewardProvider>
        <div style={{
          background: '#F2F2F7',
          minHeight: '100vh',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        }}>
          {/* Blocks app access for users without a @username (post-migration backfill) */}
          <UsernameBackfillModal />
          {/* floating=true: renders on every page except /dashboard (home handles it inline) */}
          <NotificationBell floating />
          <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 88 }}>
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
