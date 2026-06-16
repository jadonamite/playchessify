import type { DuotoneIconProps } from './types'

// Duotone filled king — Play tab.
export function ChessKingIcon({ size = 24, className, style }: DuotoneIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* secondary: bell body */}
      <path fillOpacity={0.32} d="M6.4 10h11.2l-1.3 7.6a1 1 0 0 1-1 .84H8.7a1 1 0 0 1-1-.84L6.4 10z" />
      {/* primary: cross + base */}
      <path d="M11 2h2v2h2v2h-2v2.2h-2V6H9V4h2V2z" />
      <path d="M5.4 18.8h13.2a1 1 0 0 1 1 1v.6a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1v-.6a1 1 0 0 1 1-1z" />
    </svg>
  )
}
