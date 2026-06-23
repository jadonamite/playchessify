'use client'
import { avatarSvgUrl } from '@/lib/avatar'

interface ChessAvatarProps {
  address: string
  size?: number
  className?: string
}

const getAvatarSrcAndAlt = (address: string) => ({
  src: avatarSvgUrl(address),
  alt: `${address.slice(0, 6)} avatar`
})

export default function ChessAvatar({ address, size = 40, className = '' }: ChessAvatarProps) {
  const { src, alt } = getAvatarSrcAndAlt(address)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={size} height={size} className={className} style={{ borderRadius: '22%', display: 'block' }} />
  )
}