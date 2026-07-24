'use client'

import { avatarSvgUrl } from '@/lib/avatar'

interface ChessAvatarProps {
  address: string
  size?: number
  className?: string
}

const getAvatarAltText = (address: string) => `${address.slice(0, 6)} avatar`;

export default function ChessAvatar({ address, size = 40, className = '' }: ChessAvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSvgUrl(address)}
      alt={getAvatarAltText(address)}
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '22%', display: 'block' }}
    />
  )
}