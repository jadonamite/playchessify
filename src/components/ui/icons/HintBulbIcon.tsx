import type { DuotoneIconProps } from './types'

// Duotone lightbulb with a soft glow — Get Hint control.
// `glow` toggles the pulsing accent drop-shadow (see .pc-bulb-glow in globals.css).
export function HintBulbIcon({ size = 24, className, style, glow = true }: DuotoneIconProps & { glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${glow ? 'pc-bulb-glow' : ''} ${className ?? ''}`.trim()}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* secondary: glass */}
      <path fillOpacity={0.32} d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.6.5 1 1.2 1.1 2l.1.9h5.6l.1-.9c.1-.8.5-1.5 1.1-2A6.5 6.5 0 0 0 12 2.5z" />
      {/* primary: filament + threaded base */}
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M10 11.5 11.4 13l1-2.2 1 1.7" />
      <path d="M9.3 18.2h5.4a.8.8 0 0 1 0 1.6H9.3a.8.8 0 0 1 0-1.6zM10 20.6h4a.8.8 0 0 1 0 1.6h-4a.8.8 0 0 1 0-1.6z" />
    </svg>
  )
}
