import { EFF_SHORT_WORDLIST } from "@/lib/data/effShortWordlist";

export type RandomBytes = (n: number) => Uint8Array;

export const cryptoBytes: RandomBytes = (n) => {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
};

/** A uniformly random integer in [0, max) without modulo bias (rejection sampling). */
export function randomInt(max: number, rng: RandomBytes = cryptoBytes): number {
  if (max <= 0 || max > 2 ** 32) throw new RangeError("max must be between 1 and 2^32");
  const limit = Math.floor(2 ** 32 / max) * max;
  for (;;) {
    const b = rng(4);
    const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    if (n < limit) return n % max;
  }
}

export const CLASSES = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
} as const;
const AMBIGUOUS = /[0O1lI|`'"]/g;

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  /** replaces the default symbol set when non-empty */
  customSymbols: string;
}

export const DEFAULT_PASSWORD: PasswordOptions = { length: 20, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false, customSymbols: "" };

export function poolsFor(o: PasswordOptions): string[] {
  const clean = (s: string) => (o.excludeAmbiguous ? s.replace(AMBIGUOUS, "") : s);
  const pools: string[] = [];
  if (o.lower) pools.push(clean(CLASSES.lower));
  if (o.upper) pools.push(clean(CLASSES.upper));
  if (o.digits) pools.push(clean(CLASSES.digits));
  if (o.symbols) pools.push(clean(o.customSymbols.trim() ? [...new Set(o.customSymbols.replace(/\s/g, ""))].join("") : CLASSES.symbols));
  return pools.filter((p) => p.length > 0);
}

export function poolSize(o: PasswordOptions): number {
  return new Set(poolsFor(o).join("")).size;
}

/** Always includes at least one character from every selected class, then shuffles (Fisher–Yates). */
export function generatePassword(o: PasswordOptions, rng: RandomBytes = cryptoBytes): string {
  const pools = poolsFor(o);
  if (pools.length === 0) return "";
  const length = Math.max(o.length, pools.length);
  const all = pools.join("");
  const chars = pools.map((p) => p[randomInt(p.length, rng)]);
  while (chars.length < length) chars.push(all[randomInt(all.length, rng)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  addNumber: boolean;
}

export const DEFAULT_PASSPHRASE: PassphraseOptions = { words: 5, separator: "-", capitalize: false, addNumber: false };

export function generatePassphrase(o: PassphraseOptions, rng: RandomBytes = cryptoBytes): string {
  const picked = Array.from({ length: Math.max(1, o.words) }, () => EFF_SHORT_WORDLIST[randomInt(EFF_SHORT_WORDLIST.length, rng)]);
  const words = o.capitalize ? picked.map((w) => w[0].toUpperCase() + w.slice(1)) : picked;
  if (o.addNumber) words[randomInt(words.length, rng)] += String(randomInt(10, rng));
  return words.join(o.separator);
}

export const passwordEntropy = (size: number, length: number) => (size > 1 ? length * Math.log2(size) : 0);
export const passphraseEntropy = (o: PassphraseOptions) => o.words * Math.log2(EFF_SHORT_WORDLIST.length) + (o.addNumber ? Math.log2(10 * Math.max(1, o.words)) : 0);

export interface Strength {
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  /** 0–4 */
  level: number;
}

export function strengthFor(bits: number): Strength {
  if (bits < 40) return { label: "Very weak", level: 0 };
  if (bits < 60) return { label: "Weak", level: 1 };
  if (bits < 80) return { label: "Fair", level: 2 };
  if (bits < 110) return { label: "Strong", level: 3 };
  return { label: "Very strong", level: 4 };
}

/** Rough time to exhaust half the space at 10 billion guesses a second (a fast offline GPU attack on a fast hash). */
export function crackTime(bits: number, guessesPerSecond = 1e10): string {
  const seconds = 2 ** (bits - 1) / guessesPerSecond;
  if (seconds < 1) return "instantly";
  const units: [number, string][] = [[3.15576e7 * 1e9, "billion years"], [3.15576e7 * 1e6, "million years"], [3.15576e7 * 1e3, "thousand years"], [3.15576e7, "years"], [86400, "days"], [3600, "hours"], [60, "minutes"], [1, "seconds"]];
  const [size, name] = units.find(([s]) => seconds >= s)!;
  const n = seconds / size;
  if (name === "billion years" && n >= 1000) return "longer than the age of the universe";
  return `about ${n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString("en-US")} ${name}`;
}
