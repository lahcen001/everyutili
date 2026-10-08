import { describe, expect, it } from "vitest";
import { CalcError, calculate, compile, formatNumber } from "@/lib/calc/expr";
import * as F from "@/lib/calc/fraction";
import * as M from "@/lib/calc/matrix";
import { formatRoot, solveQuadratic } from "@/lib/calc/quadratic";
import * as R from "@/lib/calc/radix";
import { describe as describeStats, parseNumbers } from "@/lib/calc/stats";
import { divisors, factorString, gcdAll, isPrime, lcmAll, primeFactors } from "@/lib/calc/numtheory";

describe("expression engine", () => {
  it("does arithmetic with precedence and cleans float noise", () => {
    expect(calculate("2+3*4")).toBe(14);
    expect(calculate("(2+3)*4")).toBe(20);
    expect(calculate("0.1+0.2")).toBe(0.3);
    expect(calculate("2^3^2")).toBe(512);
    expect(calculate("-2^2")).toBe(-4);
    expect(calculate("2^-2")).toBe(0.25);
    expect(calculate("10/4")).toBe(2.5);
    expect(calculate("7−2×3")).toBe(1);
  });
  it("supports implicit multiplication, constants, percent and factorial", () => {
    expect(calculate("2pi")).toBeCloseTo(6.283185307, 8);
    expect(calculate("3(4+1)")).toBe(15);
    expect(calculate("2sin(0)+1")).toBe(1);
    expect(calculate("50%")).toBe(0.5);
    expect(calculate("200*10%")).toBe(20);
    expect(calculate("5!")).toBe(120);
    expect(calculate("e^1")).toBeCloseTo(Math.E, 10);
  });
  it("handles degrees and radians", () => {
    expect(calculate("sin(30)", { angle: "deg" })).toBe(0.5);
    expect(calculate("cos(180)", { angle: "deg" })).toBe(-1);
    expect(calculate("sin(180)", { angle: "deg" })).toBe(0);
    expect(calculate("asin(1)", { angle: "deg" })).toBe(90);
    expect(calculate("sin(pi/2)", { angle: "rad" })).toBe(1);
    expect(calculate("tan(45)", { angle: "deg" })).toBe(1);
  });
  it("evaluates log, roots, ans and auto-closes parentheses", () => {
    expect(calculate("log(1000)")).toBe(3);
    expect(calculate("ln(e)")).toBe(1);
    expect(calculate("sqrt(16)")).toBe(4);
    expect(calculate("√9")).toBe(3);
    expect(calculate("cbrt(27)")).toBe(3);
    expect(calculate("nroot(32,5)")).toBe(2);
    expect(calculate("ncr(5,2)")).toBe(10);
    expect(calculate("npr(5,2)")).toBe(20);
    expect(calculate("ans*2", { ans: 21 })).toBe(42);
    expect(calculate("(2+3")).toBe(5);
    expect(calculate("sin(30", { angle: "deg" })).toBe(0.5);
  });
  it("reports errors clearly", () => {
    expect(() => calculate("1/0")).toThrow(CalcError);
    expect(() => calculate("")).toThrow(CalcError);
    expect(() => calculate("2+")).toThrow(CalcError);
    expect(() => calculate("foo(2)")).toThrow(/Unknown function/);
    expect(() => calculate("(-8)^0.5")).toThrow(/real/);
    expect(() => calculate("2$3")).toThrow(CalcError);
    expect(() => calculate("(-1)!")).toThrow(CalcError);
  });
  it("compiles functions for graphing", () => {
    const f = compile("x^2-4");
    expect(f(3)).toBe(5);
    expect(compile("1/x")(0)).toBeNaN();
    expect(compile("sqrt(x)")(-1)).toBeNaN();
    expect(compile("sin(x)", { angle: "deg" })(90)).toBe(1);
  });
  it("formats numbers", () => {
    expect(formatNumber(0.30000000000000004)).toBe("0.3");
    expect(formatNumber(1e21)).toBe("1e21");
    expect(formatNumber(1 / 3)).toBe("0.333333333333");
    expect(formatNumber(1234.5)).toBe("1234.5");
    expect(formatNumber(Infinity)).toBe("∞");
  });
});

