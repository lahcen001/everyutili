"use client";

import { useTranslations } from "next-intl";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eraser, ImagePlus, Maximize2, Minimize2, RotateCw, Save, Shuffle, Trophy, UserMinus, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { Confetti } from "@/components/tools/random-decision/Confetti";

const PALETTES: { id: string; label: string; colors: string[] }[] = [
  { id: "vibrant", label: "Vibrant", colors: ["#7c74ff", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#a855f7"] },
  { id: "ocean", label: "Ocean", colors: ["#0ea5e9", "#2563eb", "#06b6d4", "#4f46e5", "#0891b2", "#3b82f6", "#0d9488", "#6366f1"] },
  { id: "sunset", label: "Sunset", colors: ["#f97316", "#ef4444", "#f59e0b", "#e11d48", "#fb7185", "#d946ef", "#ea580c", "#be123c"] },
  { id: "candy", label: "Candy", colors: ["#f472b6", "#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#818cf8", "#2dd4bf"] },
  { id: "forest", label: "Forest", colors: ["#16a34a", "#15803d", "#65a30d", "#0f766e", "#4d7c0f", "#059669", "#047857", "#84cc16"] },
];

const SPIN_DURATION_MS = 6000;
const LOGO_KEY = "everyutili_wheel_logo";

/** Reads an image file and returns a PNG data URL scaled to fit 320px, keeping transparency. */
async function fileToLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const max = 320;
    const w = img.naturalWidth || max;
    const h = img.naturalHeight || max;
    const scale = Math.min(1, max / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function parseEntries(input: string): string[] {
  return input
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function polar(center: number, angleDeg: number, radius: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
}

function wedgePath(center: number, radius: number, start: number, end: number): string {
  if (end - start >= 359.999) {
    return `M ${center - radius} ${center} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`;
  }
  const a = polar(center, start, radius);
  const b = polar(center, end, radius);
  return `M ${center} ${center} L ${a.x} ${a.y} A ${radius} ${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
}

interface WheelProps {
  entries: string[];
  colors: string[];
  size: number;
  rotation: number;
  spinning: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  pointerRef: React.RefObject<SVGGElement | null>;
  onSpin: () => void;
  canSpin: boolean;
  logo: string | null;
  hubScale: number;
}

function Wheel({ entries, colors, size, rotation, spinning, svgRef, pointerRef, onSpin, canSpin, logo, hubScale }: WheelProps) {
  const center = size / 2;
  const rim = Math.max(10, size * 0.045);
  const radius = center - rim - 2;
  const n = entries.length;
  const wedge = n > 0 ? 360 / n : 0;
  const fontSize = Math.max(11, Math.min(size / 15, (radius * 0.9 * Math.sin((Math.PI / Math.max(n, 2)) * 0.85)) * 1.15, size / 17));
  const maxChars = Math.max(4, Math.floor((radius * 0.62) / (fontSize * 0.56)));
  const bulbs = 28;
  const hub = size * hubScale;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <style>{`@keyframes wheel-bulb{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
      {/* soft glow under the wheel */}
      <div className="absolute inset-0 rounded-full bg-primary/30 blur-3xl" style={{ opacity: spinning ? 0.9 : 0.45, transition: "opacity .6s" }} aria-hidden />

      {/* rotating wedges */}
      <svg
        ref={svgRef}
        className="absolute inset-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.1, 0.55, 0.12, 1)` : undefined,
        }}
        aria-label="Wheel"
      >
        <defs>
          {colors.map((c, i) => (
            <radialGradient key={i} id={`wg-${i}`} gradientUnits="userSpaceOnUse" cx={center} cy={center} r={radius}>
              <stop offset="0%" stopColor={c} stopOpacity="0.75" />
              <stop offset="55%" stopColor={c} />
              <stop offset="100%" stopColor={c} stopOpacity="0.92" />
            </radialGradient>
          ))}
          <radialGradient id="wheel-shade" gradientUnits="userSpaceOnUse" cx={center} cy={center} r={radius}>
            <stop offset="70%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
          </radialGradient>
        </defs>
        {n === 0 ? (
          <circle cx={center} cy={center} r={radius} fill="var(--color-muted, #e5e7eb)" />
        ) : (
          <>
            {entries.map((entry, i) => {
              const start = i * wedge;
              const labelAngle = start + wedge / 2;
              const label = entry.length > maxChars ? `${entry.slice(0, maxChars - 1)}…` : entry;
              return (
                <g key={i}>
                  <path d={wedgePath(center, radius, start, start + wedge)} fill={`url(#wg-${i % colors.length})`} stroke="rgba(255,255,255,0.55)" strokeWidth={n > 1 ? 1.5 : 0} />
                  <text
                    x={center + radius * 0.92}
                    y={center}
                    transform={`rotate(${labelAngle - 90} ${center} ${center})`}
                    fill="#fff"
                    fontSize={fontSize}
                    fontWeight={700}
                    textAnchor="end"
                    dominantBaseline="central"
                    style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.28)", strokeWidth: 2.5, strokeLinejoin: "round" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            <circle cx={center} cy={center} r={radius} fill="url(#wheel-shade)" pointerEvents="none" />
          </>
        )}
      </svg>

      {/* static rim, bulbs, pointer */}
      <svg className="pointer-events-none absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id="rim-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="pin-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx={center} cy={center} r={center - rim / 2} fill="none" stroke="url(#rim-grad)" strokeWidth={rim} />
        <circle cx={center} cy={center} r={center - rim - 1} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
        {Array.from({ length: bulbs }, (_, i) => {
          const p = polar(center, (i * 360) / bulbs, center - rim / 2);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={rim * 0.24}
              fill={i % 2 === 0 ? "#fffbeb" : "#fef3c7"}
              style={{
                filter: "drop-shadow(0 0 3px #fde047)",
                animation: spinning ? `wheel-bulb 0.5s ${i % 2 ? "0s" : "0.25s"} infinite` : undefined,
              }}
            />
          );
        })}
        <g ref={pointerRef} style={{ transformOrigin: `${center}px ${rim + 6}px`, transformBox: "view-box" }} filter="url(#pin-shadow)">
          <path
            d={`M ${center - size * 0.04} ${rim * 0.15} L ${center + size * 0.04} ${rim * 0.15} L ${center} ${rim + size * 0.085} Z`}
            fill="url(#pin-grad)"
            stroke="#fff"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <circle cx={center} cy={rim * 0.15 + size * 0.012} r={size * 0.011} fill="#fff" opacity="0.9" />
        </g>
      </svg>

      {/* centre hub = spin button */}
      <button
        type="button"
        onClick={onSpin}
        disabled={!canSpin}
        aria-label={spinning ? "Spinning" : "Spin the wheel"}
        className={cn(
          "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-white text-primary-foreground shadow-xl outline-none transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/40 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100",
          logo ? "bg-white" : "bg-gradient-to-b from-primary to-primary/70 disabled:opacity-80"
        )}
        style={{ width: hub, height: hub }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" draggable={false} className="h-full w-full object-contain p-[10%]" />
        ) : (
          <span className="font-extrabold uppercase tracking-wider" style={{ fontSize: Math.max(10, hub * 0.27) }}>
            {spinning ? <RotateCw className="animate-spin" style={{ width: hub * 0.42, height: hub * 0.42 }} /> : "Spin"}
          </span>
        )}
      </button>
    </div>
  );
}

export default function WheelSpinner() {
  const t = useTranslations("ui");
  useTrackTool("wheel-spinner");
  const [input, setInput] = usePersisted("everyutili_wheel_entries", "Pizza\nSushi\nTacos\nBurgers\nSalad\nPasta");
  const [paletteId, setPaletteId] = usePersisted("everyutili_wheel_palette", "vibrant");
  const [removeWinner, setRemoveWinner] = React.useState(false);
  const [rotation, setRotation] = React.useState(0);
  const [spinning, setSpinning] = React.useState(false);
  const [winner, setWinner] = React.useState<{ name: string; color: string; index: number } | null>(null);
  const [showWinner, setShowWinner] = React.useState(false);
  const [celebrate, setCelebrate] = React.useState(0);
  const [past, setPast] = React.useState<string[]>([]);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [pseudoFs, setPseudoFs] = React.useState(false);
  const [size, setSize] = React.useState(340);
  const [logo, setLogo] = React.useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem(LOGO_KEY);
    } catch {
      return null;
    }
  });
  const [hubScale, setHubScale] = React.useState(0.2);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const areaRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const pointerRef = React.useRef<SVGGElement>(null);
  const timer = React.useRef<number | null>(null);

  const entries = React.useMemo(() => parseEntries(input), [input]);
  const colors = (PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]).colors;
  const wedgeAngle = entries.length > 0 ? 360 / entries.length : 0;
  const canSpin = !spinning && entries.length >= 2;
  const isFs = fullscreen || pseudoFs;

  // fit the wheel to its area
  React.useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize(Math.max(220, Math.floor(Math.min(w, h) - 16)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFs]);

  // real browser fullscreen, kept in sync with the Esc key
  React.useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  React.useEffect(() => {
    if (!pseudoFs) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPseudoFs(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [pseudoFs]);

  const toggleFullscreen = async () => {
    if (isFs) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setPseudoFs(false);
      return;
    }
    const el = stageRef.current;
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* fall through to the in-page fullscreen */
      }
    }
    setPseudoFs(true);
  };

  // pointer "tick" as each wedge passes under it
  React.useEffect(() => {
    if (!spinning) return;
    let frame = 0;
    let last = -1;
    const loop = () => {
      const svg = svgRef.current;
      if (svg && wedgeAngle > 0) {
        const m = new DOMMatrixReadOnly(getComputedStyle(svg).transform);
        const angle = (Math.atan2(m.b, m.a) * 180) / Math.PI;
        const under = Math.floor((((360 - angle) % 360) + 360) % 360 / wedgeAngle);
        if (last !== -1 && under !== last) {
          pointerRef.current?.animate([{ transform: "rotate(-24deg)" }, { transform: "rotate(0deg)" }], { duration: 150, easing: "ease-out" });
        }
        last = under;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [spinning, wedgeAngle]);

  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const spin = (list: string[] = entries) => {
    if (spinning || list.length < 2) return;
    const angle = 360 / list.length;
    setSpinning(true);
    setShowWinner(false);
    setWinner(null);

    const index = Math.floor(Math.random() * list.length);
    // Put the chosen wedge's centre under the pointer (top). `rotation % 360`
    // is stripped first so repeated spins always land on the chosen entry.
    const jitter = (Math.random() - 0.5) * angle * 0.6;
    const base = rotation - (((rotation % 360) + 360) % 360);
    const target = base + (6 + Math.floor(Math.random() * 3)) * 360 + (360 - (index * angle + angle / 2) - jitter);
    setRotation(target);

    timer.current = window.setTimeout(() => {
      setSpinning(false);
      setWinner({ name: list[index], color: colors[index % colors.length], index });
      setShowWinner(true);
      setPast((p) => [list[index], ...p].slice(0, 8));
      setCelebrate((c) => c + 1);
    }, SPIN_DURATION_MS + 100);
  };

  const spinAgain = (remove: boolean) => {
    if (remove && winner) {
      const next = entries.filter((_, i) => i !== winner.index);
      setInput(next.join("\n"));
      setShowWinner(false);
      if (next.length >= 2) window.setTimeout(() => spin(next), 250);
      return;
    }
    setShowWinner(false);
    window.setTimeout(() => spin(), 150);
  };

  const handleSave = async () => {
    if (!winner) return;
    await saveToolResult("wheel-spinner", {
      title: winner.name,
      summary: `Spun from ${entries.length} options: ${entries.join(", ")}`,
    });
    historyRef.current?.refresh();
  };

  const chooseLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file (PNG, JPG, SVG, WebP).");
      return;
    }
    try {
      const data = await fileToLogo(file);
      setLogo(data);
      setLogoError(null);
      try {
        localStorage.setItem(LOGO_KEY, data);
      } catch {
        /* storage unavailable: the logo still works for this visit */
      }
    } catch {
      setLogoError("Could not read that image.");
    }
  };
  const removeLogo = () => {
    setLogo(null);
    try {
      localStorage.removeItem(LOGO_KEY);
    } catch {
      /* ignore */
    }
  };

  const shuffle = () => {
    const a = [...entries];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    setInput(a.join("\n"));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start">
        <Card className="space-y-4 p-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Wheel entries</span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={9}
              placeholder="One entry per line…"
              className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {entries.length} entr{entries.length === 1 ? "y" : "ies"}
              {entries.length < 2 && " — at least 2 needed"}
            </p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={shuffle} disabled={entries.length < 2 || spinning}>
                <Shuffle className="h-3.5 w-3.5" /> Shuffle
              </Button>
              <Button size="sm" variant="outline" onClick={() => setInput("")} disabled={!input || spinning}>
                <Eraser className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Colours</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Colour palette">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaletteId(p.id)}
                  aria-pressed={paletteId === p.id}
                  aria-label={p.label}
                  title={p.label}
                  className={cn("flex h-8 w-14 overflow-hidden rounded-lg border-2 transition-transform hover:scale-105", paletteId === p.id ? "border-foreground" : "border-transparent")}
                >
                  {p.colors.slice(0, 5).map((c) => (
                    <span key={c} className="h-full flex-1" style={{ backgroundColor: c }} />
                  ))}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Centre logo</p>
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="Your logo" className="h-full w-full object-contain p-1.5" />
                ) : (
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                )}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted">
                  <ImagePlus className="h-3.5 w-3.5" /> {logo ? "Change" : "Add your logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { void chooseLogo(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {logo && (
                  <Button size="sm" variant="ghost" onClick={removeLogo}>
                    <X className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
            {logo && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Logo size
                <input type="range" min={12} max={32} value={Math.round(hubScale * 100)} onChange={(e) => setHubScale(Number(e.target.value) / 100)} className="flex-1 accent-primary" aria-label="Logo size" />
              </label>
            )}
            {logoError && <p role="alert" className="text-xs text-destructive">{logoError}</p>}
            <p className="text-[11px] text-muted-foreground">Stays on this device only. Click the logo to spin.</p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={removeWinner} onChange={(e) => setRemoveWinner(e.target.checked)} className="h-4 w-4 accent-primary" />
            Offer to remove each winner
          </label>

          {past.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Previous winners</p>
              <div className="flex flex-wrap gap-1.5">
                {past.map((w, i) => (
                  <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div
          ref={stageRef}
          className={cn(
            "relative flex flex-col overflow-hidden border border-border bg-gradient-to-br from-primary/10 via-background to-fuchsia-500/10",
            isFs ? "h-screen w-screen rounded-none border-0 bg-background" : "rounded-2xl",
            pseudoFs && "fixed inset-0 z-[100]"
          )}
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <p className="text-xs font-medium text-muted-foreground">Click the centre or press Spin</p>
            <Button size="sm" variant="outline" onClick={toggleFullscreen} aria-label={isFs ? t("exitFullscreen") : t("fullscreen")}>
              {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {isFs ? t("exitFullscreen") : t("fullscreen")}
            </Button>
          </div>

          <div ref={areaRef} className={cn("flex items-center justify-center p-2", isFs ? "min-h-0 flex-1" : "h-[min(92vw,620px)]")}>
            <Wheel entries={entries} colors={colors} size={size} rotation={rotation} spinning={spinning} svgRef={svgRef} pointerRef={pointerRef} onSpin={() => spin()} canSpin={canSpin} logo={logo} hubScale={hubScale} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-4">
            <Button size="lg" onClick={() => spin()} disabled={!canSpin} className="min-w-40 text-base">
              <RotateCw className={cn("h-4 w-4", spinning && "animate-spin")} />
              {spinning ? "Spinning…" : "Spin the wheel"}
            </Button>
            {winner && !spinning && !showWinner && (
              <Button variant="outline" onClick={() => setShowWinner(true)}>
                <Trophy className="h-4 w-4" /> {winner.name}
              </Button>
            )}
          </div>

          <AnimatePresence>
            {showWinner && winner && (
              <motion.div
                key="winner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 overflow-hidden bg-background/90 p-6 text-center backdrop-blur-md"
                role="dialog"
                aria-label="Winner"
              >
                {/* rotating sunburst */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[170%] -translate-x-1/2 -translate-y-1/2"
                  style={{
                    background: `repeating-conic-gradient(from 0deg, ${winner.color}33 0deg 8deg, transparent 8deg 22deg)`,
                    maskImage: "radial-gradient(circle, black 0%, transparent 62%)",
                    WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 62%)",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
                />
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                  style={{ backgroundColor: winner.color }}
                  animate={{ opacity: [0.25, 0.5, 0.25], scale: [0.9, 1.1, 0.9] }}
                  transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
                />

                <motion.div
                  initial={{ scale: 0, rotate: -25 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-2xl sm:h-28 sm:w-28"
                  style={{ background: `linear-gradient(135deg, #fde68a, #f59e0b)` }}
                >
                  <Trophy className="h-10 w-10 text-amber-900 sm:h-14 sm:w-14" />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="relative text-sm font-bold uppercase tracking-[0.4em] text-muted-foreground sm:text-base"
                >
                  The winner is
                </motion.p>

                <motion.div
                  initial={{ scale: 0.2, opacity: 0, y: 30 }}
                  animate={{ scale: [0.2, 1.12, 1], opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5, times: [0, 0.65, 1], ease: "easeOut" }}
                  className="relative max-w-full rounded-3xl border-4 border-white px-8 py-5 shadow-2xl sm:px-12 sm:py-7"
                  style={{
                    background: `linear-gradient(135deg, ${winner.color}, color-mix(in oklab, ${winner.color} 65%, #000))`,
                    boxShadow: `0 20px 60px ${winner.color}88`,
                  }}
                >
                  <h2
                    className="break-words font-black leading-tight tracking-tight text-white"
                    style={{
                      fontSize: `clamp(2.4rem, ${isFs ? "10vw" : "8vw"}, ${isFs ? "8rem" : "5.5rem"})`,
                      textShadow: "0 3px 0 rgba(0,0,0,0.35), 0 6px 24px rgba(0,0,0,0.35)",
                    }}
                  >
                    {winner.name}
                  </h2>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  className="relative flex flex-wrap items-center justify-center gap-2"
                >
                  <Button size="lg" onClick={() => spinAgain(false)}>
                    <RotateCw className="h-4 w-4" /> Spin again
                  </Button>
                  {removeWinner && entries.length > 2 && (
                    <Button size="lg" variant="outline" onClick={() => spinAgain(true)}>
                      <UserMinus className="h-4 w-4" /> Remove &amp; spin
                    </Button>
                  )}
                  <Button size="lg" variant="outline" onClick={handleSave}>
                    <Save className="h-4 w-4" /> Save
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => setShowWinner(false)} aria-label="Close">
                    <X className="h-4 w-4" /> Close
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          <Confetti fire={celebrate} big className="z-30" />
        </div>
      </div>

      <ToolHistoryList ref={historyRef} toolSlug="wheel-spinner" />
    </div>
  );
}
