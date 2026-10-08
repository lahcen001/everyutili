"use client";

import * as React from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { CalcFrame } from "@/components/tools/calc/CalcFrame";
import { Keypad, type KeyDef } from "@/components/tools/calc/Keypad";
import { useCaretInput } from "@/components/tools/calc/useCaretInput";
import { compile, formatNumber, type AngleMode } from "@/lib/calc/expr";

const COLORS = ["#6366f1", "#f43f5e", "#10b981"];
const EXAMPLES = ["x^2", "sin(x)", "1/x", "sqrt(x)", "abs(x)-2", "x^3-3x"];
interface View { cx: number; cy: number; scale: number }
const HOME: View = { cx: 0, cy: 0, scale: 40 };

function niceStep(minPx: number, scale: number): number {
  const raw = minPx / scale;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

function FnRow({ index, value, onChange, active, onFocus, register, error }: { index: number; value: string; onChange: (v: string) => void; active: boolean; onFocus: () => void; register: (i: number, api: { insert: (t: string) => void; backspace: () => void }) => void; error: boolean }) {
  const { ref, insert, backspace } = useCaretInput(value, onChange);
  React.useEffect(() => {
    register(index, { insert, backspace });
  });
  return (
    <label className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-right font-mono text-sm font-bold" style={{ color: COLORS[index] }}>y{index + 1} =</span>
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} inputMode="none" spellCheck={false} autoComplete="off" placeholder={index === 0 ? "x^2" : "add another function"} aria-label={`Function ${index + 1}`} className={cn("h-11 min-w-0 flex-1 rounded-xl border-2 bg-background px-3 font-mono text-base outline-none", active ? "border-primary ring-4 ring-primary/15" : error ? "border-rose-500/60" : "border-border")} />
    </label>
  );
}

