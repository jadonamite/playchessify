// Duotone filled glyphs for the bottom nav + game controls.
// Each icon renders a secondary fill (~35% opacity) + a primary fill, both in
// currentColor, so they theme via the candy accents. Plain props — no imperative
// animation handle (the nav adds a subtle tap scale instead).
export interface DuotoneIconProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}
