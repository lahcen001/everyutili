"use client";

import * as React from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  shape: "rect" | "circle";
  /** ms after the effect starts before this particle is released */
  delay: number;
}

const COLORS = ["#7c74ff", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"];
const GRAVITY = 0.12;
const PARTICLE_COUNT = 120;
const DURATION_MS = 2600;
const BIG_DURATION_MS = 5200;

/**
 * A short canvas-based confetti burst, triggered whenever `fire` changes to
 * a new truthy value (e.g. incrementing a counter each time a winner is
 * picked). Self-contained — no external library — since the site avoids
 * adding a dependency for a single decorative effect. Renders as a
 * pointer-events-none overlay sized to its parent, so it can be dropped into
 * any relatively-positioned container without affecting layout.
 */
export function Confetti({ fire, big = false, className }: { fire: number; big?: boolean; className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const frameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (fire === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? canvas.clientWidth;
    const height = parent?.clientHeight ?? canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const scale = big ? Math.max(1, Math.min(width, height) / 520) : 1;
    const count = big ? 320 : PARTICLE_COUNT;
    const duration = big ? BIG_DURATION_MS : DURATION_MS;
    const particles: Particle[] = Array.from({ length: count }, (_, i) => {
      if (big) {
        // three waves: left cannon, right cannon, then a centre burst
        const wave = i % 3;
        const fromLeft = wave === 0;
        const fromRight = wave === 1;
        const spread = (Math.random() - 0.5) * 0.9;
        const angle = fromLeft ? -Math.PI / 3 + spread : fromRight ? (-2 * Math.PI) / 3 + spread : -Math.PI / 2 + spread * 1.6;
        const speed = (9 + Math.random() * 9) * scale;
        return {
          x: fromLeft ? width * 0.04 : fromRight ? width * 0.96 : width / 2,
          y: fromLeft || fromRight ? height * 0.95 : height * 0.55,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 24,
          size: (6 + Math.random() * 9) * Math.min(scale, 1.6),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: Math.random() < 0.5 ? "rect" : "circle",
          delay: wave === 2 ? 450 + Math.random() * 300 : Math.random() * 250,
        };
      }
      const angle = Math.random() * Math.PI - Math.PI / 2 - Math.PI / 4;
      const speed = 4 + Math.random() * 6;
      return {
        x: width / 2,
        y: height * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
        size: 5 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() < 0.5 ? "rect" : "circle",
        delay: 0,
      };
    });

    const start = performance.now();

    function draw(now: number) {
      if (!ctx) return;
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (elapsed < p.delay) continue;
        p.vy += big ? GRAVITY * 1.1 : GRAVITY;
        p.vx *= big ? 0.992 : 1;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        const fade = Math.max(0, Math.min(1, (duration - elapsed) / (big ? 1200 : duration)));
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < duration) {
        frameRef.current = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [fire, big]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
