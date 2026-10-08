"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { CalcFrame } from "@/components/tools/calc/CalcFrame";
import { Keypad, type KeyDef } from "@/components/tools/calc/Keypad";
import { applyKey } from "@/lib/calc/keys";
import * as M from "@/lib/calc/matrix";

type Which = "A" | "B";
interface Grid { rows: number; cols: number; cells: string[][] }

const resize = (g: Grid, rows: number, cols: number): Grid => ({ rows, cols, cells: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => g.cells[r]?.[c] ?? "")) });
const num = (s: string) => (s === "" || s === "-" || s === "." ? 0 : Number(s));
const toMatrix = (g: Grid): M.Matrix => g.cells.map((r) => r.map(num));
const fmt = (v: number) => String(Number(v.toPrecision(10)));

export default function MatrixCalculator() {
  useTrackTool("matrix-calculator");
  const [A, setA] = React.useState<Grid>(() => ({ rows: 2, cols: 2, cells: [["1", "2"], ["3", "4"]] }));
  const [B, setB] = React.useState<Grid>(() => ({ rows: 2, cols: 2, cells: [["0", "1"], ["1", "0"]] }));
  const [active, setActive] = React.useState<{ m: Which; r: number; c: number }>({ m: "A", r: 0, c: 0 });
  const [scalar, setScalar] = React.useState("2");
  const [out, setOut] = React.useState<{ title: string; matrix?: M.Matrix; value?: number; error?: string } | null>(null);

  const setCell = (m: Which, r: number, c: number, fn: (cur: string) => string) => {
    const set = m === "A" ? setA : setB;
    set((g) => ({ ...g, cells: g.cells.map((row, i) => row.map((cell, j) => (i === r && j === c ? fn(cell) : cell))) }));
  };

  const press = (key: string) => {
    if (key === "NEXT") {
      const g = active.m === "A" ? A : B;
      const next = active.c + 1 < g.cols ? { ...active, c: active.c + 1 } : active.r + 1 < g.rows ? { ...active, r: active.r + 1, c: 0 } : { m: (active.m === "A" ? "B" : "A") as Which, r: 0, c: 0 };
      return setActive(next);
    }
    setCell(active.m, active.r, active.c, (cur) => applyKey(cur, key, { maxLength: 8 }));
  };

  const run = (title: string, fn: () => M.Matrix | number) => {
    try {
      const r = fn();
      setOut(typeof r === "number" ? { title, value: r } : { title, matrix: r });
    } catch (e) {
      setOut({ title, error: e instanceof Error ? e.message : "Something went wrong" });
    }
  };
  const a = () => toMatrix(A);
  const b = () => toMatrix(B);

  const editor = (name: Which, g: Grid) => (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-extrabold">{name}</h3>
        {(["rows", "cols"] as const).map((dim) => (
          <label key={dim} className="flex items-center gap-1 text-xs text-muted-foreground">
            {dim === "rows" ? "Rows" : "Columns"}
            <select value={g[dim]} onChange={(e) => { const n = Number(e.target.value); (name === "A" ? setA : setB)((cur) => resize(cur, dim === "rows" ? n : cur.rows, dim === "cols" ? n : cur.cols)); }} className="h-8 rounded-lg border border-border bg-background px-1.5 text-sm text-foreground">
              {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${g.cols}, minmax(0, 1fr))` }}>
        {g.cells.map((row, r) => row.map((cell, c) => {
          const on = active.m === name && active.r === r && active.c === c;
          return <input key={`${r}-${c}`} value={cell} placeholder="0" onChange={(e) => setCell(name, r, c, () => e.target.value.replace(/[^0-9.-]/g, ""))} onFocus={() => setActive({ m: name, r, c })} inputMode="none" aria-label={`${name} row ${r + 1} column ${c + 1}`} className={cn("h-11 min-w-0 rounded-lg border-2 bg-background text-center font-mono text-base font-semibold outline-none", on ? "border-primary ring-4 ring-primary/15" : "border-border")} />;
        }))}
      </div>
    </Card>
  );

  const rows: KeyDef[][] = [
    [{ label: "7" }, { label: "8" }, { label: "9" }, { label: "⌫", value: "BACK", kind: "act", aria: "Backspace" }],
    [{ label: "4" }, { label: "5" }, { label: "6" }, { label: "C", kind: "act" }],
    [{ label: "1" }, { label: "2" }, { label: "3" }, { label: "±", kind: "fn", aria: "Change sign" }],
    [{ label: "0" }, { label: "." }, { label: "Next →", value: "NEXT", kind: "mod", span: 2 }],
  ];

  const btn = "h-10 text-sm font-bold";
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">{editor("A", A)}{editor("B", B)}</div>
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Button className={btn} onClick={() => run("A + B", () => M.add(a(), b()))}>A + B</Button>
            <Button className={btn} onClick={() => run("A − B", () => M.subtract(a(), b()))}>A − B</Button>
            <Button className={btn} onClick={() => run("A × B", () => M.multiply(a(), b()))}>A × B</Button>
            <Button className={btn} variant="outline" onClick={() => run("Aᵀ", () => M.transpose(a()))}>Aᵀ</Button>
            <Button className={btn} variant="outline" onClick={() => run("det(A)", () => M.determinant(a()))}>det(A)</Button>
            <Button className={btn} variant="outline" onClick={() => run("A⁻¹", () => M.inverse(a()))}>A⁻¹</Button>
            <Button className={btn} variant="outline" onClick={() => run("trace(A)", () => M.trace(a()))}>tr(A)</Button>
            <span className="flex items-center gap-1">
              <input value={scalar} onChange={(e) => setScalar(e.target.value.replace(/[^0-9.-]/g, ""))} aria-label="Scalar" className="h-10 w-16 rounded-lg border border-border bg-background px-2 text-center font-mono" />
              <Button className={btn} variant="outline" onClick={() => run(`${scalar || 0} · A`, () => M.scale(a(), num(scalar)))}>k · A</Button>
            </span>
          </div>
          <div className="min-h-24 rounded-xl border border-border bg-muted/30 p-4" aria-live="polite">
            {!out ? <p className="text-center text-sm text-muted-foreground">Pick an operation to see the result.</p> : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{out.title}</p>
                {out.error && <p role="alert" className="text-sm text-destructive">{out.error}</p>}
                {out.value !== undefined && <p className="font-mono text-3xl font-extrabold">{fmt(out.value)}</p>}
                {out.matrix && (
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${out.matrix[0].length}, minmax(3.5rem, 1fr))` }}>
                    {out.matrix.flat().map((v, i) => <span key={i} className="rounded-lg bg-primary/10 px-2 py-2 text-center font-mono text-base font-bold">{fmt(v)}</span>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
      <CalcFrame className="lg:self-start"><Keypad rows={rows} cols={4} onPress={press} /></CalcFrame>
    </div>
  );
}
