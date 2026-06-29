'use client'

import { useCoachStore } from '@/hooks/useCoachStore'
import { getCoach } from '@/config/coaches'

interface Props { size?: number }

/**
 * Nav avatar for the active coach: a photoreal portrait in an accent ring. When
 * no coach is chosen yet it shows a greyed silhouette ("pick a coach"). The
 * photographic portrait reads distinctly from the user's abstract SVG identicon,
 * so it never reads as the profile tab.
 */
export default function CoachNavIcon({ size = 26 }: Props) {
  const coachId = useCoachStore((s) => s.coachId)

  if (!coachId) {
    return (
      <span
        className="flex items-center justify-center rounded-full"
        style={{ width: size + 4, height: size + 4, border: '2px dashed var(--t3)', color: 'var(--t3)' }}
      >
        <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6Z" />
        </svg>
      </span>
    )
  }

  const coach = getCoach(coachId)
  return (
    <span
      className="block overflow-hidden rounded-full"
      style={{
        width: size + 4,
        height: size + 4,
        border: `2px solid ${coach.accent}`,
        boxShadow: `0 0 10px ${coach.accent}66`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={encodeURI(coach.img)} alt={coach.name} className="h-full w-full object-cover object-top" />
    </span>
  )
}
