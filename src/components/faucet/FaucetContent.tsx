/* ... (rest of the code remains the same) */

/* ── Claim Handler: Celo ── */
// Tier-aware dispatch (mirrors useCeloChess.sendWrite):
// smart → Privy smart-wallet client → Pimlico sponsors the userOp, and
// msg.sender is the smart account so CHESS lands on the player identity
// minipay → legacy tx with feeCurrency = cUSD
// eoa → plain write, user pays
const sendSmartTransaction = async () => {
  const hash = await smartClient.sendTransaction({
    to: CELO_CONTRACTS.token as `0x${string}`,
    data: encodeFunctionData({
      abi: CHESS_TOKEN_ABI,
      functionName: 'faucetClaim',
      args: [],
    }),
  })
  return hash
}

const sendMinipayTransaction = async () => {
  const hash = await writeContractAsync({
    address: CELO_CONTRACTS.token as `0x${string}`,
    abi: CHESS_TOKEN_ABI,
    functionName: 'faucetClaim',
    args: [],
    feeCurrency: USDM_ADDRESS,
  } as Parameters<typeof writeContractAsync>[0])
  return hash
}

const sendEoaTransaction = async () => {
  const hash = await writeContractAsync({
    address: CELO_CONTRACTS.token as `0x${string}`,
    abi: CHESS_TOKEN_ABI,
    functionName: 'faucetClaim',
    args: [],
  })
  return hash
}

const claimCelo = async () => {
  const TIMEOUT_MS = 90_000
  let hash: `0x${string}`
  switch (walletTier) {
    case 'smart':
      hash = await sendSmartTransaction()
      break
    case 'minipay':
      hash = await sendMinipayTransaction()
      break
    default:
      hash = await sendEoaTransaction()
  }
  const receiptPromise = publicClient!.waitForTransactionReceipt({ hash })
  const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS))
  const receipt = await Promise.race([receiptPromise, timeoutPromise])
  if (receipt.status !== 'success') throw new Error('Transaction reverted')
  return hash
}
/* ... (rest of the code remains the same) */