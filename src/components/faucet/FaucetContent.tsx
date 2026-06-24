/* ... (rest of the code remains the same) */

/* ── Claim Handler: Celo ── */
const getTransactionParams = (walletTier: string, smartClient: any, writeContractAsync: any) => {
  if (walletTier === 'smart' && smartClient) {
    return {
      to: CELO_CONTRACTS.token as `0x${string}`,
      data: encodeFunctionData({
        abi: CHESS_TOKEN_ABI,
        functionName: 'faucetClaim',
        args: [],
      }),
    };
  } else if (walletTier === 'minipay') {
    return {
      address: CELO_CONTRACTS.token as `0x${string}`,
      abi: CHESS_TOKEN_ABI,
      functionName: 'faucetClaim',
      args: [],
      feeCurrency: USDM_ADDRESS,
    } as Parameters<typeof writeContractAsync>[0];
  } else {
    return {
      address: CELO_CONTRACTS.token as `0x${string}`,
      abi: CHESS_TOKEN_ABI,
      functionName: 'faucetClaim',
      args: [],
    };
  }
};

const claimCelo = async () => {
  const TIMEOUT_MS = 90_000;
  let hash: `0x${string}`;
  const params = getTransactionParams(walletTier, smartClient, writeContractAsync);
  if (walletTier === 'smart' && smartClient) {
    hash = await smartClient.sendTransaction(params);
  } else {
    hash = await writeContractAsync(params);
  }
  const receiptPromise = publicClient!.waitForTransactionReceipt({ hash });
  const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS));
  const receipt = await Promise.race([receiptPromise, timeoutPromise]);
  if (receipt.status !== 'success') throw new Error('Transaction reverted');
  return hash;
};
/* ... (rest of the code remains the same) */