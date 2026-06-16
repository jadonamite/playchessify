import type { DuotoneIconProps } from './types'

// Duotone user — Profile tab.
export function UserIcon({ size = 24, className, style }: DuotoneIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* secondary: shoulders */}
      <path fillOpacity={0.32} d="M4 20.2a8 8 0 0 1 16 0v.3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-.3z" />
      {/* primary: head */}
      <circle cx="12" cy="8" r="4.2" />
    </svg>
  )
}
