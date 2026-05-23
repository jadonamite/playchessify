import { createConnector } from 'wagmi'
import type { EIP1193Provider } from 'viem'
import type { Web3Auth } from '@web3auth/modal'

export const WEB3AUTH_CONNECTOR_ID = 'web3auth-social'

export function web3AuthConnector(getWeb3Auth: () => Web3Auth) {
  let instance: Web3Auth | null = null

  return createConnector<EIP1193Provider>((config) => ({
    id: WEB3AUTH_CONNECTOR_ID,
    name: 'Social Login',
    type: WEB3AUTH_CONNECTOR_ID,

    async setup() {
      if (typeof window === 'undefined') return
      instance = getWeb3Auth()
      try {
        await instance.initModal()
      } catch {
        // initModal can throw on SSR or if clientId is missing — safe to swallow here
      }
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async connect(_params: any = {}) {
      if (!instance) throw new Error('Web3Auth connector not set up')
      if (!instance.provider) {
        await instance.connect()
      }
      const accounts = await this.getAccounts()
      const chainId  = await this.getChainId()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { accounts: accounts as any, chainId }
    },

    async disconnect() {
      try {
        if (instance?.provider) await instance.logout()
      } catch { /* ignore if already disconnected */ }
      config.emitter.emit('disconnect')
    },

    async getAccounts() {
      const provider = instance?.provider as EIP1193Provider | null
      if (!provider) return []
      return provider.request({ method: 'eth_accounts' }) as Promise<`0x${string}`[]>
    },

    async getChainId() {
      const provider = instance?.provider as EIP1193Provider | null
      if (!provider) return config.chains[0].id
      const hex = await provider.request({ method: 'eth_chainId' }) as string
      return parseInt(hex, 16)
    },

    async getProvider() {
      return (instance?.provider ?? null) as EIP1193Provider
    },

    async isAuthorized() {
      try {
        if (!instance) return false
        await instance.initModal()
        const accounts = await this.getAccounts()
        return accounts.length > 0
      } catch {
        return false
      }
    },

    onAccountsChanged(accounts) {
      config.emitter.emit('change', { accounts: accounts as `0x${string}`[] })
    },

    onChainChanged(chainId) {
      config.emitter.emit('change', { chainId: parseInt(chainId as string, 16) })
    },

    onDisconnect() {
      config.emitter.emit('disconnect')
    },
  }))
}
