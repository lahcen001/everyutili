import { describe, expect, it } from "vitest";
import { crc32, hashBytes, md5, sameHash, toBase64 } from "@/lib/hash";
import { CLASSES, DEFAULT_PASSPHRASE, DEFAULT_PASSWORD, crackTime, generatePassphrase, generatePassword, passphraseEntropy, passwordEntropy, poolSize, poolsFor, randomInt, strengthFor, type RandomBytes } from "@/lib/password";

const enc = (s: string) => new TextEncoder().encode(s);

describe("hash", () => {
  it("MD5 matches known vectors, including multi-block input", () => {
    expect(md5(enc(""))).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5(enc("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5(enc("The quick brown fox jumps over the lazy dog"))).toBe("9e107d9d372bb6826bd81d3542a419d6");
    expect(md5(enc("a".repeat(1000)))).toBe("cabe45dcc9ae5b66ba86600cca6b8ba8");
  });
  it("CRC32 matches the standard check value", () => {
    expect(crc32(enc("123456789"))).toBe("cbf43926");
    expect(crc32(enc(""))).toBe("00000000");
  });
  it("SHA via Web Crypto", async () => {
    expect(await hashBytes("SHA-256", enc("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await hashBytes("SHA-1", enc("abc"))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(await hashBytes("MD5", enc("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
  it("compares pasted checksums loosely", () => {
    const h = "900150983cd24fb0d6963f7d28e17f72";
    expect(sameHash(h.toUpperCase(), h)).toBe(true);
    expect(sameHash(`md5: ${h}`, h)).toBe(true);
    expect(sameHash(h.replace(/(..)/g, "$1:").slice(0, -1), h)).toBe(true);
    expect(sameHash(toBase64(h), h)).toBe(true);
    expect(sameHash("deadbeef", h)).toBe(false);
    expect(sameHash("", h)).toBe(false);
  });
});

describe("password", () => {
  // deterministic byte source for the tests
  const seq = (values: number[]): RandomBytes => {
    let i = 0;
    return (n) => Uint8Array.from({ length: n }, () => values[i++ % values.length]);
  };
  it("randomInt rejects values in the biased tail", () => {
    // max 3: limit = floor(2^32/3)*3 = 4294967295; 0xFFFFFFFF is rejected, next value 5 → 5 % 3
    const rng = seq([255, 255, 255, 255, 0, 0, 0, 5]);
    expect(randomInt(3, rng)).toBe(2);
    expect(() => randomInt(0)).toThrow();
  });
  it("randomInt is roughly uniform", () => {
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 6000; i++) counts[randomInt(6)]++;
    counts.forEach((c) => expect(c).toBeGreaterThan(800));
  });
  it("generates the requested length with every selected class present", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword({ ...DEFAULT_PASSWORD, length: 8 });
      expect(p).toHaveLength(8);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/\d/);
      expect(p).toMatch(/[^a-zA-Z0-9]/);
    }
  });
  it("respects exclusions, custom symbols and returns empty without a class", () => {
    const p = generatePassword({ ...DEFAULT_PASSWORD, length: 200, excludeAmbiguous: true, symbols: false });
    expect(p).not.toMatch(/[0O1lI]/);
    const q = generatePassword({ ...DEFAULT_PASSWORD, length: 100, lower: false, upper: false, digits: false, customSymbols: "@#" });
    expect(q).toMatch(/^[@#]+$/);
    expect(generatePassword({ ...DEFAULT_PASSWORD, lower: false, upper: false, digits: false, symbols: false })).toBe("");
    expect(poolsFor(DEFAULT_PASSWORD)).toHaveLength(4);
    expect(poolSize({ ...DEFAULT_PASSWORD, upper: false, digits: false, symbols: false })).toBe(CLASSES.lower.length);
  });
  it("makes passphrases", () => {
    const p = generatePassphrase({ ...DEFAULT_PASSPHRASE, words: 4, separator: " ", capitalize: true, addNumber: true });
    expect(p.split(" ")).toHaveLength(4);
    expect(p).toMatch(/[A-Z]/);
    expect(p).toMatch(/\d/);
    expect(passphraseEntropy({ ...DEFAULT_PASSPHRASE, words: 6 })).toBeCloseTo(6 * Math.log2(1296), 5);
  });
  it("estimates entropy, strength and cracking time", () => {
    expect(passwordEntropy(94, 20)).toBeCloseTo(131.1, 0);
    expect(passwordEntropy(1, 20)).toBe(0);
    expect(strengthFor(30).label).toBe("Very weak");
    expect(strengthFor(130).label).toBe("Very strong");
    expect(crackTime(20)).toBe("instantly");
    expect(crackTime(64)).toContain("year");
    expect(crackTime(200)).toBe("longer than the age of the universe");
  });
});
