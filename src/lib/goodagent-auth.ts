export type DeployControlAction =
  | 'pause'
  | 'resume'
  | 'baseline'
  | 'configuration'
  | 'display-name'
  | 'run-pipeline'
  | 'confirm-vouch'
  | 'play'

export interface DeployControlAuth {
  ownerWallet: string
  signature: `0x${string}`
  issuedAt: number
}

export function buildDeployControlMessage(
  action: DeployControlAction,
  deployId: string,
  issuedAt: number,
): string {
  return [
    'GoodAgent deploy control',
    `Action: ${action}`,
    `Deploy: ${deployId}`,
    `Issued: ${issuedAt}`,
  ].join('\n')
}

export async function signDeployControl(
  signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>,
  address: `0x${string}`,
  action: DeployControlAction,
  deployId: string,
): Promise<DeployControlAuth> {
  const issuedAt = Date.now()
  const message = buildDeployControlMessage(action, deployId, issuedAt)
  const signature = await signMessageAsync({ message })
  return { ownerWallet: address, signature, issuedAt }
}
