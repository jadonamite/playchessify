import { Web3Auth } from '@web3auth/modal'
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from '@web3auth/base'

const celoChain = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: '0xa4ec',
  rpcTarget: 'https://forno.celo.org',
  displayName: 'Celo Mainnet',
  blockExplorerUrl: 'https://explorer.celo.org',
  ticker: 'CELO',
  tickerName: 'Celo',
  logo: 'https://cryptologos.cc/logos/celo-celo-logo.png',
}

const FALLBACK_CLIENT_ID = 'BHgArYmWwSeq21czpcarYh0EVq2WWOzflX-NTK-tY1-1pauPzHKRRLgpABkmYiIV_og9jAvoIxQ8L3Smrwe04Lw'

let _web3auth: Web3Auth | null = null

export function getWeb3Auth(): Web3Auth {
  if (!_web3auth) {
    const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || FALLBACK_CLIENT_ID
    const web3AuthNetwork = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID
      ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET
      : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET

    _web3auth = new Web3Auth({
      clientId,
      web3AuthNetwork,
      chains: [celoChain],
      defaultChainId: '0xa4ec',
      uiConfig: {
        appName: 'Chessify Protocol',
        mode: 'dark',
      } as any,
    })
  }
  return _web3auth
}
