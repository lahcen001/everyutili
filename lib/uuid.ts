export type UuidVersion = "v4" | "v7" | "v1";

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const withHyphens = (h: string) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function uuidV4(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return withHyphens(hex(b));
}

/** RFC 9562 v7: 48-bit unix ms timestamp followed by random bits. Sortable by creation time. */
export function uuidV7(now: number = Date.now()): string {
  const b = randomBytes(16);
  let t = BigInt(now);
  for (let i = 5; i >= 0; i--) {
    b[i] = Number(t & B(0xff));
    t >>= B(8);
  }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  return withHyphens(hex(b));
}

const B = (n: number | string) => BigInt(n);
const GREGORIAN_OFFSET_100NS = B("122192928000000000");
let clockSeq = -1;
let node: Uint8Array | null = null;

/** v1: 60-bit timestamp (100 ns since 1582) + random node id with the multicast bit set (privacy-safe). */
export function uuidV1(now: number = Date.now()): string {
  if (!node) {
    node = randomBytes(6);
    node[0] |= 0x01;
  }
  if (clockSeq < 0) clockSeq = (randomBytes(2)[0] << 8 | randomBytes(2)[1]) & 0x3fff;
  const ts = BigInt(now) * B(10000) + GREGORIAN_OFFSET_100NS + BigInt(Math.floor(Math.random() * 10000));
  const timeLow = Number(ts & B(0xffffffff));
  const timeMid = Number((ts >> B(32)) & B(0xffff));
  const timeHi = Number((ts >> B(48)) & B(0x0fff)) | 0x1000;
  const h = (n: number, len: number) => n.toString(16).padStart(len, "0");
  const seq = (clockSeq & 0x3fff) | 0x8000;
  return `${h(timeLow, 8)}-${h(timeMid, 4)}-${h(timeHi, 4)}-${h(seq, 4)}-${hex(node)}`;
}

export function generateUuid(version: UuidVersion): string {
  return version === "v7" ? uuidV7() : version === "v1" ? uuidV1() : uuidV4();
}

export type UuidFormat = "standard" | "nohyphens" | "braces" | "urn" | "base64";

export function formatUuid(id: string, format: UuidFormat, uppercase: boolean): string {
  const plain = id.replace(/-/g, "").toLowerCase();
  let out: string;
  switch (format) {
    case "nohyphens":
      out = plain;
      break;
    case "braces":
      out = `{${withHyphens(plain)}}`;
      break;
    case "urn":
      out = `urn:uuid:${withHyphens(plain)}`;
      break;
    case "base64": {
      const bytes = plain.match(/../g)!.map((x) => parseInt(x, 16));
      return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    default:
      out = withHyphens(plain);
  }
  return uppercase ? out.toUpperCase() : out;
}

export interface UuidInfo {
  valid: boolean;
  version?: number;
  variant?: string;
  nil?: boolean;
  /** Embedded creation time for v1 / v7 */
  timestamp?: Date;
  normalized?: string;
}

export function inspectUuid(input: string): UuidInfo {
  const cleaned = input.trim().replace(/^urn:uuid:/i, "").replace(/^\{|\}$/g, "");
  const m = /^([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})$/i.exec(cleaned);
  if (!m) return { valid: false };
  const normalized = `${m[1]}-${m[2]}-${m[3]}-${m[4]}-${m[5]}`.toLowerCase();
  const nil = /^0{8}(-0{4}){3}-0{12}$/.test(normalized);
  const maxed = /^f{8}(-f{4}){3}-f{12}$/.test(normalized);
  const version = parseInt(m[3][0], 16);
  const variantNibble = parseInt(m[4][0], 16);
  const variant = variantNibble >= 8 && variantNibble <= 0xb ? "RFC 9562 (standard)" : variantNibble < 8 ? "NCS (legacy)" : variantNibble < 0xe ? "Microsoft (legacy)" : "Reserved";
  const info: UuidInfo = { valid: true, version: nil || maxed ? undefined : version, variant, nil, normalized };
  if (version === 7 && !nil) info.timestamp = new Date(parseInt(m[1] + m[2], 16));
  if (version === 1 && !nil) {
    const ts = (BigInt("0x" + m[3].slice(1) + m[2] + m[1]) - GREGORIAN_OFFSET_100NS) / B(10000);
    info.timestamp = new Date(Number(ts));
  }
  return info;
}
