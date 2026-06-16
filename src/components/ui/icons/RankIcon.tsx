import type { DuotoneIconProps } from './types'

// Duotone podium bars — Ranks tab.
export function RankIcon({ size = 24, className, style }: DuotoneIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* secondary: short + mid bars */}
      <rect fillOpacity={0.32} x="3.5" y="13" width="4.2" height="6.5" rx="1.2" />
      <rect fillOpacity={0.32} x="9.9" y="9" width="4.2" height="10.5" rx="1.2" />
      {/* primary: tall bar + baseline */}
      <rect x="16.3" y="5" width="4.2" height="14.5" rx="1.2" />
      <rect x="3" y="20.2" width="18" height="1.8" rx="0.9" />
    </svg>
  )
}
