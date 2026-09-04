/**
 * Minimal, dependency-free animated GIF89a encoder.
 *
 * Everything runs client-side: each RGBA frame is color-quantized to a
 * 256-color palette via median-cut, then LZW-compressed per the GIF spec.
 * There is no external GIF library in this repo, so this is a from-scratch
 * implementation — not a port — of just enough of GIF89a to produce a
 * valid, widely-compatible animated GIF (global color table, graphic
 * control extension for per-frame delay, NETSCAPE2.0 loop extension).
 */

export interface GifFrame {
  /** RGBA pixel data, width * height * 4 bytes. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Frame delay in hundredths of a second (GIF's native time unit). */
  delayCs: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** Growable byte buffer — avoids repeated array concatenation while encoding. */
class ByteWriter {
  private chunks: number[] = [];

  writeByte(b: number): void {
    this.chunks.push(b & 0xff);
  }

  writeBytes(bytes: ArrayLike<number>): void {
    for (let i = 0; i < bytes.length; i++) this.chunks.push(bytes[i] & 0xff);
  }

  writeString(s: string): void {
    for (let i = 0; i < s.length; i++) this.chunks.push(s.charCodeAt(i) & 0xff);
  }

  writeUint16LE(v: number): void {
    this.writeByte(v & 0xff);
    this.writeByte((v >> 8) & 0xff);
  }

  toUint8Array(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.chunks);
  }
}

/**
 * Median-cut color quantization: recursively splits the pixel set along
 * its widest channel range until there are (up to) `maxColors` buckets,
 * then averages each bucket into one palette entry.
 */
function quantize(pixels: RgbColor[], maxColors: number): RgbColor[] {
  if (pixels.length === 0) return [{ r: 0, g: 0, b: 0 }];

  type Bucket = RgbColor[];
  const buckets: Bucket[] = [pixels];

  function channelRange(bucket: Bucket, channel: keyof RgbColor): number {
    let min = 255;
    let max = 0;
    for (const p of bucket) {
      const v = p[channel];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return max - min;
  }

  function widestChannel(bucket: Bucket): keyof RgbColor {
    const rRange = channelRange(bucket, "r");
    const gRange = channelRange(bucket, "g");
    const bRange = channelRange(bucket, "b");
    if (rRange >= gRange && rRange >= bRange) return "r";
    if (gRange >= rRange && gRange >= bRange) return "g";
    return "b";
  }

  while (buckets.length < maxColors) {
    let splitIndex = -1;
    let splitRange = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length < 2) continue;
      const channel = widestChannel(buckets[i]);
      const range = channelRange(buckets[i], channel);
      if (range > splitRange) {
        splitRange = range;
        splitIndex = i;
      }
    }
    if (splitIndex === -1 || splitRange <= 0) break;

    const bucket = buckets[splitIndex];
    const channel = widestChannel(bucket);
    const sorted = [...bucket].sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(sorted.length / 2);
    const left = sorted.slice(0, mid);
    const right = sorted.slice(mid);
    buckets.splice(splitIndex, 1, left, right);
  }

  return buckets
    .filter((bucket) => bucket.length > 0)
    .map((bucket) => {
      const total = bucket.reduce(
        (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
        { r: 0, g: 0, b: 0 }
      );
      return {
        r: Math.round(total.r / bucket.length),
        g: Math.round(total.g / bucket.length),
        b: Math.round(total.b / bucket.length),
      };
    });
}

function nearestPaletteIndex(color: RgbColor, palette: RgbColor[]): number {
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const dr = p.r - color.r;
    const dg = p.g - color.g;
    const db = p.b - color.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/** LZW encoder per the GIF spec (variable code width, clear/end-of-info codes). */
function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let nextCode = endCode + 1;
  let codeSize = minCodeSize + 1;

  const writer = new ByteWriter();
  let bitBuffer = 0;
  let bitCount = 0;

  function emit(code: number): void {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      writer.writeByte(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  }

  let dict = new Map<string, number>();
  function resetDict(): void {
    dict = new Map();
    for (let i = 0; i < clearCode; i++) dict.set(String(i), i);
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  }

  resetDict();
  emit(clearCode);

  let prefix = indices.length > 0 ? String(indices[0]) : "";
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const combined = prefix + "," + k;
    if (dict.has(combined)) {
      prefix = combined;
      continue;
    }

    emit(dict.get(prefix)!);

    if (nextCode < 4096) {
      dict.set(combined, nextCode);
      nextCode++;
      if (nextCode > 1 << codeSize && codeSize < 12) {
        codeSize++;
      }
    } else {
      emit(clearCode);
      resetDict();
    }

    prefix = String(k);
  }
  if (prefix !== "") emit(dict.get(prefix)!);
  emit(endCode);

  if (bitCount > 0) writer.writeByte(bitBuffer & 0xff);

  return writer.toUint8Array();
}

