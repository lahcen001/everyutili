"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { CalcFrame } from "@/components/tools/calc/CalcFrame";
import { FitText } from "@/components/tools/calc/FitText";
import { Keypad, type KeyDef } from "@/components/tools/calc/Keypad";
import { applyKey } from "@/lib/calc/keys";
import * as F from "@/lib/calc/fraction";

type Op = "+" | "−" | "×" | "÷";
type Field = "aw" | "an" | "ad" | "bw" | "bn" | "bd";
const ORDER: Field[] = ["aw", "an", "ad", "bw", "bn", "bd"];

function toFrac(w: string, n: string, d: string): F.Frac | null {
  if (w === "" && n === "" && d === "") return null;
  const num = n === "" ? 0 : Number(n);
  const den = d === "" ? 1 : Number(d);
  const whole = w === "" ? 0 : Number(w);
  const neg = w.startsWith("-") || n.startsWith("-");
  if (den === 0) throw new Error("The denominator can't be zero");
  return F.mixed(Math.abs(whole), Math.abs(num), Math.abs(den), neg);
}

export default function FractionCalculator() {
  useTrackTool("fraction-calculator");
  const [v, setV] = React.useState<Record<Field, string>>({ aw: "", an: "1", ad: "2", bw: "", bn: "1", bd: "3" });
  const [active, setActive] = React.useState<Field>("an");
  const [op, setOp] = React.useState<Op>("+");

  const press = (key: string) => {
    if (["+", "−", "×", "÷"].includes(key)) return setOp(key as Op);
    if (key === "NEXT") return setActive(ORDER[(ORDER.indexOf(active) + 1) % ORDER.length]);
    const isDen = active.endsWith("d");
    setV((cur) => ({ ...cur, [active]: applyKey(cur[active], key, { decimal: false, negative: !isDen, maxLength: 9 }) }));
  };

  const calc = React.useMemo(() => {
    try {
      const a = toFrac(v.aw, v.an, v.ad);
      const b = toFrac(v.bw, v.bn, v.bd);
      if (!a || !b) return { empty: true as const };
      const r = op === "+" ? F.add(a, b) : op === "−" ? F.sub(a, b) : op === "×" ? F.mul(a, b) : F.div(a, b);
      const common = a.d * b.d;
      const steps =
        op === "+" || op === "−"
          ? [`${F.toString(a)} ${op} ${F.toString(b)}`, `= ${a.n * b.d}/${common} ${op} ${b.n * a.d}/${common}`, `= ${op === "+" ? a.n * b.d + b.n * a.d : a.n * b.d - b.n * a.d}/${common}`, `= ${F.toString(r)}`]
          : op === "×"
            ? [`${F.toString(a)} × ${F.toString(b)}`, `= ${a.n * b.n}/${a.d * b.d}`, `= ${F.toString(r)}`]
            : [`${F.toString(a)} ÷ ${F.toString(b)}`, `= ${F.toString(a)} × ${b.d}/${b.n}`, `= ${a.n * b.d}/${a.d * b.n}`, `= ${F.toString(r)}`];
      return { empty: false as const, a, b, r, steps: steps.filter((s, i, arr) => s !== arr[i - 1]) };
    } catch (e) {
      return { empty: false as const, error: e instanceof Error ? e.message : "Check your numbers" };
    }
  }, [v, op]);

  const field = (id: Field, label: string, w: string) => (
    <input
      value={v[id]}
      onChange={(e) => setV((c) => ({ ...c, [id]: e.target.value.replace(/[^0-9-]/g, "") }))}
      onFocus={() => setActive(id)}
      inputMode="none"
      aria-label={label}
      className={cn("h-12 rounded-xl border-2 bg-background text-center font-mono text-xl font-bold outline-none", w, active === id ? "border-primary ring-4 ring-primary/15" : "border-border")}
    />
  );
  const frac = (p: "a" | "b", name: string) => (
    <div className="flex items-center gap-2" role="group" aria-label={name}>
      {field(`${p}w` as Field, `${name} whole number`, "w-16")}
      <div className="flex flex-col items-center gap-1">
        {field(`${p}n` as Field, `${name} numerator`, "w-20")}
        <span className="h-0.5 w-20 rounded bg-foreground/70" />
        {field(`${p}d` as Field, `${name} denominator`, "w-20")}
      </div>
    </div>
  );

  const rows: KeyDef[][] = [
    ["7", "8", "9", "÷"].map((l) => ({ label: l, kind: l === "÷" ? "op" : "num", active: l === op }) as KeyDef),
    ["4", "5", "6", "×"].map((l) => ({ label: l, kind: l === "×" ? "op" : "num", active: l === op }) as KeyDef),
    ["1", "2", "3", "−"].map((l) => ({ label: l, kind: l === "−" ? "op" : "num", active: l === op }) as KeyDef),
    [{ label: "0" }, { label: "±", aria: "Change sign", kind: "fn" }, { label: "⌫", value: "BACK", kind: "act", aria: "Backspace" }, { label: "+", kind: "op", active: op === "+" }],
    [{ label: "C", kind: "act", aria: "Clear field" }, { label: "Next field →", value: "NEXT", kind: "mod", span: 3 }],
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-4">
        <Card className="space-y-5 p-5">
          <p className="text-xs text-muted-foreground">Tap a box, then use the keys. Leave the whole-number box empty for a plain fraction.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {frac("a", "First fraction")}
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">{op}</span>
            {frac("b", "Second fraction")}
          </div>
        </Card>
        <Card className="space-y-3 p-5" aria-live="polite">
          {calc.empty ? (
            <p className="text-center text-sm text-muted-foreground">Enter two fractions to see the answer.</p>
          ) : "error" in calc ? (
            <p role="alert" className="text-center text-sm text-destructive">{calc.error}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 rounded-xl bg-primary/10 p-3 text-center"><p className="text-xs text-muted-foreground">Fraction</p><FitText max={28} className="font-mono font-semibold">{F.toString(calc.r)}</FitText></div>
                <div className="min-w-0 rounded-xl bg-muted/60 p-3 text-center"><p className="text-xs text-muted-foreground">Mixed number</p><FitText max={28} className="font-mono font-semibold">{F.toMixedString(calc.r)}</FitText></div>
                <div className="min-w-0 rounded-xl bg-muted/60 p-3 text-center"><p className="text-xs text-muted-foreground">Decimal</p><FitText max={28} className="font-mono font-semibold">{String(Number(F.toDecimal(calc.r).toPrecision(10)))}</FitText></div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Steps</p>
                {calc.steps.map((s, i) => <p key={i} className="font-mono text-sm">{s}</p>)}
              </div>
            </>
          )}
        </Card>
      </div>
      <CalcFrame className="lg:self-start"><Keypad rows={rows} cols={4} onPress={press} /></CalcFrame>
    </div>
  );
}
