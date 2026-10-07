export type HashAlgo = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512" | "CRC32";

export const HASH_ALGOS: { id: HashAlgo; note?: string }[] = [
  { id: "MD5", note: "Broken for security — fine for checksums and legacy systems" },
  { id: "SHA-1", note: "Weak — avoid for new security uses" },
  { id: "SHA-256" },
  { id: "SHA-384" },
  { id: "SHA-512" },
  { id: "CRC32", note: "A 32-bit checksum for catching accidental corruption, not tampering" },
];

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/* ------------------------------------------------------------------ CRC32 */
let crcTable: Uint32Array | null = null;
export function crc32(bytes: Uint8Array): string {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

/* -------------------------------------------------------------------- MD5 */
const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5(bytes: Uint8Array): string {
  const len = bytes.length;
  const padded = new Uint8Array(((len + 8) >> 6 << 6) + 64);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, (len << 3) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(len / 2 ** 29), true);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let off = 0; off < padded.length; off += 64) {
    const M = Array.from({ length: 16 }, (_, i) => view.getUint32(off + i * 4, true));
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) (F = (B & C) | (~B & D)), (g = i);
      else if (i < 32) (F = (D & B) | (~D & C)), (g = (5 * i + 1) % 16);
      else if (i < 48) (F = B ^ C ^ D), (g = (3 * i + 5) % 16);
      else (F = C ^ (B | ~D)), (g = (7 * i) % 16);
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((v, i) => ov.setUint32(i * 4, v, true));
  return hex(out);
}

export function toBase64(hexString: string): string {
  const bytes = hexString.match(/../g)!.map((h) => parseInt(h, 16));
  return btoa(String.fromCharCode(...bytes));
}

/** SHA hashing needs the whole input in memory (Web Crypto has no streaming API). */
export const SHA_SIZE_LIMIT = 1024 * 1024 * 1024;

export async function hashBytes(algo: HashAlgo, bytes: Uint8Array): Promise<string> {
  if (algo === "MD5") return md5(bytes);
  if (algo === "CRC32") return crc32(bytes);
  return hex(new Uint8Array(await crypto.subtle.digest(algo, bytes as BufferSource)));
}

/** Compare a pasted checksum with a computed one, ignoring case, spaces, colons and a "sha256:" style prefix. */
export function sameHash(expected: string, actualHex: string): boolean {
  const clean = (s: string) => s.trim().replace(/^(?:md5|sha-?\d*|crc-?32)\s*[:=]\s*/i, "").replace(/[\s:]/g, "").toLowerCase();
  const e = clean(expected);
  if (!e) return false;
  if (e === actualHex.toLowerCase()) return true;
  // also accept Base64
  try {
    return clean(toBase64(actualHex)) === e.replace(/\s/g, "") || toBase64(actualHex) === expected.trim();
  } catch {
    return false;
  }
}
