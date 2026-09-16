// Per-address move sessions — the authentication the move relay never had.
//
// The relay decides real payouts: settleGameById replays its move list to pick
// a winner. Until now the only thing standing between an attacker and someone
// else's game was `player` — a string in the request body. Turn order and move
// legality were checked; *who was asking* never was.
//
// Per-move signatures were the original plan and were removed on purpose
// (297f5c43) because a wallet popup per move is miserable. So the proof moves
// to game entry: sign once, carry an HttpOnly cookie for the rest of the game.
//
// ── The MiniPay problem ──────────────────────────────────────────────────────
// MiniPay cannot sign messages at all, and it is the primary audience. There is
// no cryptographic proof of control available for those wallets, so this module
// does NOT pretend otherwise: it issues sessions to wallets that can sign, and
// `MOVE_AUTH_ENFORCE` controls whether an unauthenticated move is rejected or
// merely recorded. Enforcement is off by default so this can ship without
// locking out MiniPay mid-season; the log tells you what would have broken
// before you turn it on.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000 // 6h — longer than any real game, short enough to expire
export const SESSION_COOKIE = 'chess_move_session'
export const NONCE_TTL_MS = 5 * 60 * 1000 // 5 min to complete the sign-in

/** Enforcement is opt-in — see the MiniPay note above. */
export const MOVE_AUTH_ENFORCED = process.env.MOVE_AUTH_ENFORCE === '1'

// Deliberately split: minting a session without a secret is impossible and must
// fail loudly, but VERIFYING runs on every single move POST. If that threw when
// the secret was unset, one missing env var would 500 the relay and take live
// games down — so verification degrades to "no session" instead.
function secretOrNull(): string | null {
  return process.env.MOVE_SESSION_SECRET || null
}

function requireSecret(): string {
  const s = secretOrNull()
  if (!s) throw new Error('[game-session] MOVE_SESSION_SECRET must be set')
  return s
}

export function sessionMessage(address: string, nonce: string): string {
  return [
    'playchessify:session',
    'Sign in to play. This proves you control this wallet.',
    'It authorises moves only — it can never move funds.',
    `address:${address.toLowerCase()}`,
    `nonce:${nonce}`,
  ].join('\n')
}

export function newNonce(): string {
  return randomBytes(16).toString('hex')
}

/** `<address>.<expiry>.<hmac>` — stateless, so a Redis round trip per move isn't needed. */
export function issueToken(address: string, now = Date.now()): string {
  const addr = address.toLowerCase()
  const exp = now + TOKEN_TTL_MS
  const body = `${addr}.${exp}`
  const mac = createHmac('sha256', requireSecret()).update(body).digest('hex')
  return `${body}.${mac}`
}

/** The address this token proves control of, or null if absent/forged/expired. */
export function verifyToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null
  const key = secretOrNull()
  if (!key) return null // unconfigured → nobody is authenticated, nothing crashes
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [addr, expRaw, mac] = parts

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp < now) return null

  const expected = createHmac('sha256', key).update(`${addr}.${exp}`).digest('hex')
  // Constant-time compare — a length mismatch can't reach timingSafeEqual.
  if (mac.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'))) return null

  return addr.toLowerCase()
}
