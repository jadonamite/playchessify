'use client'

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@/components/wallet-provider'

export interface StreakData {
  current: number
  longest: number
  lastPlayedDate: string
  playedToday: boolean
}

export interface RecordResult extends StreakData {
  incremented: boolean
}

type ClientSource = 'bot' | 'puzzle' | 'multiplayer'

/** 'play' = the daily play streak; 'win' = the daily WIN streak ("stars\