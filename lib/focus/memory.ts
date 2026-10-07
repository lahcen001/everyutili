export const SYMBOLS = ["🍎", "🚀", "🎧", "📚", "🌵", "🎲", "🐙", "🌈", "⚽", "🎸", "🍕", "🦊", "🌙", "🔑", "🧩", "🐝", "🍉", "🎨"];

export interface MemoryCard {
  id: number;
  symbol: string;
}

/** A shuffled deck of `pairs` matching pairs (Fisher–Yates). */
export function buildDeck(pairs: number, rand: () => number = Math.random): MemoryCard[] {
  const chosen = [...SYMBOLS].sort(() => rand() - 0.5).slice(0, Math.min(pairs, SYMBOLS.length));
  const cards = [...chosen, ...chosen].map((symbol, i) => ({ id: i, symbol }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.map((c, i) => ({ ...c, id: i }));
}

/** Stars from the number of moves relative to the number of pairs. */
export function stars(moves: number, pairs: number): 1 | 2 | 3 {
  if (moves <= pairs * 1.6) return 3;
  if (moves <= pairs * 2.6) return 2;
  return 1;
}