describe("fractions", () => {
  it("adds, subtracts, multiplies and divides in lowest terms", () => {
    expect(F.add(F.frac(1, 2), F.frac(1, 3))).toEqual({ n: 5, d: 6 });
    expect(F.sub(F.frac(1, 2), F.frac(3, 4))).toEqual({ n: -1, d: 4 });
    expect(F.mul(F.frac(2, 3), F.frac(3, 4))).toEqual({ n: 1, d: 2 });
    expect(F.div(F.frac(1, 2), F.frac(1, 4))).toEqual({ n: 2, d: 1 });
    expect(() => F.div(F.frac(1, 2), F.frac(0, 1))).toThrow();
    expect(() => F.frac(1, 0)).toThrow();
  });
  it("parses and prints mixed numbers", () => {
    expect(F.parse("2 1/3")).toEqual({ n: 7, d: 3 });
    expect(F.parse("-2 1/3")).toEqual({ n: -7, d: 3 });
    expect(F.parse("0.75")).toEqual({ n: 3, d: 4 });
    expect(F.parse("5")).toEqual({ n: 5, d: 1 });
    expect(F.toMixedString({ n: 7, d: 3 })).toBe("2 1/3");
    expect(F.toMixedString({ n: -7, d: 3 })).toBe("-2 1/3");
    expect(F.toMixedString({ n: 1, d: 3 })).toBe("1/3");
    expect(F.toDecimal({ n: 1, d: 4 })).toBe(0.25);
    expect(() => F.parse("abc")).toThrow();
  });
});

describe("matrices", () => {
  const a = [[1, 2], [3, 4]];
  const b = [[0, 1], [1, 0]];
  it("adds, multiplies and transposes", () => {
    expect(M.add(a, b)).toEqual([[1, 3], [4, 4]]);
    expect(M.subtract(a, b)).toEqual([[1, 1], [2, 4]]);
    expect(M.multiply(a, b)).toEqual([[2, 1], [4, 3]]);
    expect(M.transpose([[1, 2, 3]])).toEqual([[1], [2], [3]]);
    expect(() => M.multiply(a, [[1, 2, 3]])).toThrow();
    expect(() => M.add(a, [[1]])).toThrow();
  });
  it("finds determinants, inverses and traces", () => {
    expect(M.determinant(a)).toBe(-2);
    expect(M.determinant([[2, 0, 0], [0, 3, 0], [0, 0, 4]])).toBe(24);
    expect(M.determinant([[1, 2], [2, 4]])).toBe(0);
    expect(M.inverse(a)).toEqual([[-2, 1], [1.5, -0.5]]);
    expect(() => M.inverse([[1, 2], [2, 4]])).toThrow(/no inverse/);
    expect(M.trace(a)).toBe(5);
    expect(M.multiply(a, M.inverse(a))).toEqual([[1, 0], [0, 1]]);
  });
});

describe("quadratic", () => {
  it("solves real, repeated and complex cases", () => {
    const r = solveQuadratic(1, -3, 2);
    expect(r.kind).toBe("two-real");
    expect(r.roots.map((x) => x.re)).toEqual([1, 2]);
    expect(r.vertex).toEqual({ x: 1.5, y: -0.25 });
    expect(solveQuadratic(1, 2, 1)).toMatchObject({ kind: "one-real", roots: [{ re: -1, im: 0 }] });
    const c = solveQuadratic(1, 2, 5);
    expect(c.kind).toBe("complex");
    expect(formatRoot(c.roots[0])).toBe("-1 + 2i");
    expect(formatRoot(c.roots[1])).toBe("-1 − 2i");
    expect(() => solveQuadratic(0, 1, 1)).toThrow();
  });
  it("stays accurate when b is huge", () => {
    const r = solveQuadratic(1, -1e8, 1);
    expect(r.roots[0].re).toBeCloseTo(1e-8, 12);
  });
});

