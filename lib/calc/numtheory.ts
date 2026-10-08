const big = (n: number) => BigInt(n);

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

export const gcdAll = (list: number[]): number => list.reduce((g, v) => gcd(g, v), 0);
export const lcmAll = (list: number[]): number => list.reduce((l, v) => lcm(l, v), 1);

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false;
  return true;
}

/** Prime factorisation as [prime, exponent] pairs. */
export function primeFactors(n: number): [number, number][] {
  if (!Number.isInteger(n) || n < 2) return [];
  const out: [number, number][] = [];
  let m = n;
  for (let p = 2; p * p <= m; p += p === 2 ? 1 : 2) {
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e += 1;
    }
    if (e) out.push([p, e]);
  }
  if (m > 1) out.push([m, 1]);
  return out;
}

export function divisors(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      out.push(i);
      if (i !== n / i) out.push(n / i);
    }
  }
  return out.sort((a, b) => a - b);
}

export const factorString = (f: [number, number][]): string => f.map(([p, e]) => (e > 1 ? `${p}^${e}` : String(p))).join(" × ");
export { big };
