import BottomNav from './components/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#F2F2F7',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 88 }}>
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
