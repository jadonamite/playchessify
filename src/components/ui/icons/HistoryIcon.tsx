import type { DuotoneIconProps } from './types'

// Duotone clock — History tab.
export function HistoryIcon({ size = 24, className, style }: DuotoneIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* secondary: clock face */}
      <circle fillOpacity={0.32} cx="12" cy="12" r="9" />
      {/* primary: hands */}
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
    </svg>
  )
}
