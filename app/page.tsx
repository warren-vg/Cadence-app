import Link from 'next/link'

export default function WelcomePage() {
  const features = [
    {
      color: '#3B7DFF',
      text: 'Build a life system you can trust with strategic clarity and adaptive execution',
    },
    {
      color: '#FF9500',
      text: 'Balance career, health, creativity, and growth without overwhelm',
    },
    {
      color: '#34C759',
      text: 'Recover after drift and stay aligned with what matters most',
    },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F2F2F7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      }}
    >
      {/* App Icon */}
      <div
        style={{
          width: 80,
          height: 80,
          background: '#3B7DFF',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <span style={{ color: 'white', fontSize: 36 }}>✦</span>
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: '#1C1C1E',
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        Cadence
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: 16,
          color: '#8E8E93',
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.5,
          marginBottom: 40,
        }}
      >
        Turn big annual goals into an adaptive weekly operating system
      </p>

      {/* Feature Cards */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 40,
        }}
      >
        {features.map((feature, i) => (
          <div
            key={i}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: feature.color,
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontSize: 15,
                color: '#3C3C43',
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {feature.text}
            </p>
          </div>
        ))}
      </div>

      {/* Get Started Button */}
      <Link
        href="/signup"
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#3B7DFF',
          color: 'white',
          borderRadius: 16,
          padding: '18px',
          fontSize: 17,
          fontWeight: 600,
          textAlign: 'center',
          textDecoration: 'none',
          display: 'block',
          marginBottom: 16,
        }}
      >
        Get Started
      </Link>

      {/* View Demo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 24,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13, color: '#3C3C43' }}>▶</span>
        <span style={{ fontSize: 15, color: '#3C3C43', fontWeight: 500 }}>
          View Demo
        </span>
      </div>

      {/* Sign In Link */}
      <p style={{ fontSize: 14, color: '#8E8E93', margin: 0 }}>
        Already have an account?{' '}
        <Link
          href="/login"
          style={{ color: '#3B7DFF', textDecoration: 'none', fontWeight: 500 }}
        >
          Sign In
        </Link>
      </p>
    </div>
  )
}