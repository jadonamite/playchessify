import type { DuotoneIconProps } from './types'

// Duotone droplet — Faucet tab.
export function DropletIcon({ size = 24, className, style }: DuotoneIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* secondary: droplet body */}
      <path fillOpacity={0.32} d="M12 2.8c3.1 4.1 6.2 6.7 6.2 10.4a6.2 6.2 0 1 1-12.4 0C5.8 9.5 8.9 6.9 12 2.8z" />
      {/* primary: shine */}
      <circle cx="10.2" cy="14.4" r="1.7" />
    </svg>
  )
}
