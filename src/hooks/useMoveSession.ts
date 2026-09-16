'use client'

import { useEffect, useRef } from 'react'
import { useMoveSigner } from '@/hooks/useMoveSigner'

/**
 * Establishes the move-relay session once per game, not once per move.
 *
 * 297f5c43 removed per-move signature popups because they made PvP unplayable.
 * This restores real authentication at a tenth of the cost: one signature when
 * a game opens, then an HttpOnly cookie carries it. `useMoveSigner` — orphaned
 * since that commit — is the signer again.
 *
 * MiniPay cannot sign messages, so `canSign` is false there and no session is
 * attempted. Those moves stay on the relay's turn binding alone (see
 * src/lib/game-session.ts); this hook never blocks play.
 */
const established = new Set<string>()

export function useMoveSession(address: string | undefined, enabled: boolean) {
  const { signMove, canSign } = useMoveSigner()
  const inFlight = useRef(false)

  useEffect(() => {
    if (!enabled || !canSign || !address) return
    const key = address.toLowerCase()
    if (established.has(key) || inFlight.current) return

    inFlight.current = true
    ;(async () => {
      try {
        const nonceRes = await fetch(`/api/auth/session?address=${encodeURIComponent(address)}`)
        if (!nonceRes.ok) return
        const { nonce, message } = (await nonceRes.json()) as { nonce?: string; message?: string }
        if (!nonce || !message) return

        const signature = await signMove(message)
        if (!signature) return

        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ address, nonce, signature }),
        })
        // Cache only on success — a failed handshake should be retried on the
        // next game rather than silently leaving the player unauthenticated.
        if (res.ok) established.add(key)
      } catch (err) {
        // Never block play on this: enforcement is off until MiniPay is solved,
        // so a failed handshake degrades to exactly today's behaviour.
        console.warn('[useMoveSession] handshake failed', err)
      } finally {
        inFlight.current = false
      }
    })()
  }, [address, enabled, canSign, signMove])
}
