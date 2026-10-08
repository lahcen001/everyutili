"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { CalcFrame } from "@/components/tools/calc/CalcFrame";
import { Keypad, type KeyDef } from "@/components/tools/calc/Keypad";
import { applyKey } from "@/lib/calc/keys";
import { divisors, factorString, gcd, gcdAll, isPrime, lcmAll, primeFactors } from "@/lib/calc/numtheory";

const MAX = 1_000_000_000_000; // keeps factoring instant

export default function NumberTheoryCalculator() {
  useTrackTool("gcd-lcm-calculator");
  const [text, setText] = React.useState("48, 180");
  const press = (key: string) => {
    if (key === "SEP") setText((t) => (t && !/[\s,]$/.test(t) ? t + ", " : t));
    else if (key === "BACK") setText((t) => t.replace(/(, |.)$/, ""));
    else setText((t) => applyKey(t, key, { decimal: false, negative: false, extra: ", ", maxLength: 200 }));
  };

  const parsed = React.useMemo(() => {
    const nums = text.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (nums.length === 0) return { empty: true as const };
    if (nums.some((n) => !Number.isInteger(n) || n < 1)) return { error: "Use whole numbers of 1 or more." };
    if (nums.some((n) => n > MAX)) return { error: "Please use numbers up to 1,000,000,000,000." };
    if (nums.length > 12) return { error: "Please use up to 12 numbers." };
    const euclid: string[] = [];
    if (nums.length === 2) {
      let [a, b] = nums[0] >= nums[1] ? [nums[0], nums[1]] : [nums[1], nums[0]];
      while (b) {
        euclid.push(`${a} = ${Math.floor(a / b)} × ${b} + ${a % b}`);
        [a, b] = [b, a % b];
      }
    }
    return { nums, gcd: gcdAll(nums), lcm: lcmAll(nums), euclid, coprime: gcdAll(nums) === 1 };
  }, [text]);

  const rows: KeyDef[][] = [
    [{ label: "7" }, { label: "8" }, { label: "9" }, { label: "⌫", value: "BACK", kind: "act", aria: "Backspace" }],
    [{ label: "4" }, { label: "5" }, { label: "6" }, { label: "C", kind: "act", aria: "Clear" }],
    [{ label: "1" }, { label: "2" }, { label: "3" }, { label: "Add ,", value: "SEP", kind: "op", aria: "Add separator" }],
    [{ label: "0", span: 4 }],
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
      <div className="space-y-4">
        <Card className="space-y-2 p-4">
          <label htmlFor="nt-input" className="text-sm font-semibold">Numbers (separate with commas)</label>
          <input id="nt-input" value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9,;\s]/g, ""))} inputMode="none" className="h-14 w-full rounded-xl border-2 border-primary/40 bg-background px-4 font-mono text-2xl font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
        </Card>
        {"empty" in parsed ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Enter two or more numbers to find the GCD and LCM, or one number to factor it.</Card>
        ) : "error" in parsed ? (
          <Card className="p-6 text-center text-sm text-destructive" role="alert">{parsed.error}</Card>
        ) : (
          <>
            {parsed.nums.length > 1 && (
              <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
                <div className="rounded-2xl bg-primary/10 p-4 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GCD (greatest common divisor)</p><p className="font-mono text-4xl font-extrabold">{parsed.gcd.toLocaleString()}</p>{parsed.coprime && <p className="text-xs text-muted-foreground">These numbers are coprime.</p>}</div>
                <div className="rounded-2xl bg-fuchsia-500/10 p-4 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LCM (least common multiple)</p><p className="font-mono text-4xl font-extrabold">{parsed.lcm.toLocaleString()}</p></div>
              </div>
            )}
            {parsed.euclid.length > 0 && (
              <Card className="space-y-1 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Euclid&apos;s algorithm</p>
                {parsed.euclid.map((s, i) => <p key={i} className="font-mono text-sm">{s}</p>)}
                <p className="font-mono text-sm font-bold">GCD = {gcd(parsed.nums[0], parsed.nums[1])}</p>
              </Card>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {parsed.nums.map((n, i) => {
                const f = primeFactors(n);
                const d = n <= 1e7 ? divisors(n) : null;
                return (
                  <Card key={i} className="space-y-1.5 p-4">
                    <div className="flex items-center justify-between"><span className="font-mono text-2xl font-extrabold">{n.toLocaleString()}</span><span className={isPrime(n) ? "rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600" : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground"}>{n === 1 ? "neither" : isPrime(n) ? "prime" : "composite"}</span></div>
                    {n > 1 && <p className="font-mono text-sm"><span className="text-muted-foreground">Prime factors: </span>{factorString(f)}</p>}
                    {d && <p className="text-xs text-muted-foreground">{d.length} divisor{d.length === 1 ? "" : "s"}: {d.length <= 40 ? d.join(", ") : `${d.slice(0, 40).join(", ")}…`}</p>}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
      <CalcFrame className="lg:self-start"><Keypad rows={rows} cols={4} onPress={press} /></CalcFrame>
    </div>
  );
}
