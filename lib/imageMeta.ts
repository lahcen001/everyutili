/**
 * Lossless metadata removal: the pixel data is copied byte-for-byte, only
 * metadata segments/chunks are dropped, so there is no re-compression.
 */
export type ImageKind = "jpeg" | "png" | "webp";

export interface StripOptions {
  /** Keep the ICC colour profile (affects colours; not personal data) */
  keepIcc: boolean;
  /** JPEG only: keep just the rotation flag so the photo isn't shown sideways */
  keepOrientation: boolean;
}

export interface StripResult {
  bytes: Uint8Array;
  /** Names of what was removed, for display */
  removed: string[];
}

export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  return null;
}

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

/** A minimal EXIF block holding only the Orientation tag. */
export function orientationOnlyExif(orientation: number): Uint8Array {
  const tiff = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation & 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const len = payload.length + 2;
  return Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff, ...payload]);
}

export function stripJpeg(bytes: Uint8Array, opts: StripOptions, orientation = 1): StripResult {
  const removed = new Set<string>();
  const out: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error("Not a valid JPEG (broken segment)");
    let marker = bytes[i + 1];
    while (marker === 0xff) marker = bytes[++i + 1]; // fill bytes
    if (marker === 0xda) {
      // Start of scan: everything after is entropy-coded data up to EOI — copy verbatim.
      out.push(bytes.subarray(i));
      break;
    }
    if (marker === 0xd9) {
      out.push(bytes.subarray(i, i + 2));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    const end = i + 2 + length;
    if (length < 2 || end > bytes.length) throw new Error("Not a valid JPEG (truncated segment)");
    const seg = bytes.subarray(i, end);
    let drop = false;
    if (marker === 0xe1) {
      const head = ascii(bytes, i + 4, 5);
      drop = true;
      removed.add(head.startsWith("Exif") ? "EXIF (camera, GPS, date)" : "XMP");
    } else if (marker === 0xe2 && ascii(bytes, i + 4, 11) === "ICC_PROFILE") {
      drop = !opts.keepIcc;
      if (drop) removed.add("ICC colour profile");
    } else if (marker === 0xed) {
      drop = true;
      removed.add("IPTC / Photoshop data");
    } else if (marker === 0xfe) {
      drop = true;
      removed.add("Comments");
    } else if ((marker >= 0xe3 && marker <= 0xec) || marker === 0xef) {
      drop = true;
      removed.add("Other app data");
    }
    if (!drop) out.push(seg);
    i = end;
  }
  let result = concat(out);
  if (opts.keepOrientation && orientation > 1) {
    const exif = orientationOnlyExif(orientation);
    // Insert after SOI (and after JFIF APP0 if it is first).
    let at = 2;
    if (result[2] === 0xff && result[3] === 0xe0) at = 4 + ((result[4] << 8) | result[5]);
    result = concat([result.subarray(0, at), exif, result.subarray(at)]);
  }
  return { bytes: result, removed: [...removed] };
}
const PNG_META = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

export function stripPng(bytes: Uint8Array, opts: StripOptions): StripResult {
  const removed = new Set<string>();
  const out: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (i + 8 <= bytes.length) {
    const length = view.getUint32(i);
    const type = ascii(bytes, i + 4, 4);
    const end = i + 12 + length;
    if (end > bytes.length) throw new Error("Not a valid PNG (truncated chunk)");
    let drop = PNG_META.has(type);
    if (type === "iCCP" && !opts.keepIcc) drop = true;
    if (drop) removed.add(type === "eXIf" ? "EXIF" : type === "iCCP" ? "ICC colour profile" : type === "tIME" ? "Modification time" : "Text notes");
    else out.push(bytes.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return { bytes: concat(out), removed: [...removed] };
}

export function stripWebp(bytes: Uint8Array, opts: StripOptions): StripResult {
  const removed = new Set<string>();
  const chunks: { id: string; data: Uint8Array }[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 12;
  while (i + 8 <= bytes.length) {
    const id = ascii(bytes, i, 4);
    const size = view.getUint32(i + 4, true);
    const padded = size + (size % 2);
    const end = i + 8 + padded;
    if (end > bytes.length + 1) throw new Error("Not a valid WebP (truncated chunk)");
    const data = bytes.subarray(i, Math.min(end, bytes.length));
    if (id === "EXIF" || id === "XMP ") removed.add(id === "EXIF" ? "EXIF (camera, GPS, date)" : "XMP");
    else if (id === "ICCP" && !opts.keepIcc) removed.add("ICC colour profile");
    else chunks.push({ id, data: data.slice() });
    i = end;
  }
  const hasIcc = chunks.some((c) => c.id === "ICCP");
  for (const c of chunks) {
    if (c.id === "VP8X") {
      // flags byte at offset 8: bit 5 ICC (0x20), bit 3 EXIF (0x08), bit 2 XMP (0x04)
      c.data[8] = c.data[8] & ~0x08 & ~0x04;
      if (!hasIcc) c.data[8] &= ~0x20;
    }
  }
  const body = concat(chunks.map((c) => c.data));
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 4), 0);
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  header.set(bytes.subarray(8, 12), 8);
  return { bytes: concat([header, body]), removed: [...removed] };
}

export function stripMetadata(bytes: Uint8Array, opts: StripOptions, orientation = 1): (StripResult & { kind: ImageKind }) | null {
  const kind = detectImageKind(bytes);
  if (!kind) return null;
  const r = kind === "jpeg" ? stripJpeg(bytes, opts, orientation) : kind === "png" ? stripPng(bytes, opts) : stripWebp(bytes, opts);
  return { ...r, kind };
}
