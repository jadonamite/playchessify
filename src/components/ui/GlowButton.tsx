'use client'
import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'brand' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  parallelogram?: boolean
  loading?: boolean
  fullWidth?: boolean
  icon?: ReactNode
}

/* ── shared brand colours (work in both themes via CSS vars) ── */
// const BRAND_FACE_LIGHT = 'linear_-gradient(180deg,#00aadd 0%,#0088bb 40%,#007aaa 75%,#006699 100%)'

/* We detect the theme via data-theme on <html> at render time — but since this is
   a client component we read it safely from the DOM. We use CSS custom properties
   instead so the button adapts automatically without JS reads. */

const btnBase: React.CSSProperties = {
  fontFamily: 'var(--fd)',
  fontWeight: 800,
  letterSpacing: '.08em',
  color: 'var(--btn-text, #001a22)',
  background: 'var(--btn-face)',
  border: 'none',
  cursor: 'pointer',
  boxShadow: 'var(--btn-shadow)',
  transition: 'all .15s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative' as const,
}

/* Fluid sizing — buttons shrink on small viewports and settle at the original
   desktop dimensions at wider widths: clamp(mobile-min, vw-preferred, desktop-max). */
const pillSize: Record<string, React.CSSProperties> = {
  sm: { fontSize: 'clamp(10px,2.6vw,11px)', padding: 'clamp(9px,2.4vw,10px) clamp(16px,4.6vw,22px)', borderRadius: 999 },
  md: { fontSize: 'clamp(11px,2.8vw,12px)', padding: 'clamp(10px,2.6vw,11px) clamp(18px,5vw,26px)', borderRadius: 999 },
  lg: { fontSize: 'clamp(12px,3vw,13px)', padding: 'clamp(12px,3vw,15px) clamp(22px,6vw,34px)', borderRadius: 999 },
}

const ghostBase: React.CSSProperties = {
  fontFamily: 'var(--fd)',
  fontWeight: 700,
  fontSize: 'clamp(11px,2.9vw,13px)',
  letterSpacing: '.07em',
  color: 'var(--c)',
  background: 'transparent',
  border: 'none',
  borderRadius: 999,
  padding: 'clamp(12px,3.2vw,16px) clamp(22px,7vw,40px)',
  cursor: 'pointer',
  display: 'inline-block',
  boxShadow: '0 0 0 1px var(--b2), 0 4px 0 rgba(0,50,70,.5), 0 8px 24px rgba(0,204,255,.1)',
  transition: 'all .18s ease',
}

const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  (
    { variant = 'brand', size = 'md', parallelogram = false, loading = false,
      fullWidth = false, icon, className = '', children, disabled, style, ...props },
    ref
  ) => {
    const isDisabled = disabled || loading

    if (variant === 'ghost') {
      return (
        <button
          ref={ref}
          disabled={isDisabled}
          style={{ ...ghostBase, opacity: isDisabled ? .45 : 1, width: fullWidth ? '100%' : undefined, ...style }}
          onMouseEnter={e => { if (!isDisabled) { const el = e.currentTarget; el.style.background = 'rgba(0,204,255,.05)'; el.style.boxShadow = '0 0 0 1px rgba(0,204,255,.55), 0 4px 0 rgba(0,50,70,.5), 0 16px 40px rgba(0,204,255,.2)'; el.style.transform = 'translateY(-1px)' } }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'transparent'; el.style.boxShadow = '0 0 0 1px var(--b2), 0 4px 0 rgba(0,50,70,.5), 0 8px 24px rgba(0,204,255,.1)'; el.style.transform = '' }}
          onMouseDown={e => { e.currentTarget.style.transform = 'translateY(2px)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
          className={className}
          {...props}
        >
          {loading && <span style={{ width: 13, height: 13, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .6s linear_ infinite', marginRight: 8 }} />}
          {children}
        </button>
      )
    }

    /* Brand button */
    const paraStyle: React.CSSProperties = parallelogram ? {
      fontSize: 'clamp(12px,3.2vw,14px)',
      padding: 'clamp(13px,3.6vw,18px) clamp(28px,8vw,56px)',
      borderRadius: 0,
      clipPath: 'polygon(16px 0%, 100% 0%, calc(100% - 16px) 100%, 0% 100%)',
    } : pillSize[size]

    const combined: React.CSSProperties = {
      ...btnBase,
      ...paraStyle,
      opacity: isDisabled ? .45 : 1,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      width: fullWidth ? '100%' : undefined,
      /* shadow + face via CSS vars so light/dark theme work */
      background: 'var(--btn-face)',
      boxShadow: 'var(--btn-shadow)',
      color: 'var(--btn-text, #001a22)',
      ...style,
    }

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={combined}
        onMouseEnter={e => {
          if (isDisabled) return
          const el = e.currentTarget
          el.style.transform = 'translateY(-2px)'
          el.style.boxShadow = 'var(--btn-shadow-hover)'
          el.style.filter = 'brightness(1.04)'
        }}
        onMouseLeave={e => {
          if (isDisabled) return
          const el = e.currentTarget
          el.style.transform = ''
          el.style.boxShadow = 'var(--btn-shadow)'
          el.style.filter = ''
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = 'var(--btn-shadow-press)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--btn-shadow-hover)' }}
        className={className}
        {...props}
      >
        {loading && <span style={{ width: 13, height: 13, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .6s linear_ infinite', marginRight: 8 }} />}
        {icon && !loading && <span style={{ marginRight: 8, display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
        {children}
      </button>
    )
  }
)

GlowButton.displayName = 'GlowButton'
export default GlowButton
