'use client'

// Adapted from pqoqubbw/icons "chart-no-axes-column-increasing" (MIT).
// Import rewired to framer-motion; cn dropped. Used for the Ranks (leaderboard) tab.
import { motion, useAnimation, type Variants } from 'framer-motion'
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'
import type { AnimatedIconHandle, AnimatedIconProps } from './types'

const LINE_VARIANTS: Variants = {
  visible: { pathLength: 1, opacity: 1 },
  hidden: { pathLength: 0, opacity: 0 },
}

const RankIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation()
    const isControlledRef = useRef(false)

    const ripple = useCallback(async () => {
      await controls.start((i: number) => ({ pathLength: 0, opacity: 0, transition: { delay: i * 0.1, duration: 0.3 } }))
      await controls.start((i: number) => ({ pathLength: 1, opacity: 1, transition: { delay: i * 0.1, duration: 0.3 } }))
    }, [controls])

    useImperativeHandle(ref, () => {
      isControlledRef.current = true
      return {
        startAnimation: () => { void ripple() },
        stopAnimation: () => controls.start('visible'),
      }
    })

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) onMouseEnter?.(e)
        else void ripple()
      },
      [ripple, onMouseEnter],
    )
    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) onMouseLeave?.(e)
        else controls.start('visible')
      },
      [controls, onMouseLeave],
    )

    return (
      <div className={className} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
        <svg
          fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
          strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg"
        >
          <motion.path animate={controls} custom={0} d="M6 20v-4" initial="visible" variants={LINE_VARIANTS} />
          <motion.path animate={controls} custom={1} d="M12 20v-10" initial="visible" variants={LINE_VARIANTS} />
          <motion.path animate={controls} custom={2} d="M18 20v-16" initial="visible" variants={LINE_VARIANTS} />
        </svg>
      </div>
    )
  },
)

RankIcon.displayName = 'RankIcon'
export { RankIcon }
