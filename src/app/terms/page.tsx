import type { Metadata } from 'next'
import LegalPage from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms governing your use of Playchessify — the non-custodial on-chain chess protocol on Celo.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="23 July 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Playchessify
        (the &ldquo;Service&rdquo;) — a non-custodial, on-chain chess protocol and its website,
        applications, and interfaces. By connecting a wallet, logging in, or otherwise using the
        Service, you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. What Playchessify is</h2>
      <p>
        Playchessify lets you train against AI coaches and play real chess matches on the Celo
        blockchain. Matches, wagers, and results are recorded and settled by smart contracts.
        Playchessify is <strong>non-custodial</strong>: we never take control of your wallet, your
        private keys, or your funds. You interact directly with the blockchain through your own
        wallet.
      </p>

      <h2>2. Eligibility</h2>
      <p>You may use the Service only if you:</p>
      <ul>
        <li>are at least 18 years old and have the legal capacity to enter into these Terms;</li>
        <li>
          are not located in, or a resident of, any jurisdiction where using the Service, holding
          crypto tokens, or staking on games of skill is prohibited; and
        </li>
        <li>are not barred from using the Service under any applicable law.</li>
      </ul>
      <p>You are solely responsible for ensuring your use of the Service is lawful where you live.</p>

      <h2>3. Wallets and accounts</h2>
      <p>
        Access requires a supported wallet. You are solely responsible for safeguarding your wallet,
        seed phrase, and private keys. We cannot recover, reset, freeze, or reverse anything in your
        wallet. Any transaction signed by your wallet is your responsibility. Your on-chain wallet
        address is your identity on the Service; profiles, stats, and streaks are tied to it.
      </p>

      <h2>4. The CHESS token</h2>
      <p>
        CHESS is an <strong>in-game utility token</strong> used to enter and wager on matches within
        the Service. CHESS has no monetary value, is not a currency, security, or investment, is not
        backed by any asset, and carries no expectation of profit or future value. It is
        distributed for free (for example, through the in-app faucet) and exists only to power
        gameplay. Nothing in the Service is financial, investment, or legal advice.
      </p>

      <h2>5. Matches, wagers, and settlement</h2>
      <p>
        When you create or join a wagered match, the stake is escrowed by the smart contract for the
        duration of the game. Moves are validated by a server-authoritative relay, and the final
        result is verified and settled on-chain by an oracle. On settlement, the pot is paid out to
        the winner (or refunded on a draw or cancellation) automatically by the contract.
      </p>
      <ul>
        <li>
          <strong>Results are final.</strong> Once settled on-chain, a result is permanent and
          cannot be reversed by us or anyone else.
        </li>
        <li>
          <strong>Time controls apply.</strong> Exceeding a move-clock limit forfeits the game to
          your opponent.
        </li>
        <li>
          <strong>Abandonment.</strong> Unjoined lobbies and stalled games may be refunded or voided
          per the contract&rsquo;s rules.
        </li>
        <li>
          You accept the inherent risks of blockchain technology, including network congestion,
          failed transactions, smart-contract bugs, and gas costs.
        </li>
      </ul>

      <h2>6. Matchmaking and house players</h2>
      <p>
        To keep games available, the Service operates automated players (&ldquo;bots&rdquo;) that may
        create and join lobbies as part of matchmaking. Bots play by the same rules and stake real
        in-game CHESS. By using the Service you acknowledge that some opponents may be automated.
      </p>

      <h2>7. Fair play</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use external chess engines, assistance, or automation to gain an unfair advantage in matches;</li>
        <li>collude with other players, exploit bugs, or manipulate the relay, oracle, or contracts;</li>
        <li>attempt to tamper with, forge, or replay move signatures or game history; or</li>
        <li>use the Service to launder funds or for any illegal purpose.</li>
      </ul>
      <p>We may exclude accounts or addresses that violate these rules.</p>

      <h2>8. Gas and sponsorship</h2>
      <p>
        The Service may sponsor transaction fees (gas) for some wallets as a convenience. Sponsorship
        is offered on a best-effort basis, is not guaranteed, and may be withdrawn or degraded at any
        time — in which case you may need to cover your own gas to transact.
      </p>

      <h2>9. AI coaching</h2>
      <p>
        AI coaches and lesson explanations are provided for educational and entertainment purposes
        only. They are generated by automated systems, may be inaccurate or incomplete, and should
        not be relied upon as authoritative chess instruction.
      </p>

      <h2>10. Intellectual property</h2>
      <p>
        The Playchessify source code is released under the MIT License. The Playchessify name, logo,
        and branding remain ours. Chess piece sets and other third-party assets are used under their
        respective licenses or with permission. You may not use our branding in a way that implies
        endorsement without written consent.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong>,
        without warranties of any kind, express or implied. We do not warrant that the Service will
        be uninterrupted, error-free, or secure, that results will be accurate, or that defects will
        be corrected. Blockchain transactions are irreversible and outside our control.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Playchessify and its contributors will not be liable
        for any indirect, incidental, special, consequential, or punitive damages, or for any loss
        of tokens, funds, data, or profits, arising from your use of (or inability to use) the
        Service — including losses from smart-contract failures, wallet compromise, or lost stakes.
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless Playchessify and its contributors from any claims,
        damages, or expenses arising out of your use of the Service or your breach of these Terms.
      </p>

      <h2>14. Changes to the Service and these Terms</h2>
      <p>
        We may modify, suspend, or discontinue any part of the Service at any time. We may also
        update these Terms; material changes will be reflected by the &ldquo;Last updated&rdquo; date
        above. Your continued use after changes take effect constitutes acceptance.
      </p>

      <h2>15. Governing law</h2>
      <p>
        These Terms are governed by applicable law without regard to conflict-of-laws principles. Any
        dispute arising from or relating to the Service or these Terms will be resolved to the extent
        permitted by law.
      </p>

      <h2>16. Contact</h2>
      <p>
        Questions about these Terms? Reach us at{' '}
        <a href="mailto:support@playchessify.xyz">support@playchessify.xyz</a>.
      </p>
    </LegalPage>
  )
}
