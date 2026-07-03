'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSettingsStore } from '@/hooks/useSettingsStore'
import { startAmbient, startGameTrack, setMuted } from '@/lib/audio'

export default function AudioManager() {
  const pathname = usePathname()
  const { soundEnabled } = useSettingsStore()
  const isGame = pathname?.startsWith('/app/game')
  const startedRef = useRef(false)

  // Start ambient immediately on first user interaction (browser autoplay policy)
  useEffect(() => {
    if (startedRef.current) return
    const start = () => {
      if (startedRef.current) return
      startedRef.current = true
      if (soundEnabled) startAmbient()
      document.removeEventListener('click', start)
      document.removeEventListener('keydown', start)
      document.removeEventListener('touchstart', start),
    }
    document.addEventListener('click', start, { once: true })
    document.addEventListener('keydown', start, { once: true })
    document.addEventListener('touchstart', start, { once: true })
    return () => {
      document.removeEventListener('click', start)
      document.removeEventListener('keydown', start)
      document.removeEventListener('touchstart', start)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Switch track when route changes
  useEffect(() => {
    if (!startedRef.current || !soundEnabled) return
    if (isGame) {
      startGameTrack()
    } else {
      startAmbient()
    }
  }, [isGame, soundEnabled])

  // Handle mute/unmute without restarting
  useEffect(() => {
    setMuted(!soundEnabled)
    if (soundEnabled && startedRef.current) {
      if (isGame) startGameTrack()
      else startAmbient()
    }
  }, [soundEnabled, isGame])

  return null
}
