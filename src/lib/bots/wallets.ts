import { mnemonicToAccount, type HDAccount } from 'viem/accounts'
import { BOTS, type BotProfile } from '@/config/bots'

// Server-only bot wallet derivation. NEVER import from client components —
// this reads the fleet mnemonic.
//
// Every bot key derives from one BOT_MNEMONIC at HD index = BotProfile.index.
// The derived address is asserted against the public roster so a wrong or
// rotated mnemonic fails loudly instead of playing (and losing wagers) from
// addresses the UI doesn't recognise as bots.

const accounts = new Map<number, HDAccount>()

function requireMnemonic(): string {
  const m = process.env.BOT_MNEMONIC
  if (!m) throw new Error('[bots] BOT_MNEMONIC must be set')
  return m
}

function deriveAndValidateAccount(mnemonic: string, profile: BotProfile): HDAccount {
  const account = mnemonicToAccount(mnemonic, { addressIndex: profile.index })
  if (account.address.toLowerCase() !== profile.address.toLowerCase()) {
    throw new Error(
      `[bots] derived address mismatch for \