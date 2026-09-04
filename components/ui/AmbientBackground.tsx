/**
 * Site-wide ambient background: slow-drifting radial glow orbs plus an
 * optional faint grid, built entirely from CSS (`.bg-site-gradient` /
 * `.bg-grid-dots` in globals.css) — no canvas, no JS animation loop.
 * The drift is a `transform: translate3d()` animation on an oversized
 * `::before` layer, which browsers can run purely on the compositor thread
 * (no per-frame repaint) — see the comment on `.bg-site-gradient` in
 * globals.css for why this matters: this component is mounted once in the
 * root layout, so it animates continuously on every page for as long as the
 * tab stays open. `.bg-site-gradient` itself carries `position: fixed` +
 * `pointer-events: none`, so it stays out of document flow and never
 * intercepts clicks; `aria-hidden` keeps this out of the accessibility tree
 * since it's purely decorative.
 */
export function AmbientBackground({ grid = false }: { grid?: boolean }) {
  return (
    <div className="bg-site-gradient" aria-hidden="true">
      {grid && <div className="bg-grid-dots absolute inset-0" />}
    </div>
  );
}
