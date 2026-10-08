/**
 * A small, safe math-expression engine (no eval): + - * / ^ ! %, parentheses, implicit multiplication,
 * scientific functions, constants, the variable x, and Ans. Unclosed parentheses are closed automatically,
 * like on a handheld calculator.
 */

export class CalcError extends Error {}

export type AngleMode = "deg" | "rad";

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "un"; op: "-" | "+"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "post"; op: "!" | "%"; a: Node }
  | { k: "call"; name: string; args: Node[] };

const FUNCS = new Set(["sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "log", "ln", "log2", "sqrt", "cbrt", "abs", "exp", "floor", "ceil", "round", "sign", "fact", "nroot", "pow", "min", "max", "mod", "npr", "ncr", "rad", "deg", "sec", "csc", "cot"]);
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

export function normalize(input: string): string {
  return input
    .replace(/[×·⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/π/g, "pi")
    .replace(/τ/g, "tau")
    .replace(/φ/g, "phi")
    .replace(/√/g, " sqrt ")
    .replace(/∛/g, " cbrt ")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/,/g, ",");
}

function tokenize(src: string): Tok[] {
  const s = normalize(src);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i += 1;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new CalcError("Invalid number");
      // "2e" followed by letters (like 2exp) shouldn't eat the e: only accept exponent when digits follow, which the regex ensures
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(s.slice(i))!;
      out.push({ t: "id", v: m[0].toLowerCase() });
      i += m[0].length;
    } else if ("+-*/^()!%,".includes(c)) {
      out.push({ t: "op", v: c });
      i += 1;
    } else {
      throw new CalcError(`Unexpected "${c}"`);
    }
  }
  return out;
}

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  parse(): Node {
    if (this.toks.length === 0) throw new CalcError("Empty expression");
    const n = this.expr();
    if (this.p < this.toks.length) throw new CalcError("Unexpected input");
    return n;
  }
  private peek(): Tok | undefined {
    return this.toks[this.p];
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === "op" && t.v === v;
  }
  private expr(): Node {
    let left = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.toks[this.p++] as { v: string }).v;
      left = { k: "bin", op, a: left, b: this.term() };
    }
    return left;
  }
  private startsFactor(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.t === "num" || t.t === "id") return true;
    return t.t === "op" && t.v === "(";
  }
  private term(): Node {
    let left = this.unary();
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = (this.toks[this.p++] as { v: string }).v;
        left = { k: "bin", op, a: left, b: this.unary() };
      } else if (this.startsFactor()) {
        left = { k: "bin", op: "*", a: left, b: this.unary() }; // implicit multiplication: 2pi, 3(4+1), 2sin(x)
      } else return left;
    }
  }
  private unary(): Node {
    if (this.isOp("-") || this.isOp("+")) {
      const op = (this.toks[this.p++] as { v: "-" | "+" }).v;
      return { k: "un", op, a: this.unary() };
    }
    return this.power();
  }
  private power(): Node {
    const base = this.postfix();
    if (this.isOp("^")) {
      this.p += 1;
      return { k: "bin", op: "^", a: base, b: this.unary() };
    }
    return base;
  }
  private postfix(): Node {
    let n = this.primary();
    while (this.isOp("!") || this.isOp("%")) {
      n = { k: "post", op: (this.toks[this.p++] as { v: "!" | "%" }).v, a: n };
    }
    return n;
  }
  private primary(): Node {
    const t = this.toks[this.p++];
    if (!t) throw new CalcError("Unexpected end");
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "op" && t.v === "(") {
      const inner = this.expr();
      if (this.isOp(")")) this.p += 1; // missing ")" is closed automatically
      return inner;
    }
    if (t.t === "id") {
      if (this.isOp("(")) {
        if (!FUNCS.has(t.v)) throw new CalcError(`Unknown function "${t.v}"`);
        this.p += 1;
        const args: Node[] = [];
        if (!this.isOp(")") && this.peek()) {
          args.push(this.expr());
          while (this.isOp(",")) {
            this.p += 1;
            args.push(this.expr());
          }
        }
        if (this.isOp(")")) this.p += 1;
        return { k: "call", name: t.v, args };
      }
      if (t.v in CONSTS || t.v === "x" || t.v === "ans" || t.v === "y") return { k: "var", name: t.v };
      if (FUNCS.has(t.v)) {
        // "sin 30" style: a function name followed by a factor
        const arg = this.unary();
        return { k: "call", name: t.v, args: [arg] };
      }
      throw new CalcError(`Unknown name "${t.v}"`);
    }
    throw new CalcError(`Unexpected "${t.v}"`);
  }
}

export interface EvalContext {
  x?: number;
  ans?: number;
  angle?: AngleMode;
}

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new CalcError("Factorial needs a whole number ≥ 0");
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

const toRad = (v: number, mode: AngleMode) => (mode === "deg" ? (v * Math.PI) / 180 : v);
const fromRad = (v: number, mode: AngleMode) => (mode === "deg" ? (v * 180) / Math.PI : v);

