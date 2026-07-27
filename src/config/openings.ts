/**
 * Curated opening book for the coach's "Just Play" commentary. Not the full ECO
 * (3,000+ lines) — just the openings people actually reach in casual play, keyed
 * by their SAN move prefix. The matcher returns the LONGEST matching line, so a
 * Najdorf is recognised over a generic Sicilian once the moves arrive.
 *
 * `note` is the coach's spoken line when the opening is first reached.
 */
export interface OpeningEntry {
  name: string
  moves: string[] // SAN prefix
  note: string
}

// Ordered roughly shallow→deep; the matcher picks the longest prefix regardless.
export const OPENINGS: OpeningEntry[] = [
  { name: 'Open Game', moves: ['e4', 'e5'], note: 'The Open Game — classical, principled chess. Fight for the centre.' },
  { name: 'Ruy López', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], note: 'The Ruy López — pressure on the knight that guards e5. A lifelong opening.' },
  { name: 'Ruy López, Morphy Defence', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], note: 'Morphy\'s ...a6 — question the bishop at once. Good instinct.' },
  { name: 'Italian Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], note: 'The Italian — bishop eyes f7, the weakest square. Quick, natural development.' },
  { name: 'Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], note: 'The Giuoco Piano — the "quiet game." Don\'t be fooled, it gets sharp.' },
  { name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], note: 'The Scotch — break the centre open early and seize space.' },
  { name: 'Petrov Defence', moves: ['e4', 'e5', 'Nf3', 'Nf6'], note: 'The Petrov — counterattack instead of defend e5. Solid and respected.' },
  { name: "King's Gambit", moves: ['e4', 'e5', 'f4'], note: 'The King\'s Gambit! Romantic, fearless — offering a pawn for a roaring attack.' },
  { name: 'Vienna Game', moves: ['e4', 'e5', 'Nc3'], note: 'The Vienna — flexible, often steering toward a delayed gambit.' },
  { name: 'Sicilian Defence', moves: ['e4', 'c5'], note: 'The Sicilian — Black\'s sharpest reply. Asymmetry, imbalance, knife-fights.' },
  { name: 'Open Sicilian', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4'], note: 'The Open Sicilian — both sides play for the win. No quarter here.' },
  { name: 'Najdorf Sicilian', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'], note: 'The Najdorf — Fischer\'s and Kasparov\'s weapon. The deepest theory in chess.' },
  { name: 'Closed Sicilian', moves: ['e4', 'c5', 'Nc3'], note: 'The Closed Sicilian — a slower, manoeuvring battle. Patience pays.' },
  { name: 'French Defence', moves: ['e4', 'e6'], note: 'The French — solid, a touch cramped, but with a venomous counterpunch.' },
  { name: 'Caro-Kann Defence', moves: ['e4', 'c6'], note: 'The Caro-Kann — rock-solid structure. Hard to crack, easy to trust.' },
  { name: 'Pirc Defence', moves: ['e4', 'd6'], note: 'The Pirc — let me build the centre, then strike at it. Hypermodern.' },
  { name: 'Scandinavian Defence', moves: ['e4', 'd5'], note: 'The Scandinavian — challenge the centre immediately. Direct and clear.' },
  { name: 'Modern Defence', moves: ['e4', 'g6'], note: 'The Modern — fianchetto first, contest the centre later.' },
  { name: 'Alekhine Defence', moves: ['e4', 'Nf6'], note: 'The Alekhine — provoke my pawns forward, then undermine them. Bold.' },
  { name: 'Queen\'s Pawn Game', moves: ['d4', 'd5'], note: 'A Queen\'s Pawn game — strategic, less forcing, all about structure.' },
  { name: "Queen's Gambit", moves: ['d4', 'd5', 'c4'], note: 'The Queen\'s Gambit — offer a pawn to dominate the centre. Famously sound.' },
  { name: "Queen's Gambit Declined", moves: ['d4', 'd5', 'c4', 'e6'], note: 'The QGD — declined and solid. A backbone of classical chess.' },
  { name: 'Slav Defence', moves: ['d4', 'd5', 'c4', 'c6'], note: 'The Slav — hold the centre without locking in your bishop. Resilient.' },
  { name: "Queen's Gambit Accepted", moves: ['d4', 'd5', 'c4', 'dxc4'], note: 'The QGA — take the pawn, but be ready to give it back for development.' },
  { name: 'Indian Defence', moves: ['d4', 'Nf6'], note: 'An Indian setup — flexible, hypermodern, lots of ways to go from here.' },
  { name: 'Nimzo-Indian Defence', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], note: 'The Nimzo-Indian — pin the knight, fight for the centre with pieces. Elite.' },
  { name: "King's Indian Defence", moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'], note: 'The King\'s Indian — give me the centre, then storm the kingside. Dynamite.' },
  { name: 'Grünfeld Defence', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'], note: 'The Grünfeld — invite the big centre, then chip it apart. Razor-sharp.' },
  { name: 'Benoni Defence', moves: ['d4', 'Nf6', 'c4', 'c5'], note: 'The Benoni — unbalanced and aggressive. Black plays for the full point.' },
  { name: 'Dutch Defence', moves: ['d4', 'f5'], note: 'The Dutch — stake a claim on the kingside from move one. Combative.' },
  { name: 'English Opening', moves: ['c4'], note: 'The English — flank first, flexible. It can transpose almost anywhere.' },
  { name: 'Réti Opening', moves: ['Nf3'], note: 'The Réti — develop, stay flexible, define the centre on your terms.' },
  { name: 'Bird Opening', moves: ['f4'], note: 'Bird\'s Opening — an early kingside stake. Offbeat but principled.' },
  { name: 'London System', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'], note: 'The London — a calm, reliable setup you can play on autopilot. Solid.' },
]

/** Return the deepest opening whose move prefix matches the game so far. */
export function recognizeOpening(history: string[]): OpeningEntry | null {
  let best: OpeningEntry | null = null
  for (const o of OPENINGS) {
    if (o.moves.length > history.length) continue
    if (o.moves.every((m, i) => m === history[i])) {
      if (!best || o.moves.length > best.moves.length) best = o
    }
  }
  return best
}
