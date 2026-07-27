'use client'

import { forwardRef, HTMLAttributes } from 'react'

/**
 * PlayCard — the lobby's single card shell, codifying the intentional
 * neon + candy + clay hybrid so every surface reads deliberate (not copied).
 *
 *  - `tone="neon"`  → the system frame: hairline white border, dark glass. Default.
 *  - `tone="candy"` → personal stats: border + faint wash tinted by `accent`
 *                     (a candy var, e.g. var(--candy-lime)). Playful, color-coded.
 *  - `tone="clay"`  → tactile hero surface: puffy molded edge (inset highlight +
 *                     bottom shadow), for pressable / spotlight moments.
 *
 * `size` only sets the corner radius + blur strength: `hero` (big) | `rail` (compact).
 */
interface PlayCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'neon' | 'candy' | 'clay'
  size?: 'hero' | 'rail'
  /** Candy accent colour for `tone="candy"` (defaults to brand cyan). */
  accent?: string
}

const PlayCard = forwardRef<HTMLDivElement, PlayCardProps>(
  ({ tone = 'neon', size = 'hero', accent = 'var(--c)', className = '', style, children, ...props }, ref) => {
    const radius = size === 'hero' ? 32 : 28
    const blur = size === 'hero' ? 'backdrop-blur-xl' : 'backdrop-blur-md'

    const toneStyle: React.CSSProperties =
      tone === 'candy'
        ? {
            border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
            background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 7%, rgba(15,15,30,.6)), rgba(9,9,26,.6))`,
            boxShadow: `0 1px 0 color-mix(in srgb, ${accent} 22%, transparent) inset, 0 18px 50px rgba(0,0,0,.45)`,
          }
        : tone === 'clay'
        ? {
            border: '1px solid rgba(255,255,255,.1)',
            background: 'linear-gradient(180deg, rgba(26,26,48,.7), rgba(13,13,30,.7))',
            boxShadow:
              '0 2px 0 rgba(255,255,255,.08) inset, 0 -3px 0 rgba(0,0,0,.5) inset, 0 18px 50px rgba(0,0,0,.5)',
          }
        : {
            border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(15,23,42,.6)',
            boxShadow: '0 18px 50px rgba(0,0,0,.45)',
          }

    return (
      <div
        ref={ref}
        className={`relative overflow-hidden ${blur} ${className}`}
        style={{ borderRadius: radius, ...toneStyle, ...style }}
        {...props}
      >
        {children}
      </div>
    )
  }
)

PlayCard.displayName = 'PlayCard'

export default PlayCard
