"use client";

import * as React from "react";
import { Eye, EyeOff, RefreshCw, ShieldCheck } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { DEFAULT_PASSPHRASE, DEFAULT_PASSWORD, crackTime, generatePassphrase, generatePassword, passphraseEntropy, passwordEntropy, poolSize, strengthFor, type PassphraseOptions, type PasswordOptions } from "@/lib/password";
import { cn } from "@/lib/utils";

type Mode = "password" | "passphrase";

const LEVEL_COLOR = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];

function Check({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex items-center gap-2 text-sm", disabled && "opacity-50")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
      {label}
    </label>
  );
}

export default function PasswordGenerator() {
  useTrackTool("password-generator");
  const [mode, setMode] = React.useState<Mode>("password");
  const [pw, setPw] = React.useState<PasswordOptions>(DEFAULT_PASSWORD);
  const [pp, setPp] = React.useState<PassphraseOptions>(DEFAULT_PASSPHRASE);
  const [count, setCount] = React.useState(1);
  const [reveal, setReveal] = React.useState(true);
  const [results, setResults] = React.useState<string[]>(() => [generatePassword(DEFAULT_PASSWORD)]);

  const make = (m: Mode, p: PasswordOptions, q: PassphraseOptions, n: number) => Array.from({ length: n }, () => (m === "password" ? generatePassword(p) : generatePassphrase(q)));
  const updatePw = (patch: Partial<PasswordOptions>) => {
    const next = { ...pw, ...patch };
    setPw(next);
    setResults(make(mode, next, pp, count));
  };
  const updatePp = (patch: Partial<PassphraseOptions>) => {
    const next = { ...pp, ...patch };
    setPp(next);
    setResults(make(mode, pw, next, count));
  };
  const regenerate = () => setResults(make(mode, pw, pp, count));
  const switchMode = (m: Mode) => {
    setMode(m);
    setResults(make(m, pw, pp, count));
  };
  const changeCount = (n: number) => {
    const c = Math.min(20, Math.max(1, n || 1));
    setCount(c);
    setResults(make(mode, pw, pp, c));
  };

  const size = poolSize(pw);
  const bits = mode === "password" ? passwordEntropy(size, Math.max(pw.length, 1)) : passphraseEntropy(pp);
  const strength = strengthFor(bits);
  const noClass = mode === "password" && size === 0;
  const allText = results.join("\n");

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Type">
            {(["password", "passphrase"] as const).map((m) => (
              <button key={m} onClick={() => switchMode(m)} aria-pressed={mode === m} className={cn("px-4 py-1.5 text-sm font-medium capitalize transition-colors", mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {m}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            How many
            <input type="number" min={1} max={20} value={count} onChange={(e) => changeCount(Number(e.target.value))} className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm" />
          </label>
        </div>

        {mode === "password" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="pw-length" className="text-sm font-medium">
                Length
              </label>
              <input id="pw-length" type="range" min={4} max={128} value={pw.length} onChange={(e) => updatePw({ length: Number(e.target.value) })} className="min-w-40 flex-1 accent-primary" />
              <input type="number" min={4} max={128} value={pw.length} aria-label="Length" onChange={(e) => updatePw({ length: Math.min(128, Math.max(4, Number(e.target.value) || 4)) })} className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm tabular-nums" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Check label="Lowercase (a–z)" checked={pw.lower} onChange={(v) => updatePw({ lower: v })} />
              <Check label="Uppercase (A–Z)" checked={pw.upper} onChange={(v) => updatePw({ upper: v })} />
              <Check label="Numbers (0–9)" checked={pw.digits} onChange={(v) => updatePw({ digits: v })} />
              <Check label="Symbols" checked={pw.symbols} onChange={(v) => updatePw({ symbols: v })} />
              <Check label="Avoid look-alikes (0 O 1 l I)" checked={pw.excludeAmbiguous} onChange={(v) => updatePw({ excludeAmbiguous: v })} />
            </div>
            {pw.symbols && (
              <label className="flex items-center gap-2 text-sm">
                <span className="shrink-0 text-muted-foreground">Allowed symbols</span>
                <input value={pw.customSymbols} onChange={(e) => updatePw({ customSymbols: e.target.value })} placeholder="default: !@#$%^&*()-_=+[]{};:,.<>?/~" spellCheck={false} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs" />
              </label>
            )}
            {noClass && <p role="alert" className="text-sm text-destructive">Select at least one kind of character.</p>}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="pp-words" className="text-sm font-medium">
                Words
              </label>
              <input id="pp-words" type="range" min={3} max={12} value={pp.words} onChange={(e) => updatePp({ words: Number(e.target.value) })} className="min-w-40 flex-1 accent-primary" />
              <span className="w-8 text-right text-sm tabular-nums">{pp.words}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                Separator
                <select value={pp.separator} onChange={(e) => updatePp({ separator: e.target.value })} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                  <option value="-">hyphen -</option>
                  <option value=" ">space</option>
                  <option value=".">dot .</option>
                  <option value="_">underscore _</option>
                  <option value="">none</option>
                </select>
              </label>
              <Check label="Capitalize words" checked={pp.capitalize} onChange={(v) => updatePp({ capitalize: v })} />
              <Check label="Add a number" checked={pp.addNumber} onChange={(v) => updatePp({ addNumber: v })} />
            </div>
            <p className="text-xs text-muted-foreground">Words come from the EFF short wordlist (1,296 words). Easy to remember and type, and each word adds about 10 bits.</p>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> {results.length === 1 ? "Your new " + mode : `${results.length} new ${mode}s`}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setReveal((r) => !r)} aria-pressed={!reveal}>
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {reveal ? "Hide" : "Show"}
            </Button>
            {results.length > 1 && (
              <CopyButton value={allText} size="sm" variant="outline">
                Copy all
              </CopyButton>
            )}
            <Button size="sm" onClick={regenerate} disabled={noClass}>
              <RefreshCw className="h-3.5 w-3.5" /> Generate
            </Button>
          </div>
        </div>

        <ul className="space-y-2">
          {results.map((r, i) => (
            <li key={`${i}-${r}`} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
              <span className={cn("min-w-0 flex-1 break-all font-mono text-base leading-relaxed", !reveal && "select-none blur-sm")}>{noClass ? "—" : r}</span>
              <CopyButton value={r} size="sm" variant="ghost" disabled={noClass} />
            </li>
          ))}
        </ul>

        <div className="space-y-1.5" role="status">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{strength.label}</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(bits)} bits of entropy</span>
          </div>
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= strength.level ? LEVEL_COLOR[strength.level] : "bg-muted")} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">A fast offline attack would need {crackTime(bits)} to crack this on average.</p>
        </div>
        <p className="text-xs text-muted-foreground">Generated with your browser&apos;s secure random number generator. Nothing is sent anywhere or saved.</p>
      </Card>
    </div>
  );
}
