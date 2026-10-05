/** Normalizes any angle to 0, 90, 180 or 270 (PDF /Rotate values can be negative or exceed 360). */
export function normalizeAngle(angle: number): number {
  const snapped = Math.round(angle / 90) * 90;
  return ((snapped % 360) + 360) % 360;
}

/** The page's existing rotation plus a user rotation, normalized. */
export function addRotation(existing: number, delta: number): number {
  return normalizeAngle(existing + delta);
}

/**
 * Converts a point given in the page's *displayed* orientation (origin bottom-left, as the viewer shows
 * it) to PDF user space for a page with the given /Rotate. `width`/`height` are the unrotated page size.
 */
export function visualToUser(sx: number, sy: number, width: number, height: number, pageRotation: number): { x: number; y: number } {
  switch (normalizeAngle(pageRotation)) {
    case 90:
      return { x: width - sy, y: sx };
    case 180:
      return { x: width - sx, y: height - sy };
    case 270:
      return { x: sy, y: height - sx };
    default:
      return { x: sx, y: sy };
  }
}
