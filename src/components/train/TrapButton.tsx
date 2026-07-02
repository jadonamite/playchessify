import { ButtonHTMLAttributes } from 'react'

interface TrapButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Face/glow colour. Defaults to the brand cyan. */
  accent?: string
  fullWidth?: boolean
}

const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, disabled: boolean) => {
  if (!disabled) {
    e.currentTarget.style.transform = 'translateY(-2px)'
    e.currentTarget.style.filter = 'brightness(1.06)'
  }
}

const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = ''
  e.currentTarget.style.filter = ''
}

/**
 * The brand trapezoid CTA (same clip-path as the landing's "TRAIN WITH" button),
 * but accent-aware so coach-coloured calls-to-action stay on-brand across the
 * training flow.
 */
export default function TrapButton({
  accent = '#38e8ff', fullWidth = true, children, style, disabled, ...props
}: TrapButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        border: 'none',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--fd)',
        fontWeight: 800,
        letterSpacing: '.06em',
        fontSize: 14,
        color: '#04121a',
        padding: '16px 28px',
        width: fullWidth ? '100%' : undefined,
        opacity: disabled ? 0.5 : 1,
        clipPath: 'polygon(16px 0%, 100% 0%, calc(100% - 16px) 100%, 0% 100%)',
        background: `linear-gradient(135deg, ${accent}, ${accent}b3)`,
        boxShadow: `0 0 28px ${accent}66`,
        transition: 'transform .15s ease, filter .15s ease',
        ...style,
      }}
      onMouseEnter={(e) => handleMouseEnter(e, disabled)}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </button>
  )
}
