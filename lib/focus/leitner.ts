/** Days to wait before a card in each box comes back (box 1 is the newest/hardest). */
export const BOX_DAYS = [0, 1, 2, 4, 8, 16];
export const MAX_BOX = BOX_DAYS.length - 1;

export interface Card {
  id: string;
  front: string;
  back: string;
  /** 1..MAX_BOX; 0 means "new" */
  box: number;
  /** epoch ms when the card is next due */
  due: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function newCard(id: string, front: string, back: string, now = Date.now()): Card {
  return { id, front, back, box: 0, due: now };
}

/** Right answer moves the card up a box; wrong sends it back to box 1 (due again today). */
export function review(card: Card, correct: boolean, now = Date.now()): Card {
  const box = correct ? Math.min(MAX_BOX, Math.max(1, card.box + 1)) : 1;
  return { ...card, box, due: correct ? now + BOX_DAYS[box] * DAY : now };
}

export const isDue = (card: Card, now = Date.now()) => card.due <= now;

/** Due cards, hardest (lowest box) first, then oldest due. */
export function dueQueue(cards: Card[], now = Date.now()): Card[] {
  return cards.filter((c) => isDue(c, now)).sort((a, b) => a.box - b.box || a.due - b.due);
}

export function boxCounts(cards: Card[]): number[] {
  const counts = Array.from({ length: MAX_BOX + 1 }, () => 0);
  for (const c of cards) counts[c.box] += 1;
  return counts;
}

/** Parses "front<TAB or , or ;>back" lines. Quotes around a field are removed. */
export function parseCards(text: string): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : line.includes(" - ") ? " - " : ",";
    const i = line.indexOf(sep);
    if (i === -1) continue;
    const clean = (s: string) => s.trim().replace(/^"(.*)"$/, "$1").trim();
    const front = clean(line.slice(0, i));
    const back = clean(line.slice(i + sep.length));
    if (front && back) out.push({ front, back });
  }
  return out;
}

export function cardsToText(cards: Pick<Card, "front" | "back">[]): string {
  return cards.map((c) => `${c.front.replace(/\t|\n/g, " ")}\t${c.back.replace(/\t|\n/g, " ")}`).join("\n");
}
