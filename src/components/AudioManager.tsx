import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSettingsStore } from '@/hooks/useSettingsStore'
import { startAmbient, startGameTrack, setMuted } from '@/lib/audio'

const handleFirstInteraction = (startedRef, soundEnabled) => {
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

const handleRouteChange = (isGame, soundEnabled, startedRef) => {
  if (!startedRef.current || !soundEnabled) return
  if (isGame) {
    startGameTrack()
  } else {
    startAmbient()
  }
}

const handleMuteUnmute = (soundEnabled, isGame, startedRef) => {
  setMuted(!soundEnabled)
  if (soundEnabled && startedRef.current) {
    if (isGame) startGameTrack()
    else startAmbient()
  }
}

export default function AudioManager() {
  const pathname = usePathname()
  const { soundEnabled } = useSettingsStore()
  const isGame = pathname?.startsWith('/app/game')
  const startedRef = useRef(false)

  useEffect(() => handleFirstInteraction(startedRef, soundEnabled), [])
  useEffect(() => handleRouteChange(isGame, soundEnabled, startedRef), [isGame, soundEnabled])
  useEffect(() => handleMuteUnmute(soundEnabled, isGame, startedRef), [soundEnabled, isGame])

  return null
}