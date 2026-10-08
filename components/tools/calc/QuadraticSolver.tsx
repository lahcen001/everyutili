"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { CalcFrame } from "@/components/tools/calc/CalcFrame";
import { FitText } from "@/components/tools/calc/FitText";
import { Keypad, type KeyDef } from "@/components/tools/calc/Keypad";
import { applyKey } from "@/lib/calc/keys";
import { formatRoot, solveQuadratic } from "@/lib/calc/quadratic";

type Field = "a" | "b" | "c";

const term = (v: number, sym: string, first: boolean) => {
  if (v === 0) return "";
  const sign = v < 0 ? "−" : first ? "" : "+";
  const abs = Math.abs(v);
  const num = abs === 1 && sym ? "" : String(abs);
  return `${first ? sign : ` ${sign} `}${num}${sym}`;
};

export default function QuadraticSolver() {
  useTrackTool("quadratic-equation-solver");
  const [v, setV] = React.useState<Record<Field, string>>({ a: "1", b: "-3", c: "2" });
  const [active, setActive] = React.useState<Field>("a");

  const press = (key: string) => {
    if (key === "NEXT") return setActive(active === "a" ? "b" : active === "b" ? "c" : "a");
    setV((cur) => ({ ...cur, [active]: applyKey(cur[active], key, { maxLength: 12 }) }));
  };

  const result = React.useMemo(() => {
    const [a, b, c] = [v.a, v.b, v.c].map((s) => (s === "" || s === "-" || s === "." ? NaN : Number(s)));
    if ([a, b, c].some(Number.isNaN)) return { empty: true as const };
    try {
      const r = solveQuadratic(a, b, c);
      const eq = `${term(a, "x²", true)}${term(b, "x", !term(a, "x²", true))}${term(c, "", !term(a, "x²", true) && !term(b, "x", true))} = 0`;
      return { empty: false as const, a, b, c, r, eq };
    } catch (e) {
      return { empty: false as const, error: e instanceof Error ? e.message : "Check your numbers" };
    }
  }, [v]);

  const rows: KeyDef[][] = [
    [{ label: "7" }, { label: "8" }, { label: "9" }],
    [{ label: "4" }, { label: "5" }, { label: "6" }],
    [{ label: "1" }, { label: "2" }, { label: "3" }],
    [{ label: "0" }, { label: ".", kind: "num" }, { label: "±", kind: "fn", aria: "Change sign" }],
    [{ label: "C", kind: "act" }, { label: "⌫", value: "BACK", kind: "act", aria: "Backspace" }, { label: "Next →", value: "NEXT", kind: "mod" }],
  ];

  const input = (id: Field, sym: string) => (
    <label className="flex items-center gap-1.5">
      <input value={v[id]} onChange={(e) => setV((c) => ({ ...c, [id]: e.target.value.replace(/[^0-9.-]/g, "") }))} onFocus={() => setActive(id)} inputMode="none" aria-label={`Coefficient ${id}`} className={cn("h-14 w-24 rounded-xl border-2 bg-background text-center font-mono text-2xl font-bold outline-none", active === id ? "border-primary ring-4 ring-primary/15" : "border-border")} />
      <span className="text-xl font-semibold">{sym}</span>
    </label>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="space-y-4">
        <Card className="space-y-3 p-5">
          <p className="text-xs text-muted-foreground">Solve ax² + bx + c = 0. Tap a box and use the keys.</p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xl">
            {input("a", "x² +")}
            {input("b", "x +")}
            {input("c", "= 0")}
          </div>
        </Card>
        <Card className="space-y-4 p-5" aria-live="polite">
          {result.empty ? (
            <p className="text-center text-sm text-muted-foreground">Enter a, b and c to solve.</p>
          ) : "error" in result ? (
            <p role="alert" className="text-center text-sm text-destructive">{result.error}</p>
          ) : (
            <>
              <p className="text-center font-mono text-lg font-semibold">{result.eq}</p>
              <div className={cn("grid gap-3", result.r.roots.length > 1 ? "sm:grid-cols-2" : "")}>
                {result.r.roots.map((root, i) => (
                  <div key={i} className="min-w-0 rounded-xl bg-primary/10 p-4 text-center">
                    <p className="text-xs text-muted-foreground">{result.r.roots.length > 1 ? `x${i === 0 ? "₁" : "₂"}` : "x"}</p>
                    <FitText max={28} className="font-mono font-semibold">{formatRoot(root)}</FitText>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {result.r.kind === "two-real" ? "Two different real solutions" : result.r.kind === "one-real" ? "One repeated real solution" : "Two complex solutions (no real roots)"}
              </p>
              <div className="rounded-xl border border-border p-3 font-mono text-sm leading-relaxed">
                <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground">Steps</p>
                <p>Δ = b² − 4ac = ({result.b})² − 4·({result.a})·({result.c}) = <b>{result.r.discriminant}</b></p>
                <p>x = (−b ± √Δ) / 2a = ({-result.b} ± √{result.r.discriminant}) / {2 * result.a}</p>
                <p>Vertex: ({result.r.vertex.x}, {result.r.vertex.y}) · Axis: x = {result.r.axis}</p>
                {result.r.kind === "two-real" && <p>Factored: {result.a === 1 ? "" : `${result.a}`}(x {result.r.roots[0].re <= 0 ? "+" : "−"} {Math.abs(result.r.roots[0].re)})(x {result.r.roots[1].re <= 0 ? "+" : "−"} {Math.abs(result.r.roots[1].re)})</p>}
              </div>
            </>
          )}
        </Card>
      </div>
      <CalcFrame className="lg:self-start"><Keypad rows={rows} cols={3} onPress={press} /></CalcFrame>
    </div>
  );
}
