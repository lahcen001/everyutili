"use client";

import * as React from "react";
import QRCode from "qrcode";
import { useSearchParams } from "next/navigation";
import { Download, ImagePlus, Plus, Printer, QrCode, Trash2, X } from "lucide-react";

import { FileDropTarget } from "@/components/tool-shell/FileDropTarget";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { contrastRatio, emailPayload, isInverted, normalizeUrl, phonePayload, smsPayload, vcardPayload, wifiPayload, type QrKind } from "@/lib/qrPayload";
import { DEFAULT_DESIGN, PRESETS, renderQr, type EyeStyle, type FrameStyle, type LogoShape, type ModuleStyle, type QrDesign } from "@/lib/qrStyle";
import { PAPERS, pageCount, parseRows, sheetGeometry, sheetHtml, type SheetLayout } from "@/lib/qrSheet";
import { cn } from "@/lib/utils";

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

const MODULES: { id: ModuleStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "dots", label: "Dots" },
  { id: "classy", label: "Classy" },
  { id: "diamond", label: "Diamond" },
];
const EYES: { id: EyeStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
  { id: "leaf", label: "Leaf" },
];
const FRAMES: { id: FrameStyle; label: string }[] = [
  { id: "none", label: "None" },
  { id: "line", label: "Line" },
  { id: "box", label: "Box" },
  { id: "bar", label: "Label bar" },
];

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-sm font-medium transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary");

function Text({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1 text-xs font-medium">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="block h-9 w-full cursor-pointer rounded-lg border border-border bg-background" />
    </label>
  );
}

