'use client'

import { useCallback, useState } from 'react'
import { useExportWallet } from '@privy-io/react-auth'
import { useWallet } from '@/components/wallet-provider'
import ClayCard from '@/components/ui/ClayCard'
import HoldButton from '@/components/ui/HoldButton'

/**
 * Export the key behind a Privy account.
 *
 * The thing users ask for ("export my smart wallet") cannot be done literally: a
 * smart account is a contract deployed at an address, and a contract has no
 * private key to hand over. What it has is a signer — the embedded EOA Privy
 * created at login — whose key authorises everything the contract does. That key
 * is what exports.
 *
 * The trap this card exists to defuse: the two have DIFFERENT addresses, and the
 * balance sits on the contract one. A player who exports the key, imports it into
 * MetaMask and sees 0 CHESS will assume the funds are gone. So both addresses are
 * shown, labelled by what each one actually does, before the key is ever revealed.
 *
 * Privy renders the key inside an iframe on its own domain. Chessify never sees
 * it, which is also why there is nothing here to store, clear, or leak.
 */

function AddressRow({ label, note, address }: { label: string; note: string; address: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard is blocked in some in-app browsers. The address is on screen
      // in full, so a failed copy costs the user nothing but a long-press.
    }
  }, [address])

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-black/20 border border-white/5 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-[var(--t3)]">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="text-[10px] font-black tracking-wider uppercase transition-colors cursor-pointer"
          style={{ color: copied ? '#4ade80' : 'var(--c)' }}
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <p className="font-mono text-[11px] leading-relaxed break-all text-[var(--t1)]">{address}</p>
      <p className="text-[10px] leading-relaxed text-[var(--t3)]">{note}</p>
    </div>
  )
}

export default function ExportWalletCard() {
  const { walletTier, smartAddress, embeddedAddress, isMiniPay } = useWallet()
  const { exportWallet } = useExportWallet()
  const [error, setError] = useState('')

  // Only a Privy-generated account has a key we can hand over. MiniPay and
  // external wallets already hold their own, and exporting them is their job.
  if (walletTier !== 'smart') {
    return (
      <ClayCard className="p-6">
        <p className="text-sm leading-relaxed text-[var(--t2)]">
          You play through {isMiniPay ? 'MiniPay' : 'a wallet you connected yourself'}, so your
          key never belonged to Chessify. Export it from that wallet.
        </p>
      </ClayCard>
    )
  }

  // Tier A resolves the smart account asynchronously. Revealing the key while the
  // account address is still unknown would show the user half the picture — the
  // half that misleads — so the card waits.
  if (!embeddedAddress || !smartAddress) {
    return (
      <ClayCard className="p-6">
        <p className="text-sm text-[var(--t3)]">Loading your account…</p>
      </ClayCard>
    )
  }

  const handleExport = async () => {
    setError('')
    try {
      await exportWallet({ address: embeddedAddress })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Try again.')
    }
  }

  return (
    <ClayCard className="p-6 flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-[var(--t2)]">
        You signed in with an email or social account, so Chessify built you two things. One
        holds your CHESS and your winnings. The other holds the key that moves them. They are
        different addresses, and the difference matters.
      </p>

      <div className="flex flex-col gap-3">
        <AddressRow
          label="Account"
          address={smartAddress}
          note="Where your balance lives and where your games are recorded. It is a contract, so there is no key to export for this one."
        />
        <AddressRow
          label="Signer"
          address={embeddedAddress}
          note="The key below belongs to this address. It signs for the account above."
        />
      </div>

      <div
        className="rounded-2xl px-4 py-3.5 border"
        style={{ borderColor: 'rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.05)' }}
      >
        <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-2" style={{ color: '#fbbf24' }}>
          Read this before you export
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--t2)]">
          Import this key into MetaMask and you will see an empty wallet. Nothing is missing.
          MetaMask is showing you the signer, and your balance is on the account. To reach the
          balance you need a wallet that understands smart accounts.
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--t2)] mt-2">
          Whoever holds this key controls your account and everything in it. Chessify cannot
          see it, cannot reset it, and cannot get it back for you.
        </p>
      </div>

      {error && <p className="text-xs font-bold text-red-400">{error}</p>}

      <HoldButton
        label="HOLD TO REVEAL KEY"
        holdingLabel="Keep holding…"
        onComplete={() => { void handleExport() }}
        accent="#fbbf24"
      />

      <p className="text-[10px] leading-relaxed text-[var(--t3)]">
        Privy shows the key in its own window. Chessify never receives it.
      </p>
    </ClayCard>
  )
}
