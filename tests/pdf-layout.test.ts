import { describe, expect, it } from "vitest";
import { fitImageToPage } from "@/lib/pdf/layout";
import { readJpegOrientation } from "@/lib/exif";

const A4: readonly [number, number] = [595.28, 841.89];

describe("fitImageToPage", () => {
  it("uses a portrait page for a tall image and centers it", () => {
    const l = fitImageToPage(1000, 2000, A4, "auto", 0);
    expect(l.pageWidth).toBeCloseTo(595.28);
    expect(l.pageHeight).toBeCloseTo(841.89);
    expect(l.width / l.height).toBeCloseTo(0.5);
    expect(l.x + l.width / 2).toBeCloseTo(l.pageWidth / 2);
    expect(l.y + l.height / 2).toBeCloseTo(l.pageHeight / 2);
  });

  it("uses a landscape page for a wide image in auto mode", () => {
    const l = fitImageToPage(4000, 3000, A4, "auto", 0);
    expect(l.pageWidth).toBeCloseTo(841.89);
    expect(l.pageHeight).toBeCloseTo(595.28);
  });

  it("never lets a huge photo make a huge page", () => {
    const l = fitImageToPage(8000, 6000, A4, "auto", 36);
    expect(l.pageWidth).toBeLessThan(900);
    expect(l.width).toBeLessThanOrEqual(l.pageWidth - 72 + 0.001);
    expect(l.height).toBeLessThanOrEqual(l.pageHeight - 72 + 0.001);
  });

  it("honors a forced orientation and survives margins larger than the page", () => {
    expect(fitImageToPage(100, 100, A4, "landscape", 0).pageWidth).toBeCloseTo(841.89);
    const l = fitImageToPage(100, 100, A4, "portrait", 9999);
    expect(l.width).toBeGreaterThan(0);
  });
});

function jpegWithOrientation(value: number, little: boolean): ArrayBuffer {
  const bytes: number[] = [0xff, 0xd8, 0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const u16 = (n: number) => (little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  const u32 = (n: number) => (little ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
  bytes.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  bytes.push(...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(value), 0, 0, ...u32(0));
  return new Uint8Array(bytes).buffer;
}

describe("readJpegOrientation", () => {
  it("reads both byte orders", () => {
    expect(readJpegOrientation(jpegWithOrientation(6, true))).toBe(6);
    expect(readJpegOrientation(jpegWithOrientation(8, false))).toBe(8);
  });
  it("returns 1 for non-JPEG, truncated and out-of-range data", () => {
    expect(readJpegOrientation(new Uint8Array([1, 2, 3, 4, 5]).buffer)).toBe(1);
    expect(readJpegOrientation(jpegWithOrientation(6, true).slice(0, 20))).toBe(1);
    expect(readJpegOrientation(jpegWithOrientation(9, true))).toBe(1);
  });
});

import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";

describe("friendlyPdfError", () => {
  it("explains password-protected files for both libraries", () => {
    const pdfLib = Object.assign(new Error("Input document to `PDFDocument.load` is encrypted"), { name: "EncryptedPDFError" });
    const pdfJs = Object.assign(new Error("No password given"), { name: "PasswordException" });
    expect(friendlyPdfError(pdfLib, "x")).toMatch(/password-protected/);
    expect(friendlyPdfError(pdfJs, "x")).toMatch(/password-protected/);
  });
  it("explains damaged files and falls back otherwise", () => {
    expect(friendlyPdfError(new Error("Failed to parse PDF document"), "x")).toMatch(/valid PDF/);
    expect(friendlyPdfError(new Error("boom"), "x")).toBe("boom");
    expect(friendlyPdfError("not an error", "fallback")).toBe("fallback");
  });
  it("accepts PDFs with an empty MIME type by extension", () => {
    expect(isPdfFile(new File([], "a.PDF", { type: "" }))).toBe(true);
    expect(isPdfFile(new File([], "a.png", { type: "image/png" }))).toBe(false);
  });
});

import { savedPercent } from "@/lib/pdf/compress";

describe("savedPercent", () => {
  it("reports savings, no change, growth and bad input", () => {
    expect(savedPercent(1000, 400)).toBe(60);
    expect(savedPercent(1000, 1000)).toBe(0);
    expect(savedPercent(1000, 1200)).toBe(-20);
    expect(savedPercent(0, 10)).toBe(0);
  });
});
