/**
 * Chess in words a beginner can read.
 *
 * "Bc4" is a lookup: you either have it memorised or the sentence containing it
 * is wasted on you. Most of our players are new, on a phone, and playing for
 * free — so every coaching line that leans on notation is a line that lands on
 * nobody. Same for "27 centipawns", which is worse, because it looks like it
 * means something.
 *
 * The notation is kept in parentheses rather than dropped. Every chess book and
 * video on earth uses it, so showing both teaches it in context and a player who
 * outgrows us can read anything else. The one place this does NOT belong is the
 * move log — that is a scoresheet, and forty rows of prose is unreadable.
 *
 * Isomorphic on purpose: the server wordings the facts, the client renders the
 * same phrases in the offline template, and they must not drift apart.
 */

const PIECE: Record<string, string> = {
  K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight',
}

const PROMOTED: Record<string, string> = {
  Q: 'a queen', R: 'a rook', B: 'a bishop', N: 'a knight',
}

const FILE_NAME = 'abcdefgh'

/** `Nbd7` / `R1e2` — which knight or rook, when two could reach the square. */
function fromWhere(fileHint: string, rankHint: string): string {
  if (fileHint && rankHint) return ` from ${fileHint}${rankHint}`
  if (fileHint) return ` from the ${fileHint}-file`
  if (rankHint) return ` from the ${rankHint}${ordinalSuffix(rankHint)} rank`
  return ''
}

function ordinalSuffix(n: string): string {
  return n === '1' ? 'st' : n === '2' ? 'nd' : n === '3' ? 'rd' : 'th'
}

/**
 * Turn SAN into a sentence fragment: "Knight to f6", "Bishop takes on e5",
 * "castles kingside", "pawn promotes to a queen on e8".
 *
 * Parsed from SAN rather than from a chess.js Move because most call sites only
 * have the string — and SAN already encodes everything needed except en
 * passant, where "takes on d6" is accurate enough.
 */
export function describeMove(san: string | null | undefined, opts: { notation?: boolean } = {}): string {
  const withNotation = opts.notation !== false
  if (!san) return 'that move'
  const clean = san.trim()

  const tag = (phrase: string) => (withNotation ? `${phrase} (${clean})` : phrase)

  // Suffixes first — they apply to every shape below.
  const check = clean.endsWith('#') ? ', checkmate' : clean.endsWith('+') ? ', check' : ''
  const body = clean.replace(/[+#]$/, '')

  if (body === 'O-O' || body === '0-0') return tag(`castles kingside${check}`)
  if (body === 'O-O-O' || body === '0-0-0') return tag(`castles queenside${check}`)

  const m = body.match(/^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?$/)
  if (!m) return tag(clean) // an unfamiliar shape is still better shown than swallowed

  const [, letter, fileHint = '', rankHint = '', captured, square, promo] = m
  const takes = Boolean(captured)

  if (promo) {
    const becomes = PROMOTED[promo] ?? 'a queen'
    return tag(
      takes
        ? `pawn on the ${fileHint || FILE_NAME[0]}-file takes on ${square} and promotes to ${becomes}${check}`
        : `pawn promotes to ${becomes} on ${square}${check}`,
    )
  }

  if (!letter) {
    // A pawn move. A pawn capture always names its file in SAN (exd5).
    return takes
      ? tag(`pawn on the ${fileHint}-file takes on ${square}${check}`)
      : tag(`pawn to ${square}${check}`)
  }

  const name = PIECE[letter] ?? letter
  const origin = fromWhere(fileHint, rankHint)
  return takes
    ? tag(`${name}${origin} takes on ${square}${check}`)
    : tag(`${name}${origin} to ${square}${check}`)
}

/** Material in units a person counts in, not hundredths of a pawn. */
function pawnsInWords(pawns: number): string {
  const a = Math.abs(pawns)
  if (a < 0.38) return 'about a quarter of a pawn'
  if (a < 0.63) return 'about half a pawn'
  if (a < 0.88) return 'about three quarters of a pawn'
  if (a < 1.25) return 'about a pawn'
  if (a < 1.75) return 'about a pawn and a half'
  // Round to the nearest half so 3.5 pawns does not become "about four pawns".
  const halves = Math.round(a * 2) / 2
  const whole = Math.floor(halves)
  const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six']
  if (whole > 6) return 'a decisive amount'
  // "two and a half pawns", not "two pawns and a half".
  if (halves % 1 !== 0) return `about ${WORDS[whole]} and a half pawns`
  return whole === 1 ? 'about a pawn' : `about ${WORDS[whole]} pawns`
}

/**
 * Describe an evaluation from the asking player's point of view.
 * `cp` is centipawns, positive meaning good for them.
 */
export function describeEval(cp: number, mate?: number | null): string {
  if (mate != null && mate !== 0) {
    const n = Math.abs(mate)
    const moves = n === 1 ? 'one move' : `${n} moves`
    return mate > 0
      ? `there is a forced mate in ${moves} for you`
      : `you are being mated in ${moves}`
  }

  const a = Math.abs(cp)
  if (a < 30) return 'the position is level'
  if (a >= 500) return cp > 0 ? 'you are completely winning' : 'you are completely lost'

  const side = cp > 0 ? 'ahead' : 'behind'
  const words = pawnsInWords(cp / 100)
  if (a < 60) return `you are ${words} ${side} — essentially level`
  if (a < 150) return `you are ${words} ${side}`
  return `you are ${words} ${side}, which is a real advantage${cp > 0 ? '' : ' for your opponent'}`
}

/** Sentence-case a fragment so it can start a sentence. */
export function sentence(fragment: string): string {
  if (!fragment) return ''
  return fragment[0].toUpperCase() + fragment.slice(1)
}
