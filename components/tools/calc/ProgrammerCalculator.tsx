"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { CalcFrame, CalcScreen } from "@/components/tools/calc/CalcFrame";
import { Keypad, type KeyDef } from "@/components/tools/calc/Keypad";
import * as R from "@/lib/calc/radix";

const BASES: { id: R.Base; label: string }[] = [
  { id: 16, label: "HEX" },
  { id: 10, label: "DEC" },
  { id: 8, label: "OCT" },
  { id: 2, label: "BIN" },
];
const WIDTHS: R.Width[] = [8, 16, 32, 64];
const BINARY_OPS: { label: string; op: R.BitOp }[] = [
  { label: "AND", op: "AND" },
  { label: "OR", op: "OR" },
  { label: "XOR", op: "XOR" },
  { label: "NAND", op: "NAND" },
  { label: "NOR", op: "NOR" },
  { label: "<<", op: "SHL" },
  { label: ">>", op: "SHR" },
  { label: "+", op: "ADD" },
  { label: "−", op: "SUB" },
  { label: "×", op: "MUL" },
  { label: "÷", op: "DIV" },
  { label: "MOD", op: "MOD" },
];

export default function ProgrammerCalculator() {
  useTrackTool("programmer-calculator");
  const [base, setBase] = React.useState<R.Base>(10);
  const [width, setWidth] = React.useState<R.Width>(32);
  const [text, setText] = React.useState("");
  const [value, setValue] = React.useState<bigint>(BigInt(0));
  const [pending, setPending] = React.useState<{ op: R.BitOp; left: bigint; label: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fresh, setFresh] = React.useState(true); // next digit replaces the display

  const show = (v: bigint) => R.format(v, base, width);

  const setFrom = (v: bigint) => {
    const w = R.wrap(v, width);
    setValue(w);
    setText(R.format(w, base, width));
    setFresh(true);
  };

  const press = (key: string) => {
    setError(null);
    const bin = BINARY_OPS.find((o) => o.label === key);
    try {
      if (key === "C") { setText(""); setValue(BigInt(0)); setPending(null); setFresh(true); return; }
      if (key === "BACK") {
        const next = text.slice(0, -1);
        setText(next);
        setValue(R.parseInBase(next, base) ?? BigInt(0));
        return;
      }
      if (key === "NOT") return setFrom(R.not(value, width));
      if (key === "±") return setFrom(-value);
      if (bin) {
        setPending({ op: bin.op, left: value, label: bin.label });
        setFresh(true);
        return;
      }
      if (key === "=") {
        if (pending) {
          const res = R.apply(pending.op, pending.left, value, width);
          setPending(null);
          setFrom(res);
        }
        return;
      }
      const d = fresh ? key : text + key;
      const parsed = R.parseInBase(d, base);
      if (parsed === null) return;
      const wrapped = R.wrap(parsed, width);
      setText(wrapped === parsed ? d : R.format(wrapped, base, width));
      setValue(wrapped);
      setFresh(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  const changeBase = (b: R.Base) => {
    setBase(b);
    setText(R.format(value, b, width));
    setFresh(true);
  };
  const changeWidth = (w: R.Width) => {
    setWidth(w);
    const wrapped = R.wrap(value, w);
    setValue(wrapped);
    setText(R.format(wrapped, base, w));
    setFresh(true);
  };
  const toggleBit = (i: number) => setFrom(R.wrap(value ^ (BigInt(1) << BigInt(i)), width));

  const digit = (c: string): KeyDef => ({ label: c, kind: "num", disabled: parseInt(c, 16) >= base });
  const rows: KeyDef[][] = [
    [digit("D"), digit("E"), digit("F"), { label: "C", kind: "act" }, { label: "⌫", value: "BACK", kind: "act", aria: "Backspace" }],
    [digit("A"), digit("B"), digit("C"), { label: "AND", kind: "op", active: pending?.label === "AND" }, { label: "OR", kind: "op", active: pending?.label === "OR" }],
    [digit("7"), digit("8"), digit("9"), { label: "XOR", kind: "op", active: pending?.label === "XOR" }, { label: "NOT", kind: "op" }],
    [digit("4"), digit("5"), digit("6"), { label: "<<", kind: "op", active: pending?.label === "<<" }, { label: ">>", kind: "op", active: pending?.label === ">>" }],
    [digit("1"), digit("2"), digit("3"), { label: "+", kind: "op", active: pending?.label === "+" }, { label: "−", kind: "op", active: pending?.label === "−" }],
    [digit("0"), { label: "±", kind: "fn", aria: "Change sign" }, { label: "MOD", kind: "mod", active: pending?.label === "MOD" }, { label: "×", kind: "op", active: pending?.label === "×" }, { label: "÷", kind: "op", active: pending?.label === "÷" }],
    [{ label: "NAND", kind: "mod", active: pending?.label === "NAND" }, { label: "NOR", kind: "mod", active: pending?.label === "NOR" }, { label: "=", kind: "eq", span: 3 }],
  ];

  const bits = R.toUnsigned(value, width).toString(2).padStart(width, "0");
  const lines = Array.from({ length: width / 8 }, (_, i) => bits.slice(i * 8, i * 8 + 8));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Number base">
              {BASES.map((b) => (
                <button key={b.id} role="tab" aria-selected={base === b.id} onClick={() => changeBase(b.id)} className={cn("rounded-full px-3 py-1 text-sm font-bold", base === b.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{b.label}</button>
              ))}
            </div>
            <div className="ms-auto flex rounded-full bg-muted p-1" role="tablist" aria-label="Word size">
              {WIDTHS.map((w) => (
                <button key={w} role="tab" aria-selected={width === w} onClick={() => changeWidth(w)} className={cn("rounded-full px-2.5 py-1 text-xs font-bold", width === w ? "bg-background shadow-sm" : "text-muted-foreground")}>{w}-bit</button>
              ))}
            </div>
          </div>
          <CalcScreen>
            <p className="h-5 font-mono text-sm text-slate-400">{pending ? `${show(pending.left)} ${pending.label}` : ""}</p>
            <p className="min-h-10 break-all font-mono text-3xl font-semibold" aria-live="polite">{text || "0"}</p>
            {error && <p role="alert" className="font-mono text-sm text-rose-400">{error}</p>}
          </CalcScreen>
          <div className="grid gap-2 sm:grid-cols-2">
            {BASES.map((b) => (
              <button key={b.id} onClick={() => changeBase(b.id)} className="flex items-baseline justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left hover:bg-muted">
                <span className="text-xs font-bold text-muted-foreground">{b.label}</span>
                <span className="min-w-0 break-all font-mono text-sm font-semibold">{R.format(value, b.id, width)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="space-y-2 p-4">
          <h3 className="text-sm font-semibold">Bits <span className="font-normal text-muted-foreground">— tap a bit to flip it</span></h3>
          <div className="space-y-1">
            {lines.map((byte, li) => (
              <div key={li} className="flex gap-1">
                {byte.split("").map((bit, bi) => {
                  const idx = width - 1 - (li * 8 + bi);
                  return (
                    <button key={bi} onClick={() => toggleBit(idx)} aria-label={`Bit ${idx} is ${bit}`} aria-pressed={bit === "1"} className={cn("flex h-9 flex-1 flex-col items-center justify-center rounded-md font-mono text-sm font-bold transition-colors", bit === "1" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                      {bit}
                      <span className="text-[8px] font-normal opacity-60">{idx}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      </div>
      <CalcFrame className="lg:self-start"><Keypad rows={rows} cols={5} onPress={press} /></CalcFrame>
    </div>
  );
}