describe("radix / programmer", () => {
  it("parses and formats across bases", () => {
    expect(R.parseInBase("FF", 16)).toBe(BigInt(255));
    expect(R.parseInBase("1010", 2)).toBe(BigInt(10));
    expect(R.parseInBase("777", 8)).toBe(BigInt(511));
    expect(R.parseInBase("12", 2)).toBeNull();
    expect(R.parseInBase("-5", 10)).toBe(BigInt(-5));
    expect(R.format(BigInt(255), 16, 32)).toBe("FF");
    expect(R.format(BigInt(-1), 16, 8)).toBe("FF");
    expect(R.format(BigInt(-1), 2, 8)).toBe("11111111");
    expect(R.groupBits("1010", 8)).toBe("0000 1010");
  });
  it("wraps to the word size and applies bitwise operations", () => {
    expect(R.wrap(BigInt(200), 8)).toBe(BigInt(-56));
    expect(R.apply("AND", BigInt(12), BigInt(10), 32)).toBe(BigInt(8));
    expect(R.apply("OR", BigInt(12), BigInt(10), 32)).toBe(BigInt(14));
    expect(R.apply("XOR", BigInt(12), BigInt(10), 32)).toBe(BigInt(6));
    expect(R.apply("SHL", BigInt(1), BigInt(4), 32)).toBe(BigInt(16));
    expect(R.apply("SHR", BigInt(16), BigInt(2), 32)).toBe(BigInt(4));
    expect(R.apply("ADD", BigInt(127), BigInt(1), 8)).toBe(BigInt(-128));
    expect(R.not(BigInt(0), 8)).toBe(BigInt(-1));
    expect(() => R.apply("DIV", BigInt(1), BigInt(0), 8)).toThrow();
  });
});

describe("statistics", () => {
  it("describes a data set", () => {
    const s = describeStats([2, 4, 4, 4, 5, 5, 7, 9], true);
    expect(s.mean).toBe(5);
    expect(s.median).toBe(4.5);
    expect(s.modes).toEqual([4]);
    expect(s.stdDev).toBe(2);
    expect(s.variance).toBe(4);
    expect(s.range).toBe(7);
    expect(describeStats([1, 2, 3, 4], false).stdDev).toBeCloseTo(1.290994, 5);
    expect(describeStats([1, 2, 3, 4]).modes).toEqual([]);
    expect(describeStats([1, 2, 3, 4, 100]).outliers).toEqual([100]);
    expect(describeStats([-1, 2]).geometricMean).toBeNull();
    expect(() => describeStats([])).toThrow();
  });
  it("parses messy input", () => {
    expect(parseNumbers("1, 2;3\n 4  abc 5.5")).toEqual([1, 2, 3, 4, 5.5]);
  });
});

describe("number theory", () => {
  it("handles gcd, lcm, primes and factors", () => {
    expect(gcdAll([12, 18, 24])).toBe(6);
    expect(lcmAll([4, 6, 10])).toBe(60);
    expect(isPrime(97)).toBe(true);
    expect(isPrime(91)).toBe(false);
    expect(isPrime(1)).toBe(false);
    expect(primeFactors(360)).toEqual([[2, 3], [3, 2], [5, 1]]);
    expect(factorString(primeFactors(360))).toBe("2^3 × 3^2 × 5");
    expect(primeFactors(97)).toEqual([[97, 1]]);
    expect(divisors(12)).toEqual([1, 2, 3, 4, 6, 12]);
  });
});

import { applyKey } from "@/lib/calc/keys";

describe("on-screen field keys", () => {
  it("builds numbers key by key", () => {
    expect(applyKey("12", "3")).toBe("123");
    expect(applyKey("", ".")).toBe("0.");
    expect(applyKey("1.5", ".")).toBe("1.5");
    expect(applyKey("5", "BACK")).toBe("");
    expect(applyKey("5", "±")).toBe("-5");
    expect(applyKey("-5", "±")).toBe("5");
    expect(applyKey("9", "C")).toBe("");
    expect(applyKey("3", ".", { decimal: false })).toBe("3");
    expect(applyKey("3", "±", { negative: false })).toBe("3");
    expect(applyKey("1", ",", { extra: "," })).toBe("1,");
    expect(applyKey("1,2", ".", { extra: "," })).toBe("1,2.");
    expect(applyKey("1,2.5", ".", { extra: "," })).toBe("1,2.5");
    expect(applyKey("12", "9", { maxLength: 2 })).toBe("12");
  });
});
