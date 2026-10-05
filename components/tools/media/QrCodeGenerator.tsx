"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Download, ImagePlus, QrCode, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { contrastRatio, emailPayload, isInverted, normalizeUrl, phonePayload, smsPayload, vcardPayload, wifiPayload, type QrKind } from "@/lib/qrPayload";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  { fg: "#000000", bg: "#ffffff", label: "Classic" },
  { fg: "#0f172a", bg: "#f0f9ff", label: "Ocean" },
  { fg: "#166534", bg: "#f0fdf4", label: "Forest" },
];
const KINDS: { id: QrKind; label: string }[] = [
  { id: "url", label: "Link" },
  { id: "text", label: "Text" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "sms", label: "SMS" },
  { id: "vcard", label: "Contact" },
];
const EC_LEVELS = [
  { id: "L", label: "Low (7%)" },
  { id: "M", label: "Medium (15%)" },
  { id: "Q", label: "Quartile (25%)" },
  { id: "H", label: "High (30%)" },
] as const;
type Ec = (typeof EC_LEVELS)[number]["id"];

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

function Text({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

function truncate(value: string, max = 60): string {
  const t = value.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function withLogo(svg: string, logoUrl: string, ratio: number): string {
  const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  if (!m) return svg;
  const n = Number(m[1]);
  const box = n * ratio;
  const pos = (n - box) / 2;
  const pad = box * 0.1;
  const logo = `<rect x="${pos - pad}" y="${pos - pad}" width="${box + pad * 2}" height="${box + pad * 2}" rx="${box * 0.15}" fill="#ffffff"/><image href="${logoUrl}" x="${pos}" y="${pos}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/>`;
  return svg.replace("</svg>", `${logo}</svg>`);
}

function svgToPng(svg: string, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode PNG"))), "image/png");
    };
    img.onerror = () => reject(new Error("Could not render the QR code"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export default function QrCodeGenerator() {
  useTrackTool("qr-code-generator");
  const [kind, setKind] = React.useState<QrKind>("url");
  const [url, setUrl] = React.useState("https://everyutili.com");
  const [freeText, setFreeText] = React.useState("");
  const [wifi, setWifi] = React.useState({ ssid: "", password: "", security: "WPA" as "WPA" | "WEP" | "nopass", hidden: false });
  const [mail, setMail] = React.useState({ to: "", subject: "", body: "" });
  const [phone, setPhone] = React.useState("");
  const [sms, setSms] = React.useState({ number: "", body: "" });
  const [card, setCard] = React.useState({ first: "", last: "", org: "", title: "", phone: "", email: "", url: "" });
  const [size, setSize] = React.useState(512);
  const [margin, setMargin] = React.useState(2);
  const [ec, setEc] = React.useState<Ec>("M");
  const [fgColor, setFgColor] = React.useState("#000000");
  const [bgColor, setBgColor] = React.useState("#ffffff");
  const [logo, setLogo] = React.useState<{ url: string; name: string } | null>(null);
  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const payload = (() => {
    switch (kind) {
      case "url":
        return normalizeUrl(url);
      case "text":
        return freeText;
      case "wifi":
        return wifi.ssid.trim() ? wifiPayload(wifi) : "";
      case "email":
        return mail.to.trim() ? emailPayload(mail) : "";
      case "phone":
        return phone.trim() ? phonePayload(phone) : "";
      case "sms":
        return sms.number.trim() ? smsPayload(sms.number, sms.body) : "";
      case "vcard":
        return card.first.trim() || card.last.trim() ? vcardPayload(card) : "";
    }
  })();
  const hasPayload = payload.trim().length > 0;
  // A logo covers the middle of the code, so use the strongest error correction.
  const effectiveEc: Ec = logo ? "H" : ec;
  const contrast = contrastRatio(fgColor, bgColor);
  const inverted = isInverted(fgColor, bgColor);

  React.useEffect(() => {
    if (!hasPayload) return;
    let cancelled = false;
    QRCode.toString(payload, { type: "svg", margin, color: { dark: fgColor, light: bgColor }, errorCorrectionLevel: effectiveEc })
      .then((out) => {
        if (cancelled) return;
        setSvg(logo ? withLogo(out, logo.url, 0.22) : out);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error && /too big|capacity/i.test(e.message) ? "This is too much data for a QR code at this error-correction level. Shorten it or lower the level." : e instanceof Error ? e.message : "Failed to generate QR code");
      });
    return () => {
      cancelled = true;
    };
  }, [hasPayload, payload, margin, fgColor, bgColor, effectiveEc, logo]);

  const previewUrl = hasPayload && svg && !error ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;

  const pickLogo = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setLogo({ url: String(reader.result), name: file.name });
    reader.readAsDataURL(file);
  };

  const record = async (blob: Blob, summary: string) => {
    await saveToolResult("qr-code-generator", { title: truncate(payload), summary: `${summary} · ${formatBytes(blob.size)}`, blob });
    historyRef.current?.refresh();
  };

  const downloadPng = async () => {
    if (!svg) return;
    const blob = await svgToPng(svg, size);
    downloadBlob(blob, "qr-code.png");
    await record(blob, `${size}×${size}px PNG`);
  };

  const downloadSvg = async () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    downloadBlob(blob, "qr-code.svg");
    await record(blob, "SVG");
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="QR code content">
          {KINDS.map((k) => (
            <button key={k.id} role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)} className={cn("rounded-full border px-3 py-1 text-sm font-medium transition-colors", kind === k.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")}>
              {k.label}
            </button>
          ))}
        </div>

        {kind === "url" && <Text label="Web address" value={url} onChange={setUrl} placeholder="example.com" />}
        {kind === "text" && (
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Text</span>
            <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} rows={3} placeholder="Any text" className={cn(inputClass, "resize-none")} />
          </label>
        )}
        {kind === "wifi" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Network name (SSID)" value={wifi.ssid} onChange={(v) => setWifi({ ...wifi, ssid: v })} />
            <Text label="Password" value={wifi.password} onChange={(v) => setWifi({ ...wifi, password: v })} />
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Security</span>
              <select value={wifi.security} onChange={(e) => setWifi({ ...wifi, security: e.target.value as "WPA" | "WEP" | "nopass" })} className={inputClass}>
                <option value="WPA">WPA / WPA2 / WPA3</option>
                <option value="WEP">WEP</option>
                <option value="nopass">No password</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={wifi.hidden} onChange={(e) => setWifi({ ...wifi, hidden: e.target.checked })} className="h-4 w-4 rounded border-border" /> Hidden network
            </label>
          </div>
        )}
        {kind === "email" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="To" type="email" value={mail.to} onChange={(v) => setMail({ ...mail, to: v })} />
            <Text label="Subject" value={mail.subject} onChange={(v) => setMail({ ...mail, subject: v })} />
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Message</span>
              <textarea value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} rows={2} className={cn(inputClass, "resize-none")} />
            </label>
          </div>
        )}
        {kind === "phone" && <Text label="Phone number" type="tel" value={phone} onChange={setPhone} placeholder="+1 555 010 9999" />}
        {kind === "sms" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Phone number" type="tel" value={sms.number} onChange={(v) => setSms({ ...sms, number: v })} />
            <Text label="Message" value={sms.body} onChange={(v) => setSms({ ...sms, body: v })} />
          </div>
        )}
        {kind === "vcard" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="First name" value={card.first} onChange={(v) => setCard({ ...card, first: v })} />
            <Text label="Last name" value={card.last} onChange={(v) => setCard({ ...card, last: v })} />
            <Text label="Company" value={card.org} onChange={(v) => setCard({ ...card, org: v })} />
            <Text label="Job title" value={card.title} onChange={(v) => setCard({ ...card, title: v })} />
            <Text label="Phone" type="tel" value={card.phone} onChange={(v) => setCard({ ...card, phone: v })} />
            <Text label="Email" type="email" value={card.email} onChange={(v) => setCard({ ...card, email: v })} />
            <Text label="Website" value={card.url} onChange={(v) => setCard({ ...card, url: v })} />
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">PNG size (px)</span>
            <input type="number" min={128} max={2048} step={16} value={size} onChange={(e) => setSize(Math.min(2048, Math.max(128, Number(e.target.value) || 512)))} className={inputClass} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Quiet border</span>
            <input type="number" min={0} max={8} value={margin} onChange={(e) => setMargin(Math.min(8, Math.max(0, Math.floor(Number(e.target.value)) || 0)))} className={inputClass} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Foreground</span>
            <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Background</span>
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-background" />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Error correction</span>
            <select value={effectiveEc} disabled={Boolean(logo)} onChange={(e) => setEc(e.target.value as Ec)} className="block h-9 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-60">
              {EC_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1.5 text-sm">
            <span className="block font-medium">Logo in the centre</span>
            {logo ? (
              <span className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
                <span className="max-w-40 truncate">{logo.name}</span>
                <button onClick={() => setLogo(null)} aria-label="Remove logo" className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </span>
            ) : (
              <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 hover:border-primary">
                <ImagePlus className="h-4 w-4" /> Add logo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((p) => (
              <button key={p.label} onClick={() => { setFgColor(p.fg); setBgColor(p.bg); }} className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary">
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {logo && <p className="text-xs text-muted-foreground">With a logo the error correction is set to High (30%) so the code still scans. Keep the logo small and test it with your phone.</p>}
        {(inverted || contrast < 3) && (
          <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {inverted ? "Light modules on a dark background (an inverted code) won't scan on many readers." : "Low contrast between the two colours — this code may be hard to scan."} Use a dark foreground on a light background.
          </p>
        )}
      </Card>

      {error && hasPayload && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {previewUrl && (
        <Card className="flex flex-col items-center gap-4 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Generated QR code" width={256} height={256} className="rounded-lg border border-border" />
          <p className="max-w-full break-all text-center text-xs text-muted-foreground">{truncate(payload, 120)}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={downloadPng}>
              <Download className="h-4 w-4" /> Download PNG
            </Button>
            <Button variant="outline" onClick={downloadSvg}>
              <Download className="h-4 w-4" /> Download SVG
            </Button>
          </div>
        </Card>
      )}

      {!previewUrl && !(error && hasPayload) && (
        <Card className="flex h-48 items-center justify-center p-6 text-sm text-muted-foreground">
          <QrCode className="mr-2 h-5 w-5" /> Fill in the details above to generate a QR code
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="qr-code-generator" />
    </div>
  );
}
