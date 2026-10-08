"use client";

import * as React from "react";
import { Check, Copy, History, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { CalcFrame, CalcScreen } from "@/components/tools/calc/CalcFrame";
import { Keypad, type KeyDef } from "@/components/tools/calc/Keypad";
import { useCaretInput } from "@/components/tools/calc/useCaretInput";
import { useFitFont } from "@/components/tools/calc/useFitFont";
import { CalcError, calculate, formatNumber, type AngleMode } from "@/lib/calc/expr";

interface Saved {
  angle: AngleMode;
  memory: number;
  history: { expr: string; result: string }[];
}

export default function ScientificCalculator() {
  useTrackTool("scientific-calculator");
  const [saved, setSaved] = usePersisted<Saved>("everyutili_scicalc", { angle: "deg", memory: 0, history: [] });
  const [expr, setExpr] = React.useState("");
  const [second, setSecond] = React.useState(false);
  const [done, setDone] = React.useState(false); // the display currently shows a finished answer
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const { ref, insert, backspace } = useCaretInput(expr, setExpr);
  const fitRef = React.useRef<HTMLInputElement | null>(null);
  useFitFont(fitRef, expr, 44, 18);
  const ans = saved.history[0] ? Number(saved.history[0].result.replace("−", "-")) : 0;

  const preview = React.useMemo(() => {
    if (!expr.trim()) return null;
    try {
      return formatNumber(calculate(expr, { angle: saved.angle, ans }));
    } catch {
      return null;
    }
  }, [expr, saved.angle, ans]);

  const equals = () => {
    if (!expr.trim()) return;
    try {
      const result = calculate(expr, { angle: saved.angle, ans });
      const text = formatNumber(result);
      setSaved((s) => ({ ...s, history: [{ expr, result: text }, ...s.history].slice(0, 30) }));
      setExpr(text);
      setDone(true);
      setError(null);
    } catch (e) {
      setError(e instanceof CalcError ? e.message : "Check the expression");
    }
  };

  const press = (value: string) => {
    setError(null);
    const isOperator = /^[+\-*/^%!]$|^\^/.test(value) || value === "×" || value === "÷" || value === "−";
    if (done) {
      setDone(false);
      if (!isOperator) setExpr("");
    }
    switch (value) {
      case "=": return equals();
      case "AC": setExpr(""); setDone(false); return;
      case "BACK": return backspace();
      case "2ND": return setSecond((s) => !s);
      case "ANGLE": return setSaved((s) => ({ ...s, angle: s.angle === "deg" ? "rad" : "deg" }));
      case "MC": return setSaved((s) => ({ ...s, memory: 0 }));
      case "MR": return insert(formatNumber(saved.memory));
      case "M+":
      case "M-": {
        try {
          const v = calculate(expr || "0", { angle: saved.angle, ans });
          setSaved((s) => ({ ...s, memory: s.memory + (value === "M+" ? v : -v) }));
        } catch {
          setError("Nothing to store");
        }
        return;
      }
      default:
        insert(value);
        if (second && /^(a?sin|a?cos|a?tan|exp|10\^|cbrt|\^3|nroot|ncr)/.test(value)) setSecond(false);
    }
  };

  const k = (label: React.ReactNode, value: string, kind: KeyDef["kind"] = "fn", extra: Partial<KeyDef> = {}): KeyDef => ({ label, value, kind, ...extra });
  const rows: KeyDef[][] = [
    [k("MC", "MC", "mod"), k("MR", "MR", "mod"), k("M+", "M+", "mod"), k("M−", "M-", "mod"), k("Ans", "ans", "mod")],
    [k("2nd", "2ND", "mod", { active: second }), k("π", "pi"), k("e", "e"), k("AC", "AC", "act"), k("⌫", "BACK", "act", { aria: "Backspace" })],
    second
      ? [k("sin⁻¹", "asin(", "fn", { sub: "sin" }), k("cos⁻¹", "acos(", "fn", { sub: "cos" }), k("tan⁻¹", "atan(", "fn", { sub: "tan" }), k("(", "(", "op"), k(")", ")", "op")]
      : [k("sin", "sin(", "fn", { sub: "sin⁻¹" }), k("cos", "cos(", "fn", { sub: "cos⁻¹" }), k("tan", "tan(", "fn", { sub: "tan⁻¹" }), k("(", "(", "op"), k(")", ")", "op")],
    second
      ? [k("eˣ", "exp(", "fn", { sub: "ln" }), k("10ˣ", "10^(", "fn", { sub: "log" }), k("∛", "cbrt(", "fn", { sub: "√" }), k("x³", "^3", "fn", { sub: "x²" }), k("ʸ√x", "nroot(", "fn", { sub: "xʸ" })]
      : [k("ln", "ln(", "fn", { sub: "eˣ" }), k("log", "log(", "fn", { sub: "10ˣ" }), k("√", "sqrt(", "fn", { sub: "∛" }), k("x²", "^2", "fn", { sub: "x³" }), k("xʸ", "^", "fn", { sub: "ʸ√x" })],
    [k("7", "7", "num"), k("8", "8", "num"), k("9", "9", "num"), k("÷", "/", "op"), second ? k("nCr", "ncr(", "fn", { sub: "n!" }) : k("n!", "!", "fn", { sub: "nCr" })],
    [k("4", "4", "num"), k("5", "5", "num"), k("6", "6", "num"), k("×", "*", "op"), k("1/x", "^-1", "fn")],
    [k("1", "1", "num"), k("2", "2", "num"), k("3", "3", "num"), k("−", "-", "op"), k("|x|", "abs(", "fn")],
    [k("0", "0", "num"), k(".", ".", "num"), k("EXP", "*10^(", "fn"), k("+", "+", "op"), k("=", "=", "eq")],
  ];

  // physical keyboard: Enter calculates, Escape clears (typing itself goes straight into the field)
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      equals();
    } else if (e.key === "Escape") {
      setExpr("");
      setDone(false);
    }
  };

  const shown = error ?? (preview !== null && !done ? preview : null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(done ? expr : (preview ?? expr));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:justify-center">
      <CalcFrame>
        <CalcScreen className="mb-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
            <button onClick={() => press("ANGLE")} className="rounded-md border border-border px-2 py-0.5 uppercase tracking-wide text-muted-foreground transition hover:bg-background hover:text-foreground" aria-label="Switch degrees or radians">{saved.angle}</button>
            {second && <span className="rounded-md bg-primary px-2 py-0.5 text-primary-foreground">2nd</span>}
            {saved.memory !== 0 && <span className="rounded-md border border-border px-2 py-0.5 text-muted-foreground">M = {formatNumber(saved.memory)}</span>}
            <button onClick={() => void copy()} className="ms-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground" aria-label="Copy result">
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <input
            ref={(el) => { ref.current = el; fitRef.current = el; }}
            value={expr}
            onChange={(e) => { setExpr(e.target.value); setDone(false); setError(null); }}
            onKeyDown={onKey}
            inputMode="none"
            autoComplete="off"
            spellCheck={false}
            aria-label="Expression"
            placeholder="0"
            className="block w-full min-w-0 bg-transparent p-0 text-right font-mono font-medium tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
          />
          <p className={cn("mt-1 h-6 truncate font-mono text-base", error ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
            {error ?? (shown !== null ? `= ${shown}` : "")}
          </p>
        </CalcScreen>
        <Keypad rows={rows} cols={5} onPress={press} />
        <p className="mt-3 text-center text-[11px] text-muted-foreground">Type on your keyboard too · Enter = equals · Esc = clear</p>
      </CalcFrame>

      <Card className="space-y-2 p-4 lg:max-h-[40rem] lg:overflow-auto">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-primary" /> History</h3>
          {saved.history.length > 0 && (
            <button onClick={() => setSaved((s) => ({ ...s, history: [] }))} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
        {saved.history.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Your calculations will appear here and are saved on this device.</p>}
        <ul className="space-y-1">
          {saved.history.map((h, i) => (
            <li key={i}>
              <button onClick={() => { setExpr(h.result); setDone(true); }} className="w-full rounded-xl px-3 py-2 text-right transition-colors hover:bg-primary/10">
                <span className="block truncate font-mono text-xs text-muted-foreground">{h.expr}</span>
                <span className="block truncate font-mono text-xl font-semibold">{h.result}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
