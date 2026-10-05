"use client";

import * as React from "react";

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary";

/** Text-backed number input: an empty box stays empty (it is not forced to 0). */
export function NumField({ label, value, onChange, hint, className }: { label: string; value: string; onChange: (v: string) => void; hint?: string; className?: string }) {
  return (
    <label className={`space-y-1.5 text-sm ${className ?? ""}`}>
      <span className="font-medium">{label}</span>
      <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const num = (v: string) => {
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() === "" || !Number.isFinite(n) ? 0 : n;
};

export const money = (value: number, digits = 2) =>
  Number.isFinite(value) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value) : "—";