function call(name: string, a: number[], ctx: EvalContext): number {
  const mode = ctx.angle ?? "rad";
  const need = (n: number) => {
    if (a.length < n) throw new CalcError(`${name} needs ${n} value${n > 1 ? "s" : ""}`);
  };
  need(name === "min" || name === "max" ? 1 : ["nroot", "pow", "mod", "npr", "ncr"].includes(name) ? 2 : 1);
  const v = a[0];
  switch (name) {
    case "sin": return Math.sin(toRad(v, mode));
    case "cos": return Math.cos(toRad(v, mode));
    case "tan": return Math.tan(toRad(v, mode));
    case "sec": return 1 / Math.cos(toRad(v, mode));
    case "csc": return 1 / Math.sin(toRad(v, mode));
    case "cot": return 1 / Math.tan(toRad(v, mode));
    case "asin": return fromRad(Math.asin(v), mode);
    case "acos": return fromRad(Math.acos(v), mode);
    case "atan": return fromRad(Math.atan(v), mode);
    case "sinh": return Math.sinh(v);
    case "cosh": return Math.cosh(v);
    case "tanh": return Math.tanh(v);
    case "asinh": return Math.asinh(v);
    case "acosh": return Math.acosh(v);
    case "atanh": return Math.atanh(v);
    case "log": return Math.log10(v);
    case "ln": return Math.log(v);
    case "log2": return Math.log2(v);
    case "sqrt": return Math.sqrt(v);
    case "cbrt": return Math.cbrt(v);
    case "abs": return Math.abs(v);
    case "exp": return Math.exp(v);
    case "floor": return Math.floor(v);
    case "ceil": return Math.ceil(v);
    case "round": return Math.round(v);
    case "sign": return Math.sign(v);
    case "fact": return factorial(v);
    case "rad": return (v * Math.PI) / 180;
    case "deg": return (v * 180) / Math.PI;
    case "nroot": return a[0] < 0 && a[1] % 2 !== 0 ? -Math.pow(-a[0], 1 / a[1]) : Math.pow(a[0], 1 / a[1]);
    case "pow": return Math.pow(a[0], a[1]);
    case "mod": return ((a[0] % a[1]) + a[1]) % a[1];
    case "min": return Math.min(...a);
    case "max": return Math.max(...a);
    case "npr": return factorial(a[0]) / factorial(a[0] - a[1]);
    case "ncr": return Math.round(factorial(a[0]) / (factorial(a[1]) * factorial(a[0] - a[1])));
    default: throw new CalcError(`Unknown function "${name}"`);
  }
}

function evaluate(n: Node, ctx: EvalContext): number {
  switch (n.k) {
    case "num": return n.v;
    case "var":
      if (n.name === "x" || n.name === "y") {
        if (ctx.x === undefined) throw new CalcError("x has no value here");
        return ctx.x;
      }
      if (n.name === "ans") return ctx.ans ?? 0;
      return CONSTS[n.name];
    case "un": return n.op === "-" ? -evaluate(n.a, ctx) : evaluate(n.a, ctx);
    case "post": return n.op === "!" ? factorial(evaluate(n.a, ctx)) : evaluate(n.a, ctx) / 100;
    case "call": return call(n.name, n.args.map((x) => evaluate(x, ctx)), ctx);
    case "bin": {
      const a = evaluate(n.a, ctx);
      const b = evaluate(n.b, ctx);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/":
          if (b === 0) throw new CalcError("Cannot divide by zero");
          return a / b;
        case "^": return a < 0 && !Number.isInteger(b) ? NaN : Math.pow(a, b);
      }
    }
  }
  throw new CalcError("Invalid expression");
}

/** Cleans floating-point noise: 0.1+0.2 → 0.3, sin(180°) → 0. */
export function clean(v: number): number {
  if (!Number.isFinite(v)) return v;
  if (Math.abs(v) < 1e-12) return 0;
  return Number(v.toPrecision(12));
}

export function calculate(input: string, ctx: EvalContext = {}): number {
  const v = evaluate(new Parser(tokenize(input)).parse(), ctx);
  if (Number.isNaN(v)) throw new CalcError("Not a real number");
  return clean(v);
}

/** Parses once, evaluates many times (for graphing). Returns NaN where the function is undefined. */
export function compile(input: string, base: EvalContext = {}): (x: number) => number {
  const ast = new Parser(tokenize(input)).parse();
  return (x) => {
    try {
      const v = evaluate(ast, { ...base, x });
      return Number.isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  };
}

export function formatNumber(v: number, maxDigits = 12): string {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "Error";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e15 || abs < 1e-9) {
    const [m, e] = v.toExponential(maxDigits - 1).split("e");
    return `${m.replace(/\.?0+$/, "")}e${e.replace("+", "")}`;
  }
  const s = Number(v.toPrecision(maxDigits)).toString();
  return s.includes("e") ? v.toString() : s;
}