const truncate = (value: string, max = 60): string => {
  const t = value.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode PNG"))), "image/png");
    };
    img.onerror = () => reject(new Error("Could not render the QR code"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Shrinks a picked logo to at most 256px so it stays light inside the QR file and in storage. */
async function loadLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const max = 256;
    const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((img.naturalWidth || max) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || max) * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface SheetRow {
  id: string;
  title: string;
  content: string;
  copies: number;
}
const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function matrixFor(text: string, ec: Ec) {
  return QRCode.create(text, { errorCorrectionLevel: ec }).modules as { size: number; data: ArrayLike<number> };
}

export default function QrCodeGenerator() {
  useTrackTool("qr-code-generator");
  // A link or text shared from another app arrives as ?text=… (see the Share page)
  const shared = useSearchParams().get("text")?.trim() ?? "";
  const sharedIsLink = /^https?:\/\/\S+$/i.test(shared);
  const [kind, setKind] = React.useState<QrKind>(shared && !sharedIsLink ? "text" : "url");
  const [url, setUrl] = React.useState(sharedIsLink ? shared : "https://everyutili.com");
  const [freeText, setFreeText] = React.useState(shared && !sharedIsLink ? shared : "");
  const [wifi, setWifi] = React.useState({ ssid: "", password: "", security: "WPA" as "WPA" | "WEP" | "nopass", hidden: false });
  const [mail, setMail] = React.useState({ to: "", subject: "", body: "" });
  const [phone, setPhone] = React.useState("");
  const [sms, setSms] = React.useState({ number: "", body: "" });
  const [card, setCard] = React.useState({ first: "", last: "", org: "", title: "", phone: "", email: "", url: "" });
  const [size, setSize] = React.useState(1024);
  const [ec, setEc] = React.useState<Ec>("M");
  const [design, setDesign] = usePersisted<QrDesign>("everyutili_qr_design", DEFAULT_DESIGN);
  const [tab, setTab] = React.useState<"style" | "logo" | "title">("style");
  const [rows, setRows] = usePersisted<SheetRow[]>("everyutili_qr_sheet", []);
  const [layout, setLayout] = usePersisted<{ paper: "a4" | "letter"; columns: number; margin: number; gap: number; guides: boolean; useRowTitles: boolean }>("everyutili_qr_layout", { paper: "a4", columns: 3, margin: 10, gap: 6, guides: true, useRowTitles: true });
  const [bulk, setBulk] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const patch = (p: Partial<QrDesign>) => setDesign((d) => ({ ...d, ...p }));

  const payload = (() => {
    switch (kind) {
      case "url": return normalizeUrl(url);
      case "text": return freeText;
      case "wifi": return wifi.ssid.trim() ? wifiPayload(wifi) : "";
      case "email": return mail.to.trim() ? emailPayload(mail) : "";
      case "phone": return phone.trim() ? phonePayload(phone) : "";
      case "sms": return sms.number.trim() ? smsPayload(sms.number, sms.body) : "";
      case "vcard": return card.first.trim() || card.last.trim() ? vcardPayload(card) : "";
    }
  })();
  const hasPayload = payload.trim().length > 0;
  // A logo covers the middle of the code, so use the strongest error correction.
  const effectiveEc: Ec = design.logo ? "H" : ec;
  const contrast = contrastRatio(design.fg, design.bg);
  const inverted = isInverted(design.fg, design.bg);

  const rendered = React.useMemo(() => {
    if (!hasPayload) return { out: null as ReturnType<typeof renderQr> | null, err: null as string | null };
    try {
      return { out: renderQr(matrixFor(payload, effectiveEc), design, "qr"), err: null };
    } catch (e) {
      return { out: null, err: e instanceof Error && /too big|capacity|long/i.test(e.message) ? "This is too much data for a QR code at this error-correction level. Shorten it or lower the level." : e instanceof Error ? e.message : "Failed to generate QR code" };
    }
  }, [hasPayload, payload, effectiveEc, design]);
  const out = rendered.out;
  const previewUrl = out ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(out.svg)}` : null;
  const aspect = out ? out.height / out.width : 1;

  const pickLogo = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const data = await loadLogo(file);
      setError(null);
      patch({ logo: { url: data, ratio: design.logo?.ratio ?? 0.22, shape: design.logo?.shape ?? "rounded", plate: design.logo?.plate ?? true } });
      setTab("logo");
    } catch {
      setError("Could not read that image.");
    }
  };

  const record = async (blob: Blob, summary: string) => {
    await saveToolResult("qr-code-generator", { title: truncate(payload), summary: `${summary} · ${formatBytes(blob.size)}`, blob });
    historyRef.current?.refresh();
  };
  const downloadPng = async () => {
    if (!out) return;
    const blob = await svgToPng(out.svg, size, Math.round(size * aspect));
    downloadBlob(blob, "qr-code.png");
    await record(blob, `${size}px PNG`);
  };
  const downloadSvg = async () => {
    if (!out) return;
    const blob = new Blob([out.svg], { type: "image/svg+xml" });
    downloadBlob(blob, "qr-code.svg");
    await record(blob, "SVG");
  };

  // ---- print sheet -------------------------------------------------------
  const paper = PAPERS.find((p) => p.id === layout.paper) ?? PAPERS[0];
  const sheetLayout: SheetLayout = { paper, columns: layout.columns, margin: layout.margin, gap: layout.gap };

  const sheet = React.useMemo(() => {
    const svgs: string[] = [];
    let firstAspect = 1;
    let bad = 0;
    rows.forEach((r, ri) => {
      const content = /^[a-z][a-z0-9+.-]*:/i.test(r.content.trim()) || /\s/.test(r.content.trim()) ? r.content.trim() : normalizeUrl(r.content);
      if (!content) return;
      try {
        const title = layout.useRowTitles ? r.title.trim() : "";
        const d: QrDesign = { ...design, title: title ? { text: title, position: design.title?.position ?? "bottom", color: design.title?.color ?? "#111111" } : design.title && !layout.useRowTitles ? design.title : null };
        const q = renderQr(matrixFor(content, design.logo ? "H" : ec), d, `s${ri}`);
        if (svgs.length === 0) firstAspect = q.height / q.width;
        for (let c = 0; c < Math.max(1, r.copies); c++) svgs.push(q.svg);
      } catch {
        bad += 1;
      }
    });
    return { svgs, aspect: firstAspect, bad };
  }, [rows, design, ec, layout.useRowTitles]);

  const geo = sheetGeometry(sheetLayout, sheet.aspect);
  const pages = pageCount(sheet.svgs.length, geo.perPage);
  const html = sheet.svgs.length ? sheetHtml(sheet.svgs, sheetLayout, sheet.aspect, layout.guides) : "";

  const printSheet = () => {
    if (!html) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    window.setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 60000);
    }, 400);
  };

  const addRow = (title = "", content = "") => setRows((r) => [...r, { id: uid(), title, content, copies: 1 }]);
  const updateRow = (id: string, p: Partial<SheetRow>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const addCurrent = () => {
    if (hasPayload) addRow(design.title?.text ?? "", payload);
  };
  const importBulk = () => {
    const parsed = parseRows(bulk);
    if (parsed.length === 0) return;
    setRows((r) => [...r, ...parsed.map((p) => ({ id: uid(), title: p.title, content: p.content, copies: 1 }))]);
    setBulk("");
  };

  return (
    <FileDropTarget label="Drop an image to use as logo" onFiles={(f) => void pickLogo(f.find((x) => x.type.startsWith("image/")))} className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="QR code content">
              {KINDS.map((k) => (
                <button key={k.id} role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)} className={chip(kind === k.id)}>{k.label}</button>
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

          <Card className="space-y-4 p-5">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Designs</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p.id} onClick={() => patch(p.design)} className="rounded-xl border border-border px-3 py-1.5 text-sm font-medium hover:border-primary hover:bg-primary/5">{p.label}</button>
                ))}
              </div>
            </div>

            <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Design options">
              {([["style", "Shapes & colours"], ["logo", "Logo"], ["title", "Title & frame"]] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("flex-1 rounded-full px-3 py-1.5 text-sm font-medium", tab === id ? "bg-background shadow-sm" : "text-muted-foreground")}>{label}</button>
              ))}
            </div>

            {tab === "style" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Dots</p>
                    <div className="flex flex-wrap gap-1.5">{MODULES.map((m) => <button key={m.id} onClick={() => patch({ moduleStyle: m.id })} aria-pressed={design.moduleStyle === m.id} className={chip(design.moduleStyle === m.id)}>{m.label}</button>)}</div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Corner squares</p>
                    <div className="flex flex-wrap gap-1.5">{EYES.map((m) => <button key={m.id} onClick={() => patch({ eyeStyle: m.id })} aria-pressed={design.eyeStyle === m.id} className={chip(design.eyeStyle === m.id)}>{m.label}</button>)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ColorField label="Colour" value={design.fg} onChange={(v) => patch({ fg: v, fg2: design.fg2 === design.fg ? v : design.fg2, eyeColor: design.eyeColor === design.fg ? v : design.eyeColor })} />
                  <ColorField label="Gradient to" value={design.fg2} onChange={(v) => patch({ fg2: v })} />
                  <ColorField label="Corner colour" value={design.eyeColor} onChange={(v) => patch({ eyeColor: v })} />
                  <ColorField label="Background" value={design.bg} onChange={(v) => patch({ bg: v })} />
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Quiet border: {design.margin}</span>
                    <input type="range" min={1} max={6} value={design.margin} onChange={(e) => patch({ margin: Number(e.target.value) })} className="block w-36 accent-primary" />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="block font-medium">Error correction</span>
                    <select value={effectiveEc} disabled={Boolean(design.logo)} onChange={(e) => setEc(e.target.value as Ec)} className="block h-9 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-60">
                      {EC_LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </label>
                  <button onClick={() => patch({ fg2: design.fg })} className="text-xs text-muted-foreground underline-offset-2 hover:underline">Use a single colour</button>
                </div>
              </div>
            )}

            {tab === "logo" && (
              <div className="space-y-4">
                {design.logo ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={design.logo.url} alt="Your logo" className="h-14 w-14 rounded-lg border border-border bg-white object-contain p-1" />
                      <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:border-primary">
                        <ImagePlus className="h-4 w-4" /> Change
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                      <Button size="sm" variant="ghost" onClick={() => patch({ logo: null })}><X className="h-3.5 w-3.5" /> Remove</Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Size: {Math.round(design.logo.ratio * 100)}%</span>
                        <input type="range" min={12} max={30} value={Math.round(design.logo.ratio * 100)} onChange={(e) => patch({ logo: { ...design.logo!, ratio: Number(e.target.value) / 100 } })} className="block w-full accent-primary" />
                      </label>
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium">Shape</p>
                        <div className="flex gap-1.5">{(["square", "rounded", "circle"] as LogoShape[]).map((s) => <button key={s} onClick={() => patch({ logo: { ...design.logo!, shape: s } })} aria-pressed={design.logo?.shape === s} className={chip(design.logo?.shape === s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
                      </div>
                      <label className="flex items-center gap-2 pt-6 text-sm">
                        <input type="checkbox" checked={design.logo.plate} onChange={(e) => patch({ logo: { ...design.logo!, plate: e.target.checked } })} className="h-4 w-4 rounded border-border accent-primary" /> Background behind logo
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">With a logo the error correction is set to High (30%) so the code still scans, and the dots behind the logo are removed. Keep the logo small and test it with your phone.</p>
                  </>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-8 text-center hover:border-primary hover:bg-primary/5">
                    <ImagePlus className="h-7 w-7 text-primary" />
                    <span className="font-medium">Add your logo</span>
                    <span className="text-xs text-muted-foreground">Click, or drop an image anywhere on this tool. PNG, JPG, SVG or WebP.</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            )}

            {tab === "title" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <Text label="Title (shown with the code)" value={design.title?.text ?? ""} onChange={(v) => patch({ title: v ? { text: v, position: design.title?.position ?? "bottom", color: design.title?.color ?? "#111111" } : null })} placeholder="e.g. Scan for the menu" />
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Position</p>
                    <div className="flex gap-1.5">{(["top", "bottom"] as const).map((p) => <button key={p} disabled={!design.title} onClick={() => design.title && patch({ title: { ...design.title, position: p } })} aria-pressed={design.title?.position === p} className={cn(chip(design.title?.position === p), "disabled:opacity-40")}>{p === "top" ? "Above" : "Below"}</button>)}</div>
                  </div>
                  <label className="space-y-1 text-xs font-medium">
                    Text colour
                    <input type="color" disabled={!design.title} value={design.title?.color ?? "#111111"} onChange={(e) => design.title && patch({ title: { ...design.title, color: e.target.value } })} className="block h-9 w-16 cursor-pointer rounded-lg border border-border bg-background disabled:opacity-40" />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Frame</p>
                    <div className="flex flex-wrap gap-1.5">{FRAMES.map((f) => <button key={f.id} onClick={() => patch({ frame: f.id })} aria-pressed={design.frame === f.id} className={chip(design.frame === f.id)}>{f.label}</button>)}</div>
                  </div>
                  {design.frame === "bar" && <Text label="Label on the bar" value={design.frameLabel} onChange={(v) => patch({ frameLabel: v })} placeholder="SCAN ME" />}
                </div>
              </div>
            )}

            {(inverted || contrast < 3) && (
              <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                {inverted ? "Light dots on a dark background (an inverted code) won't scan on many readers." : "Low contrast between the colours — this code may be hard to scan."} Use a dark colour on a light background.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20">
          {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          {rendered.err && hasPayload && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{rendered.err}</div>}
          {previewUrl ? (
            <Card className="flex flex-col items-center gap-4 p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Generated QR code" className="w-full max-w-72 rounded-xl border border-border" />
              <p className="max-w-full break-all text-center text-xs text-muted-foreground">{truncate(payload, 120)}</p>
              <label className="flex w-full items-center gap-2 text-xs text-muted-foreground">
                PNG width
                <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-sm text-foreground">
                  {[256, 512, 1024, 2048].map((s) => <option key={s} value={s}>{s}px</option>)}
                </select>
              </label>
              <div className="flex w-full flex-wrap justify-center gap-2">
                <Button onClick={downloadPng} className="flex-1"><Download className="h-4 w-4" /> PNG</Button>
                <Button variant="outline" onClick={downloadSvg} className="flex-1"><Download className="h-4 w-4" /> SVG</Button>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={addCurrent}><Plus className="h-4 w-4" /> Add to the print sheet</Button>
            </Card>
          ) : (
            !rendered.err && <Card className="flex h-56 items-center justify-center p-6 text-center text-sm text-muted-foreground"><QrCode className="mr-2 h-5 w-5 shrink-0" /> Fill in the details to generate a QR code</Card>
          )}
        </div>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-lg font-bold"><Printer className="h-5 w-5 text-primary" /> Print many on one page</h3>
            <p className="text-sm text-muted-foreground">Make labels, table cards or stickers. Each code uses the design above; give each its own title.</p>
          </div>
          <Button onClick={printSheet} disabled={sheet.svgs.length === 0}><Printer className="h-4 w-4" /> Print {pages > 0 ? `(${sheet.svgs.length} codes · ${pages} page${pages === 1 ? "" : "s"})` : ""}</Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="space-y-3">
            {rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No codes yet. Use “Add to the print sheet” above, add a row, or paste a list below.</p>}
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="grid grid-cols-[1fr_1.6fr_4.5rem_auto] items-center gap-2">
                  <input value={r.title} onChange={(e) => updateRow(r.id, { title: e.target.value })} placeholder="Title" aria-label="Title" className={inputClass} />
                  <input value={r.content} onChange={(e) => updateRow(r.id, { content: e.target.value })} placeholder="Link or text" aria-label="Link or text" className={inputClass} />
                  <input type="number" min={1} max={200} value={r.copies} onChange={(e) => updateRow(r.id, { copies: Math.min(200, Math.max(1, Number(e.target.value) || 1)) })} aria-label="Copies" title="Copies" className={cn(inputClass, "text-center")} />
                  <button onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} aria-label="Remove" className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addRow()}><Plus className="h-3.5 w-3.5" /> Add a row</Button>
              {rows.length > 0 && <Button size="sm" variant="ghost" onClick={() => setRows([])}><Trash2 className="h-3.5 w-3.5" /> Clear all</Button>}
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Paste a list (one per line: Title | link or text)</summary>
              <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={4} placeholder={"Table 1 | https://menu.example.com/1\nTable 2 | https://menu.example.com/2"} className={cn(inputClass, "mt-2 font-mono")} />
              <Button size="sm" className="mt-2" onClick={importBulk} disabled={parseRows(bulk).length === 0}>Add {parseRows(bulk).length || ""} codes</Button>
            </details>
            {sheet.bad > 0 && <p className="text-xs text-destructive">{sheet.bad} row{sheet.bad === 1 ? " is" : "s are"} too long for a QR code and will be skipped.</p>}
          </div>

          <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="font-medium">Paper</span>
                <select value={layout.paper} onChange={(e) => setLayout((l) => ({ ...l, paper: e.target.value as "a4" | "letter" }))} className={inputClass}>{PAPERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
              </label>
              <label className="space-y-1">
                <span className="font-medium">Columns</span>
                <select value={layout.columns} onChange={(e) => setLayout((l) => ({ ...l, columns: Number(e.target.value) }))} className={inputClass}>{[1, 2, 3, 4, 5, 6].map((c) => <option key={c}>{c}</option>)}</select>
              </label>
              <label className="space-y-1">
                <span className="font-medium">Margin: {layout.margin} mm</span>
                <input type="range" min={0} max={25} value={layout.margin} onChange={(e) => setLayout((l) => ({ ...l, margin: Number(e.target.value) }))} className="block w-full accent-primary" />
              </label>
              <label className="space-y-1">
                <span className="font-medium">Gap: {layout.gap} mm</span>
                <input type="range" min={0} max={20} value={layout.gap} onChange={(e) => setLayout((l) => ({ ...l, gap: Number(e.target.value) }))} className="block w-full accent-primary" />
              </label>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={layout.useRowTitles} onChange={(e) => setLayout((l) => ({ ...l, useRowTitles: e.target.checked }))} className="h-4 w-4 accent-primary" /> Show each row&apos;s title under its code</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={layout.guides} onChange={(e) => setLayout((l) => ({ ...l, guides: e.target.checked }))} className="h-4 w-4 accent-primary" /> Dashed cut guides</label>
            <p className="text-xs text-muted-foreground">Each code prints {geo.cellW.toFixed(0)} mm wide — {geo.perPage} per page. In the print window choose “Save as PDF” to get a file.</p>
          </div>
        </div>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="qr-code-generator" />
    </FileDropTarget>
  );
}
