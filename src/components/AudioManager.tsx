'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSettingsStore } from '@/hooks/useSettingsStore'
import { startAmbient, startGameTrack, setMuted } from '@/lib/audio'

const handleAudioPlayback = (soundEnabled: boolean, isGame: boolean, startedRef: React.RefObject<boolean>) => {
  if (!startedRef.current || !soundEnabled) return
  if (isGame) {
    startGameTrack()
  } else {
    startAmbient()
  }
}

const handleMuteUnmute = (soundEnabled: boolean, isGame: boolean, startedRef: React.RefObject<boolean>) => {
  setMuted(!soundEnabled)
  if (soundEnabled && startedRef.current) {
    if (isGame) startGameTrack()
    else startAmbient()
  }
}

const startAudioOnInteraction = (soundEnabled: boolean, startedRef: React.RefObject<boolean>) => {
  const start = () => {
    if (startedRef.current) return
    startedRef.current = true
    if (soundEnabled) startAmbient()
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
}

export default function AudioManager() {
  const pathname = usePathname()
  const { soundEnabled } = useSettingsStore()
  const isGame = pathname?.startsWith('/app/game')
  const startedRef = useRef(false)

  useEffect(() => {
    return startAudioOnInteraction(soundEnabled, startedRef)
  }, [soundEnabled])

  useEffect(() => {
    handleAudioPlayback(soundEnabled, isGame, startedRef)
  }, [isGame, soundEnabled])

  useEffect(() => {
    handleMuteUnmute(soundEnabled, isGame, startedRef)
  }, [soundEnabled, isGame])

  return null
}