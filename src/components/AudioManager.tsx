'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSettingsStore } from '@/hooks/useSettingsStore'
import { startAmbient, startGameTrack, setMuted } from '@/lib/audio'

const handleAudioStartup = (soundEnabled: boolean, startedRef: React.RefObject<boolean>) => {
  if (startedRef.current || !soundEnabled) return
  startedRef.current = true
  startAmbient()
}

const handleTrackSwitch = (isGame: boolean, soundEnabled: boolean) => {
  if (isGame) {
    startGameTrack()
  } else {
    startAmbient()
  }
}

const handleMuteUnmute = (soundEnabled: boolean, isGame: boolean, startedRef: React.RefObject<boolean>) => {
  setMuted(!soundEnabled)
  if (soundEnabled && startedRef.current) {
    handleTrackSwitch(isGame, soundEnabled)
  }
}

export default function AudioManager() {
  const pathname = usePathname()
  const { soundEnabled } = useSettingsStore()
  const isGame = pathname?.startsWith('/app/game')
  const startedRef = useRef(false)

  // Start ambient immediately on first user interaction (browser autoplay policy)
  useEffect(() => {
    const start = () => {
      handleAudioStartup(soundEnabled, startedRef)
      document.removeEventListener('click', start)
      document.removeEventListener('keydown', start)
      document.removeEventListener('touchstart', start)
    }
    document.addEventListener('click', start, { once: true })
    document.addEventListener('keydown', start, { once: true })
    document.addEventListener('touchstart', start, { once: true })
    return () => {
      document.removeEventListener('click', start)
      document.removeEventListener('keydown', start)
      document.removeEventListener('touchstart', start)
    }
  }, [soundEnabled, startedRef])

  // Switch track when route changes
  useEffect(() => {
    if (!startedRef.current || !soundEnabled) return
    handleTrackSwitch(isGame, soundEnabled)
  }, [isGame, soundEnabled, startedRef])

  // Handle mute/unmute without restarting
  useEffect(() => {
    handleMuteUnmute(soundEnabled, isGame, startedRef)
  }, [soundEnabled, isGame, startedRef])

  return null
}