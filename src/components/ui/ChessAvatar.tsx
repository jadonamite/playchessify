'use client'

import { avatarSvgUrl } from '@/lib/avatar'

interface ChessAvatarProps {
  address: string
  size?: number
  className?: string
}

/**
 * ChessAvatar
 * @param {*} { address
 * @param {*} size
 * @param {*} className
 * @returns {*}
 */
export default function ChessAvatar({ address, size = 40, className = '' }: ChessAvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSvgUrl(address)}
      alt={`${address.slice(0, 6)} avatar`}
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '22%', display: 'block' }}
    />
  )
}
