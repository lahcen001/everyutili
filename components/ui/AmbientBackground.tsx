/**
 * Site-wide ambient background: slow-drifting radial glow orbs plus an
 * optional faint grid, built entirely from CSS (`.bg-site-gradient` /
 * `.bg-grid-dots` in globals.css) — no canvas, no JS animation loop, so
 * there's no per-frame CPU/GPU cost beyond a GPU-composited background
 * position animation the browser already optimizes. `.bg-site-gradient`
 * itself carries `position: fixed` + `pointer-events: none`, so it stays
 * out of document flow and never intercepts clicks; `aria-hidden` keeps
 * this out of the accessibility tree since it's purely decorative.
 */
export function AmbientBackground({ grid = false }: { grid?: boolean }) {
  return (
    <div className="bg-site-gradient" aria-hidden="true">
      {grid && <div className="bg-grid-dots absolute inset-0" />}
    </div>
  );
}
