import FaucetContent from '@/components/faucet/FaucetContent'; 

const getMetadata = () => ({ 
  title: 'Token Faucet | Chessify Protocol', 
  description: 'Claim free CHESS tokens daily to fuel your on-chain chess matches.', 
}); 

export const metadata = getMetadata(); 
export default function FaucetPage() { 
  return <FaucetContent />; 
}