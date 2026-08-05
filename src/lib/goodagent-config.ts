'use client'

import { useMemo } from 'react'
import {
  createGoodAgentWidgetConfig,
  type GoodAgentWalletAdapter,
} from '@goodagent/widget'
import { usePrivyWalletAdapter } from '@goodagent/widget/privy'

/** Registry skill — `gaming/wagering/playchessify_1v1` on goodagent-skills. */
export const PLAYCHESSIFY_SKILL_ID = 'gaming/wagering/playchessify_1v1'

const HOST_PROXY =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/goodagent`
    : '/api/goodagent'

export function useGoodAgentWallet(): GoodAgentWalletAdapter {
  return usePrivyWalletAdapter({ preferExternal: true })
}

export function useGoodAgentWidgetConfig() {
  return useMemo(
    () =>
      createGoodAgentWidgetConfig(PLAYCHESSIFY_SKILL_ID, {
        partnerId: 'playchessify',
        hostBaseUrl: HOST_PROXY,
        hideSkillConfig: true,
        deployHint:
          'Deploy a verified agent to host and join wagered 1v1 chess games on PlayChessify.',
        fvCallbackUrl:
          typeof window !== 'undefined'
            ? `${window.location.origin}/app/agents`
            : undefined,
      }),
    [],
  )
}
