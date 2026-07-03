'use client'

import { getCoach } from '@/config/coaches'
import { useCoachStore } from '@/hooks/useCoachStore'

interface Props { size?: number }

/**
 * Avatar for the active coach: a photoreal portrait in an accent ring. When no
 * coach is chosen yet it shows the "Unknown" portrait with a "?" in front and a
 * periodic wiggle (pc-coach-wiggle) to nudge the player to pick one. The photo
 * reads distinctly from the user's abstract SVG identicon.
 */
export default function CoachNavIcon({ size = 26 }: Props) {
  const coachId = useCoachStore((s) => s.coachId)
  const dim = size + 4

  if (!coachId) {
    return (
      <span
        className="pc-coach-wiggle relative block overflow-hidden rounded-full"
        style={{ width: dim, height: dim, border: '2px dashed var(--t3)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Coaches/Unknown.webp" alt="Pick a coach"
             className="h-full w-full object-cover object-top" style={{ filter: 'grayscale(0.7) brightness(0.8)' }} />
        <span className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(4,7,16,0.35)' }}>
          <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: size * 0.62, color: '#fff', lineHeight: 1, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>?</span>
        </span>
      </span>
    )
  }

  const coach = getCoach(coachId)
  return (
    <span
      className="block overflow-hidden rounded-full"
      style={{
        width: dim,
        height: dim,
        border: `2px solid ${coach.accent}`,
        boxShadow: `0 0 10px ${coach.accent}66`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={encodeURI(coach.img)} alt={coach.name} className="h-full w-full object-cover object-top" />
    </span>
  )
}
