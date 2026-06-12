'use client'
import React from 'react'

interface EmptyStateProps {
  /** Rendered SVG icon element — use thin-line (strokeWidth 1.5–2) SF-Symbol-style icons */
  icon: React.ReactNode
  /** Tint color applied to the circular icon container background (use category or semantic tints from the token sheet) */
  iconBg?: string
  /** Bold black title */
  title: string
  /** Conversational gray body copy, 1–3 lines */
  body: string
  /** Primary CTA button label */
  ctaLabel: string
  onCta: () => void
  /** Optional secondary text link below the CTA */
  secondaryLabel?: string
  onSecondary?: () => void
}

export default function EmptyState({
  icon, iconBg = '#EFF6FF',
  title, body,
  ctaLabel, onCta,
  secondaryLabel, onSecondary,
}: EmptyStateProps) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 20,
      padding: '40px 20px',
      border: '0.5px solid #E5E5EA',
      textAlign: 'center',
    }}>
      {/* Circular tinted icon container */}
      <div style={{
        width: 72, height: 72,
        borderRadius: '50%',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 18px',
      }}>
        {icon}
      </div>

      {/* Title */}
      <p style={{
        fontSize: 18,
        fontWeight: 700,
        color: '#1C1C1E',
        margin: '0 0 8px',
        lineHeight: 1.3,
      }}>
        {title}
      </p>

      {/* Body */}
      <p style={{
        fontSize: 14,
        color: '#8E8E93',
        margin: '0 0 24px',
        lineHeight: 1.55,
        maxWidth: 280,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        {body}
      </p>

      {/* Primary CTA */}
      <button
        onClick={onCta}
        style={{
          width: '100%',
          padding: '15px',
          borderRadius: 14,
          border: 'none',
          background: '#3B7DFF',
          color: 'white',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {ctaLabel}
      </button>

      {/* Optional secondary link */}
      {secondaryLabel && onSecondary && (
        <button
          onClick={onSecondary}
          style={{
            marginTop: 14,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: '#3B7DFF',
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  )
}
