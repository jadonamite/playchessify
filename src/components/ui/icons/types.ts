// Shared imperative handle for the animated nav icons.
// Adapted from pqoqubbw/icons (MIT) — https://icons.pqoqubbw.dev/
// Imports rewired from `motion/react` → `framer-motion` (the dep this repo uses).
export interface AnimatedIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

export interface AnimatedIconProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number
}
