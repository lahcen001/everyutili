"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Loader2, PenLine, Trash2, Type, X } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { DigitalSignPanel, type DigitalConfig } from "@/components/tools/document/DigitalSignPanel";
import { SignaturePad } from "@/components/tools/document/SignaturePad";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { friendlyPdfError, isPdfFile } from "@/lib/pdf/errors";
import { openPdf, renderPageCanvas } from "@/lib/pdf/pdfjs";
import { signPdfDigitally } from "@/lib/pdf/digitalSign";
import { applyStamps } from "@/lib/pdf/stamp";
import { INK_COLORS, SIGNATURE_FONTS, textToStamp, type StampImage } from "@/lib/pdf/stampImages";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { cn } from "@/lib/utils";

type Scope = "page" | "all" | "last";

interface Stamp {
  id: string;
  image: StampImage;
  page: number;
  /** fractions of the displayed page, from the top-left */
  x: number;
  y: number;
  w: number;
  scope: Scope;
}

const SAVED_KEY = "everyutili_saved_signatures";
let counter = 0;
const newId = () => `s${++counter}`;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function loadSaved(): StampImage[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((s) => s && typeof s.dataUrl === "string" && typeof s.aspect === "number").slice(0, 4) : [];
  } catch {
    return [];
  }
}
function persistSaved(list: StampImage[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 4)));
  } catch {
    /* storage unavailable */
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(",")[1] ?? "");
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export default function SignPdf() {
  useTrackTool("sign-pdf");
  const [fileName, setFileName] = React.useState("");
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null);
  const [sizes, setSizes] = React.useState<{ width: number; height: number }[]>([]);
  const [page, setPage] = React.useState(0);
  const [pageUrl, setPageUrl] = React.useState<string | null>(null);
  const [stamps, setStamps] = React.useState<Stamp[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [textValue, setTextValue] = React.useState("");
  const [textColor, setTextColor] = React.useState(INK_COLORS[0]);
  const [saved, setSaved] = React.useState<StampImage[]>(() => (typeof window === "undefined" ? [] : loadSaved()));
  const [remember, setRemember] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [digital, setDigital] = React.useState<DigitalConfig>(null);
  const pdfRef = React.useRef<Awaited<ReturnType<typeof openPdf>> | null>(null);
  const urlRef = React.useRef<string | null>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  React.useEffect(() => {
    return () => {
      void pdfRef.current?.destroy();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const showPage = React.useCallback(async (index: number) => {
    const doc = pdfRef.current;
    if (!doc) return;
    const first = await doc.pdf.getPage(index + 1);
    const vp = first.getViewport({ scale: 1 });
    const canvas = await renderPageCanvas(doc.pdf, index + 1, Math.min(2.5, 1100 / vp.width));
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render"))), "image/jpeg", 0.9));
    const url = URL.createObjectURL(blob);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setPageUrl(url);
  }, []);

  const openFile = async (files: File[]) => {
    const file = files.find(isPdfFile);
    if (!file) {
      setError("Please choose a PDF file.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      await pdfRef.current?.destroy();
      const doc = await openPdf(data);
      pdfRef.current = doc;
      const dims: { width: number; height: number }[] = [];
      for (let n = 1; n <= doc.pdf.numPages; n++) {
        const vp = (await doc.pdf.getPage(n)).getViewport({ scale: 1 });
        dims.push({ width: vp.width, height: vp.height });
      }
      setSizes(dims);
      setBytes(data);
      setFileName(file.name);
      setStamps([]);
      setSelected(null);
      setPage(0);
      await showPage(0);
    } catch (e) {
      setError(friendlyPdfError(e, "Could not open this PDF."));
    } finally {
      setLoading(false);
    }
  };

  const goTo = async (index: number) => {
    const next = clamp(index, 0, sizes.length - 1);
    setPage(next);
    setSelected(null);
    await showPage(next);
  };

  const addStamp = (image: StampImage, w: number, at?: { x: number; y: number }) => {
    const id = newId();
    setStamps((prev) => [...prev, { id, image, page, x: at?.x ?? 0.5, y: at?.y ?? 0.78, w, scope: "page" }]);
    setSelected(id);
  };
  const update = (id: string, patch: Partial<Stamp>) => setStamps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => {
    setStamps((prev) => prev.filter((s) => s.id !== id));
    setSelected((cur) => (cur === id ? null : cur));
  };

  const addText = (text: string, widthFraction: number) => {
    const image = textToStamp(text, SIGNATURE_FONTS[3].css, textColor, 60);
    if (image) addStamp(image, widthFraction);
  };

  const onSignature = (image: StampImage) => {
    addStamp(image, 0.28);
    setCreating(false);
    if (remember) {
      const next = [image, ...saved.filter((s) => s.dataUrl !== image.dataUrl)].slice(0, 4);
      setSaved(next);
      persistSaved(next);
    }
  };

  // dragging and resizing
  const gesture = React.useRef<{ id: string; mode: "move" | "resize"; px: number; py: number; x: number; y: number; w: number } | null>(null);
  const begin = (e: React.PointerEvent, stamp: Stamp, mode: "move" | "resize") => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture.current = { id: stamp.id, mode, px: e.clientX, py: e.clientY, x: stamp.x, y: stamp.y, w: stamp.w };
    setSelected(stamp.id);
  };
  const dragMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    const stage = stageRef.current;
    if (!g || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dx = (e.clientX - g.px) / rect.width;
    const dy = (e.clientY - g.py) / rect.height;
    const stamp = stamps.find((s) => s.id === g.id);
    if (!stamp) return;
    if (g.mode === "move") {
      const h = stampHeight(stamp);
      update(g.id, { x: clamp(g.x + dx, 0, 1 - stamp.w), y: clamp(g.y + dy, 0, 1 - h) });
    } else update(g.id, { w: clamp(g.w + dx, 0.04, 1 - stamp.x) });
  };
  const dragEnd = () => {
    gesture.current = null;
  };

  const size = sizes[page];
  const stampHeight = (s: Stamp) => (size ? (s.w * s.image.aspect * size.width) / size.height : 0.1);

  const onKey = (e: React.KeyboardEvent, s: Stamp) => {
    const step = e.shiftKey ? 0.02 : 0.005;
    const h = stampHeight(s);
    if (e.key === "Delete" || e.key === "Backspace") remove(s.id);
    else if (e.key === "ArrowLeft") update(s.id, { x: clamp(s.x - step, 0, 1 - s.w) });
    else if (e.key === "ArrowRight") update(s.id, { x: clamp(s.x + step, 0, 1 - s.w) });
    else if (e.key === "ArrowUp") update(s.id, { y: clamp(s.y - step, 0, 1 - h) });
    else if (e.key === "ArrowDown") update(s.id, { y: clamp(s.y + step, 0, 1 - h) });
    else if (e.key === "+" || e.key === "=") update(s.id, { w: clamp(s.w + 0.01, 0.04, 1 - s.x) });
    else if (e.key === "-") update(s.id, { w: clamp(s.w - 0.01, 0.04, 1) });
    else return;
    e.preventDefault();
  };

  const pagesFor = (s: Stamp) => (s.scope === "all" ? sizes.map((_, i) => i) : s.scope === "last" ? [sizes.length - 1] : [s.page]);
  const stampsOnPage = stamps.filter((s) => pagesFor(s).includes(page));
  const selectedStamp = stamps.find((s) => s.id === selected) ?? null;

  const exportPdf = async () => {
    if (!bytes || (stamps.length === 0 && !digital)) return;
    setExporting(true);
    setError(null);
    try {
      const list = stamps.flatMap((s) =>
        pagesFor(s).map((pageIndex) => {
          const dims = sizes[pageIndex];
          const h = (s.w * s.image.aspect * dims.width) / dims.height;
          return { png: dataUrlToBytes(s.image.dataUrl), placement: { x: s.x, y: Math.min(s.y, 1 - h), w: s.w, h }, pages: [pageIndex] };
        })
      );
      let out = stamps.length ? await applyStamps(bytes, list) : bytes;
      if (digital) out = await signPdfDigitally(out, digital);
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const name = fileName.replace(/\.pdf$/i, "") + "-signed.pdf";
      downloadBlob(blob, name);
      await saveToolResult("sign-pdf", { title: name, summary: `${digital ? "Digitally signed · " : ""}${stamps.length} item${stamps.length === 1 ? "" : "s"} · ${formatBytes(blob.size)}`, blob });
      historyRef.current?.refresh();
    } catch (e) {
      setError(friendlyPdfError(e, "Could not sign this PDF."));
    } finally {
      setExporting(false);
    }
  };

  const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40";

  if (!bytes) {
    return (
      <div className="space-y-4">
        <DropZone onFiles={(f) => void openFile(f)} accept="application/pdf" multiple={false} label="Drag & drop a PDF to sign, or click to browse" hint="Draw, type or upload your signature — nothing leaves your device" />
        {loading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <ToolHistoryList ref={historyRef} toolSlug="sign-pdf" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <p className="truncate text-sm font-medium" title={fileName}>
              {fileName}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button className={btn} onClick={() => setCreating((c) => !c)}>
                <PenLine className="h-4 w-4" /> Signature
              </button>
              <button className={btn} onClick={() => addText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), 0.22)}>
                <CalendarDays className="h-4 w-4" /> Today&apos;s date
              </button>
            </div>
            <div className="flex gap-2">
              <input value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Add text or initials" aria-label="Text to add" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" onKeyDown={(e) => { if (e.key === "Enter" && textValue.trim()) { addText(textValue, 0.3); setTextValue(""); } }} />
              <button className={btn} disabled={!textValue.trim()} onClick={() => { addText(textValue, 0.3); setTextValue(""); }}>
                <Type className="h-4 w-4" /> Add
              </button>
            </div>
            <div className="flex items-center gap-2" role="group" aria-label="Text colour">
              {INK_COLORS.map((c) => (
                <button key={c} onClick={() => setTextColor(c)} aria-label={`Text colour ${c}`} aria-pressed={textColor === c} className={cn("h-5 w-5 rounded-full border-2", textColor === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} />
              ))}
            </div>
            {saved.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Your saved signatures</p>
                <div className="flex flex-wrap gap-2">
                  {saved.map((s, i) => (
                    <span key={i} className="group relative">
                      <button onClick={() => addStamp(s, 0.28)} className="rounded-md border border-border bg-white p-1 hover:border-primary" aria-label="Place this saved signature">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.dataUrl} alt="" className="h-9 max-w-24 object-contain" />
                      </button>
                      <button aria-label="Forget this signature" onClick={() => { const next = saved.filter((_, j) => j !== i); setSaved(next); persistSaved(next); }} className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-white group-hover:flex">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {creating && (
            <Card className="space-y-3 p-4">
              <SignaturePad onCreate={onSignature} label="Place on the page" />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 rounded border-border accent-primary" /> Remember it on this device (stored only in this browser)
              </label>
            </Card>
          )}

          <Card className="space-y-3 p-4">
            <p className="text-sm font-medium">On the document ({stamps.length})</p>
            {stamps.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add a signature, the date or some text, then drag it into place.</p>
            ) : (
              <ul className="space-y-2">
                {stamps.map((s) => (
                  <li key={s.id} className={cn("flex items-center gap-2 rounded-lg border p-1.5", selected === s.id ? "border-primary bg-primary/5" : "border-border")}>
                    <button onClick={() => { setSelected(s.id); if (s.scope === "page" && s.page !== page) void goTo(s.page); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.image.dataUrl} alt="" className="h-8 w-16 shrink-0 rounded bg-white object-contain p-0.5" />
                      <span className="truncate text-xs text-muted-foreground">{s.scope === "all" ? "Every page" : s.scope === "last" ? "Last page" : `Page ${s.page + 1}`}</span>
                    </button>
                    <button aria-label="Remove" onClick={() => remove(s.id)} className="rounded p-1 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedStamp && (
              <label className="flex items-center gap-2 text-xs">
                Show on
                <select value={selectedStamp.scope} onChange={(e) => update(selectedStamp.id, { scope: e.target.value as Scope, page: selectedStamp.scope === "page" ? selectedStamp.page : page })} className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm">
                  <option value="page">This page only</option>
                  <option value="all">Every page</option>
                  <option value="last">The last page</option>
                </select>
              </label>
            )}
          </Card>

          <DigitalSignPanel onChange={setDigital} />

          <Button onClick={exportPdf} disabled={exporting || (stamps.length === 0 && !digital)} className="w-full">
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Signing…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Download signed PDF
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { void pdfRef.current?.destroy(); pdfRef.current = null; setBytes(null); setStamps([]); setPageUrl(null); }}>
            <X className="h-3.5 w-3.5" /> Choose another PDF
          </Button>
          <p className="text-xs text-muted-foreground">Drawn signatures are pictures on the page. Turn on “Add a digital signature” for a cryptographic one that PDF readers can verify and that detects later edits.</p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className={btn} onClick={() => void goTo(page - 1)} disabled={page === 0} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm tabular-nums">
              Page{" "}
              <input type="number" min={1} max={sizes.length} value={page + 1} onChange={(e) => void goTo(Number(e.target.value) - 1)} aria-label="Page number" className="mx-1 h-8 w-16 rounded-md border border-border bg-background px-2 text-center" />
              of {sizes.length}
            </span>
            <button className={btn} onClick={() => void goTo(page + 1)} disabled={page >= sizes.length - 1} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-auto text-xs text-muted-foreground">Drag to move · corner to resize · arrow keys to nudge · Delete to remove</span>
          </div>
          <div className="overflow-auto rounded-lg border border-border bg-muted/30 p-3">
            <div ref={stageRef} className="relative mx-auto select-none bg-white shadow-md" style={{ maxWidth: 900, aspectRatio: size ? `${size.width} / ${size.height}` : "3 / 4" }} onPointerDown={() => setSelected(null)}>
              {pageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pageUrl} alt={`Page ${page + 1}`} draggable={false} className="absolute inset-0 h-full w-full" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {stampsOnPage.map((s) => {
                const active = selected === s.id;
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    aria-label="Stamp — drag to move"
                    onPointerDown={(e) => begin(e, s, "move")}
                    onPointerMove={dragMove}
                    onPointerUp={dragEnd}
                    onKeyDown={(e) => onKey(e, s)}
                    onFocus={() => setSelected(s.id)}
                    className={cn("absolute cursor-move touch-none outline-none", active && "outline-2 outline-dashed outline-primary")}
                    style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.image.dataUrl} alt="" draggable={false} className="block w-full" />
                    {active && (
                      <>
                        <span onPointerDown={(e) => begin(e, s, "resize")} onPointerMove={dragMove} onPointerUp={dragEnd} className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-primary" aria-hidden />
                        <button type="button" aria-label="Remove stamp" onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(s.id)} className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <ToolHistoryList ref={historyRef} toolSlug="sign-pdf" />
    </div>
  );
}
