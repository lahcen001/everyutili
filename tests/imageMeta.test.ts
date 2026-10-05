import { describe, expect, it } from "vitest";
import { detectImageKind, orientationOnlyExif, stripJpeg, stripMetadata, stripPng, stripWebp } from "@/lib/imageMeta";
import { parseExif, readJpegOrientation } from "@/lib/exif";

const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const asc = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const SCAN = [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 0x12, 0x34, 0xff, 0xd9];
const OPTS = { keepIcc: false, keepOrientation: false };

const jpeg = (extra: number[][]) => Uint8Array.from([0xff, 0xd8, ...seg(0xe0, [...asc("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]), ...extra.flat(), ...seg(0xdb, [0, ...new Array(64).fill(8)]), ...SCAN]);
const exifWith = (orientation: number) => Array.from(orientationOnlyExif(orientation));

describe("imageMeta", () => {
  it("detects kinds", () => {
    expect(detectImageKind(jpeg([]))).toBe("jpeg");
    expect(detectImageKind(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("png");
    expect(detectImageKind(Uint8Array.from([1, 2, 3]))).toBeNull();
  });

  it("removes EXIF, XMP, IPTC and comments from a JPEG but keeps the image data untouched", () => {
    const src = jpeg([exifWith(6), seg(0xe1, [...asc("http://ns.adobe.com/xap/1.0/\0"), 1, 2]), seg(0xed, [...asc("Photoshop 3.0\0")]), seg(0xfe, asc("secret"))]);
    const r = stripJpeg(src, OPTS);
    expect(r.removed.join()).toContain("EXIF");
    expect(r.removed).toContain("XMP");
    expect(r.removed).toContain("IPTC / Photoshop data");
    expect(r.removed).toContain("Comments");
    expect(r.bytes.length).toBeLessThan(src.length);
    // scan data is byte-identical
    expect(Array.from(r.bytes.slice(-SCAN.length))).toEqual(SCAN);
    expect(readJpegOrientation(r.bytes.buffer.slice(r.bytes.byteOffset, r.bytes.byteOffset + r.bytes.byteLength) as ArrayBuffer)).toBe(1);
    expect(parseExif(r.bytes.buffer.slice(0) as ArrayBuffer)).toBeNull();
  });

  it("keeps ICC only when asked", () => {
    const icc = seg(0xe2, [...asc("ICC_PROFILE\0"), 1, 1, 9, 9]);
    expect(stripJpeg(jpeg([icc]), OPTS).removed).toContain("ICC colour profile");
    const kept = stripJpeg(jpeg([icc]), { ...OPTS, keepIcc: true });
    expect(kept.removed).not.toContain("ICC colour profile");
    expect(kept.bytes.length).toBeGreaterThan(stripJpeg(jpeg([icc]), OPTS).bytes.length);
  });

  it("can keep only the orientation", () => {
    const src = jpeg([exifWith(6)]);
    const r = stripJpeg(src, { ...OPTS, keepOrientation: true }, 6);
    const buf = r.bytes.buffer.slice(r.bytes.byteOffset, r.bytes.byteOffset + r.bytes.byteLength) as ArrayBuffer;
    expect(readJpegOrientation(buf)).toBe(6);
    expect(Array.from(r.bytes.slice(-SCAN.length))).toEqual(SCAN);
  });

  it("rejects a broken jpeg", () => {
    expect(() => stripJpeg(Uint8Array.from([0xff, 0xd8, 0x00, 0x01]), OPTS)).toThrow();
  });

  it("strips PNG text/exif/time chunks", () => {
    const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...asc(type), ...data, 0, 0, 0, 0];
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk("IHDR", new Array(13).fill(1)), ...chunk("tEXt", asc("Author\0me")), ...chunk("eXIf", [1, 2]), ...chunk("tIME", [1, 2, 3, 4, 5, 6, 7]), ...chunk("IDAT", [9, 9]), ...chunk("IEND", [])]);
    const r = stripPng(png, OPTS);
    expect(r.removed).toEqual(expect.arrayContaining(["Text notes", "EXIF", "Modification time"]));
    const types = [];
    for (let i = 8; i < r.bytes.length; ) {
      const len = new DataView(r.bytes.buffer, r.bytes.byteOffset).getUint32(i);
      types.push(String.fromCharCode(...r.bytes.slice(i + 4, i + 8)));
      i += 12 + len;
    }
    expect(types).toEqual(["IHDR", "IDAT", "IEND"]);
  });

  it("strips WebP EXIF/XMP and fixes the RIFF size and VP8X flags", () => {
    const le = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
    const chunk = (id: string, data: number[]) => [...asc(id), ...le(data.length), ...data, ...(data.length % 2 ? [0] : [])];
    const vp8x = chunk("VP8X", [0x08 | 0x04, 0, 0, 0, 9, 0, 0, 9, 0, 0]);
    const body = [...asc("WEBP"), ...vp8x, ...chunk("VP8 ", [1, 2, 3, 4]), ...chunk("EXIF", [1, 2, 3]), ...chunk("XMP ", [1])];
    const webp = Uint8Array.from([...asc("RIFF"), ...le(body.length), ...body]);
    const r = stripWebp(webp, OPTS);
    expect(r.removed.length).toBe(2);
    const size = new DataView(r.bytes.buffer, r.bytes.byteOffset).getUint32(4, true);
    expect(size).toBe(r.bytes.length - 8);
    expect(r.bytes[20]).toBe(0); // VP8X flags byte cleared
    expect(detectImageKind(r.bytes)).toBe("webp");
  });

  it("stripMetadata returns null for unknown files", () => {
    expect(stripMetadata(Uint8Array.from([1, 2, 3, 4]), OPTS)).toBeNull();
  });
});
