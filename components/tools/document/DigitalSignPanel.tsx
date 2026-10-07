"use client";

import * as React from "react";
import { BadgeCheck, Download, KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { downloadBlob } from "@/lib/downloadBlob";
import { commonName, createSelfSignedP12, readIdentity, type DigitalSignOptions } from "@/lib/pdf/digitalSign";
import { cn } from "@/lib/utils";

export type DigitalConfig = Omit<DigitalSignOptions, "now"> | null;

type Source = "file" | "create";

const input = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary";

/** Certificate-based (cryptographic) signature settings. Emits a ready-to-use config, or null when off/incomplete. */
export function DigitalSignPanel({ onChange }: { onChange: (config: DigitalConfig) => void }) {
  const [enabled, setEnabled] = React.useState(false);
  const [source, setSource] = React.useState<Source>("create");
  const [p12, setP12] = React.useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [org, setOrg] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [visible, setVisible] = React.useState<"none" | "bottom-left" | "bottom-right">("bottom-right");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // validate the chosen certificate (derived, not stored)
  const check = React.useMemo(() => {
    if (!enabled || !p12 || !password) return { signer: null as string | null, problem: null as string | null };
    try {
      return { signer: commonName(readIdentity(p12.bytes, password).cert), problem: null };
    } catch (e) {
      return { signer: null, problem: e instanceof Error ? e.message : "Could not read the certificate." };
    }
  }, [enabled, p12, password]);
  const signer = check.signer;
  const shownError = error ?? check.problem;

  React.useEffect(() => {
    onChange(signer && p12 ? { p12: p12.bytes, password, reason: reason.trim() || undefined, location: location.trim() || undefined, visible } : null);
  }, [signer, p12, password, reason, location, visible, onChange]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const made = await createSelfSignedP12({ name: name.trim(), email: email.trim() || undefined, organization: org.trim() || undefined, password });
      setP12({ name: `${name.trim().replace(/\s+/g, "-")}.p12`, bytes: made.p12 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the certificate.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <label className="flex cursor-pointer items-start gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" /> Add a digital signature
          </span>
          <span className="text-xs text-muted-foreground">Cryptographic signature (PKCS#7). PDF readers can detect any change made after signing.</span>
        </span>
      </label>

      {enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-medium" role="tablist">
            {(["create", "file"] as const).map((s) => (
              <button key={s} role="tab" aria-selected={source === s} onClick={() => { setSource(s); setP12(null); setError(null); }} className={cn("rounded-md px-2 py-1.5", source === s ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {s === "create" ? "Create a certificate" : "I have a .p12 / .pfx"}
              </button>
            ))}
          </div>

          {source === "file" ? (
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium">Certificate file</span>
              <input type="file" accept=".p12,.pfx,application/x-pkcs12" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setP12({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }); }} className="block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary" />
            </label>
          ) : (
            <div className="space-y-2">
              <input value={name} onChange={(e) => { setName(e.target.value); setP12(null); }} placeholder="Full name (required)" aria-label="Full name" className={input} />
              <div className="grid grid-cols-2 gap-2">
                <input value={email} onChange={(e) => { setEmail(e.target.value); setP12(null); }} placeholder="Email" aria-label="Email" className={input} />
                <input value={org} onChange={(e) => { setOrg(e.target.value); setP12(null); }} placeholder="Organization" aria-label="Organization" className={input} />
              </div>
            </div>
          )}

          <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); if (source === "create") setP12(null); }} placeholder={source === "create" ? "Choose a certificate password" : "Certificate password"} aria-label="Certificate password" autoComplete="off" className={input} />

          {source === "create" && !p12 && (
            <button onClick={create} disabled={busy || !name.trim() || password.length < 4} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {busy ? "Generating keys…" : "Generate my certificate"}
            </button>
          )}
          {source === "create" && p12 && (
            <button onClick={() => downloadBlob(new Blob([p12.bytes as BlobPart], { type: "application/x-pkcs12" }), p12.name)} className="inline-flex h-8 items-center gap-1.5 text-xs text-primary underline underline-offset-2">
              <Download className="h-3.5 w-3.5" /> Save {p12.name} to reuse this identity later
            </button>
          )}

          {signer && (
            <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="h-4 w-4" /> Ready to sign as {signer}
            </p>
          )}

          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional), e.g. I approve this document" aria-label="Reason" className={input} />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" aria-label="Location" className={input} />
          <label className="flex items-center gap-2 text-xs">
            Visible badge
            <select value={visible} onChange={(e) => setVisible(e.target.value as typeof visible)} className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm">
              <option value="bottom-right">Last page, bottom right</option>
              <option value="bottom-left">Last page, bottom left</option>
              <option value="none">Invisible signature</option>
            </select>
          </label>
          {shownError && (
            <p role="alert" className="text-xs text-destructive">
              {shownError}
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A certificate you create here is self-signed: the document is tamper-proof, but readers such as Adobe will say the signer&apos;s identity is unverified until they trust the certificate. Use a certificate from a trusted authority for legally binding workflows. Your key never leaves this device.
          </p>
        </div>
      )}
    </Card>
  );
}