export default function GraphingCalculator() {
  useTrackTool("graphing-calculator");
  const [fns, setFns] = React.useState<string[]>(["x^2-2", "sin(x)*3", ""]);
  const [active, setActive] = React.useState(0);
  const [angle, setAngle] = React.useState<AngleMode>("rad");
  const [view, setView] = React.useState<View>(HOME);
  const [size, setSize] = React.useState({ w: 640, h: 440 });
  const [hover, setHover] = React.useState<number | null>(null);
  const apis = React.useRef<Record<number, { insert: (t: string) => void; backspace: () => void }>>({});
  const wrap = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const drag = React.useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const compiled = React.useMemo(
    () => fns.map((f) => { if (!f.trim()) return { fn: null, bad: false }; try { return { fn: compile(f, { angle }), bad: false }; } catch { return { fn: null, bad: true }; } }),
    [fns, angle]
  );

  React.useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: Math.round(Math.min(560, Math.max(300, el.clientWidth * 0.68))) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = document.documentElement.classList.contains("dark");
    const toX = (wx: number) => size.w / 2 + (wx - view.cx) * view.scale;
    const toY = (wy: number) => size.h / 2 - (wy - view.cy) * view.scale;
    ctx.fillStyle = dark ? "#0b1220" : "#ffffff";
    ctx.fillRect(0, 0, size.w, size.h);

    const step = niceStep(56, view.scale);
    const x0 = view.cx - size.w / 2 / view.scale;
    const x1 = view.cx + size.w / 2 / view.scale;
    const y0 = view.cy - size.h / 2 / view.scale;
    const y1 = view.cy + size.h / 2 / view.scale;
    ctx.font = "11px ui-monospace, monospace";
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(x0 / step) * step; gx <= x1; gx += step) {
      ctx.strokeStyle = dark ? "#1e293b" : "#e5e7eb";
      ctx.beginPath(); ctx.moveTo(toX(gx), 0); ctx.lineTo(toX(gx), size.h); ctx.stroke();
      if (Math.abs(gx) > step / 2) { ctx.fillStyle = dark ? "#94a3b8" : "#6b7280"; ctx.fillText(formatNumber(gx, 6), toX(gx) + 3, Math.min(size.h - 4, Math.max(12, toY(0) + 12))); }
    }
    for (let gy = Math.ceil(y0 / step) * step; gy <= y1; gy += step) {
      ctx.strokeStyle = dark ? "#1e293b" : "#e5e7eb";
      ctx.beginPath(); ctx.moveTo(0, toY(gy)); ctx.lineTo(size.w, toY(gy)); ctx.stroke();
      if (Math.abs(gy) > step / 2) { ctx.fillStyle = dark ? "#94a3b8" : "#6b7280"; ctx.fillText(formatNumber(gy, 6), Math.min(size.w - 30, Math.max(4, toX(0) + 4)), toY(gy) - 3); }
    }
    ctx.strokeStyle = dark ? "#94a3b8" : "#374151";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), size.h); ctx.moveTo(0, toY(0)); ctx.lineTo(size.w, toY(0)); ctx.stroke();

    compiled.forEach(({ fn }, i) => {
      if (!fn) return;
      ctx.strokeStyle = COLORS[i];
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let pen = false;
      let prevY = 0;
      for (let px = 0; px <= size.w; px += 1) {
        const wx = view.cx + (px - size.w / 2) / view.scale;
        const wy = fn(wx);
        const py = toY(wy);
        if (Number.isNaN(wy) || !Number.isFinite(py) || Math.abs(py - prevY) > size.h * 1.5 && pen) {
          pen = false;
          prevY = py;
          continue;
        }
        if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
        prevY = py;
      }
      ctx.stroke();
    });

    if (hover !== null) {
      const wx = view.cx + (hover - size.w / 2) / view.scale;
      ctx.strokeStyle = dark ? "#64748b" : "#9ca3af";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hover, 0); ctx.lineTo(hover, size.h); ctx.stroke();
      ctx.setLineDash([]);
      compiled.forEach(({ fn }, i) => {
        if (!fn) return;
        const wy = fn(wx);
        if (Number.isNaN(wy)) return;
        ctx.fillStyle = COLORS[i];
        ctx.beginPath(); ctx.arc(hover, toY(wy), 5, 0, Math.PI * 2); ctx.fill();
      });
    }
  }, [compiled, view, size, hover]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (drag.current) {
      const d = drag.current;
      setView((v) => ({ ...v, cx: d.cx - (e.clientX - d.x) / v.scale, cy: d.cy + (e.clientY - d.y) / v.scale }));
      setHover(null);
    } else setHover(e.clientX - rect.left);
  };
  const zoom = (f: number) => setView((v) => ({ ...v, scale: Math.min(4000, Math.max(2, v.scale * f)) }));

  const press = (key: string) => {
    const api = apis.current[active];
    if (!api) return;
    if (key === "BACK") return api.backspace();
    if (key === "C") return setFns((f) => f.map((x, i) => (i === active ? "" : x)));
    api.insert(key);
  };
  const k = (label: string, value = label, kind: KeyDef["kind"] = "num"): KeyDef => ({ label, value, kind });
  const rows: KeyDef[][] = [
    [k("x", "x", "mod"), k("(", "(", "op"), k(")", ")", "op"), k("^", "^", "op"), k("⌫", "BACK", "act")],
    [k("sin", "sin(", "fn"), k("cos", "cos(", "fn"), k("tan", "tan(", "fn"), k("√", "sqrt(", "fn"), k("C", "C", "act")],
    [k("7"), k("8"), k("9"), k("÷", "/", "op"), k("ln", "ln(", "fn")],
    [k("4"), k("5"), k("6"), k("×", "*", "op"), k("log", "log(", "fn")],
    [k("1"), k("2"), k("3"), k("−", "-", "op"), k("|x|", "abs(", "fn")],
    [k("0"), k("."), k("π", "pi", "fn"), k("+", "+", "op"), k("e", "e", "fn")],
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-3">
        <Card className="overflow-hidden p-0">
          <div ref={wrap} className="relative w-full" style={{ height: size.h }}>
            <canvas ref={canvas} style={{ width: size.w, height: size.h, touchAction: "none", cursor: "crosshair" }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)} onPointerLeave={() => setHover(null)} onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)} aria-label="Graph. Drag to move, scroll to zoom." />
            <div className="absolute right-2 top-2 flex flex-col gap-1.5">
              <Button size="icon" variant="outline" className="h-9 w-9 bg-background/90" onClick={() => zoom(1.4)} aria-label="Zoom in"><Plus className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="h-9 w-9 bg-background/90" onClick={() => zoom(1 / 1.4)} aria-label="Zoom out"><Minus className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="h-9 w-9 bg-background/90" onClick={() => setView(HOME)} aria-label="Reset view"><RotateCcw className="h-4 w-4" /></Button>
            </div>
            {hover !== null && (
              <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-background/90 px-2.5 py-1.5 font-mono text-xs shadow ring-1 ring-border">
                <div>x = {formatNumber(view.cx + (hover - size.w / 2) / view.scale, 6)}</div>
                {compiled.map(({ fn }, i) => fn && <div key={i} style={{ color: COLORS[i] }}>y{i + 1} = {formatNumber(fn(view.cx + (hover - size.w / 2) / view.scale), 6)}</div>)}
              </div>
            )}
          </div>
        </Card>
        <Card className="space-y-2 p-3">
          {fns.map((f, i) => (
            <FnRow key={i} index={i} value={f} onChange={(v) => setFns((cur) => cur.map((x, j) => (j === i ? v : x)))} active={active === i} onFocus={() => setActive(i)} register={(idx, api) => { apis.current[idx] = api; }} error={compiled[i].bad} />
          ))}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">Try:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setFns((cur) => cur.map((x, j) => (j === active ? ex : x)))} className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs hover:border-primary hover:text-primary">{ex}</button>
            ))}
            <button onClick={() => setAngle((a) => (a === "rad" ? "deg" : "rad"))} className="ms-auto rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase" aria-label="Switch degrees or radians">{angle}</button>
          </div>
        </Card>
      </div>
      <CalcFrame className="lg:self-start"><Keypad rows={rows} cols={5} onPress={press} /></CalcFrame>
    </div>
  );
}