/** Splits LZW-compressed data into GIF's required 255-byte sub-blocks. */
function writeSubBlocks(writer: ByteWriter, data: Uint8Array): void {
  let offset = 0;
  while (offset < data.length) {
    const size = Math.min(255, data.length - offset);
    writer.writeByte(size);
    writer.writeBytes(data.subarray(offset, offset + size));
    offset += size;
  }
  writer.writeByte(0);
}

function paletteSizeToPower(paletteLength: number): number {
  let power = 1;
  while (1 << power < paletteLength) power++;
  return power;
}

/**
 * Encodes `frames` (RGBA, all the same dimensions) into an animated
 * GIF89a Blob. Each frame gets its own quantized 256-color palette for
 * best fidelity — screen captures vary a lot frame to frame.
 */
export function encodeGif(frames: GifFrame[]): Blob {
  if (frames.length === 0) throw new Error("encodeGif: no frames to encode");

  const { width, height } = frames[0];
  const writer = new ByteWriter();

  // Header
  writer.writeString("GIF89a");
  writer.writeUint16LE(width);
  writer.writeUint16LE(height);
  // Global color table flag off (each frame carries its own local table);
  // background color index 0, no aspect ratio info.
  writer.writeByte(0x00);
  writer.writeByte(0x00);
  writer.writeByte(0x00);

  // NETSCAPE2.0 application extension: loop forever.
  writer.writeByte(0x21);
  writer.writeByte(0xff);
  writer.writeByte(0x0b);
  writer.writeString("NETSCAPE2.0");
  writer.writeByte(0x03);
  writer.writeByte(0x01);
  writer.writeUint16LE(0x0000);
  writer.writeByte(0x00);

  for (const frame of frames) {
    const pixelCount = frame.width * frame.height;
    const pixels: RgbColor[] = new Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      pixels[i] = { r: frame.data[o], g: frame.data[o + 1], b: frame.data[o + 2] };
    }

    const palette = quantize(pixels, 256);
    const paletteBits = paletteSizeToPower(palette.length);
    const paletteEntries = 1 << paletteBits;

    const indices = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      indices[i] = nearestPaletteIndex(pixels[i], palette);
    }

    // Graphic Control Extension — per-frame delay, no transparency.
    writer.writeByte(0x21);
    writer.writeByte(0xf9);
    writer.writeByte(0x04);
    writer.writeByte(0x00);
    writer.writeUint16LE(frame.delayCs);
    writer.writeByte(0x00);
    writer.writeByte(0x00);

    // Image Descriptor
    writer.writeByte(0x2c);
    writer.writeUint16LE(0);
    writer.writeUint16LE(0);
    writer.writeUint16LE(frame.width);
    writer.writeUint16LE(frame.height);
    // Local color table present, sized to paletteBits.
    writer.writeByte(0x80 | (paletteBits - 1));

    // Local Color Table
    for (let i = 0; i < paletteEntries; i++) {
      const c = palette[i] ?? { r: 0, g: 0, b: 0 };
      writer.writeByte(c.r);
      writer.writeByte(c.g);
      writer.writeByte(c.b);
    }

    // Image Data
    const minCodeSize = Math.max(2, paletteBits);
    writer.writeByte(minCodeSize);
    const compressed = lzwEncode(indices, minCodeSize);
    writeSubBlocks(writer, compressed);
  }

  writer.writeByte(0x3b);

  return new Blob([writer.toUint8Array()], { type: "image/gif" });
}
