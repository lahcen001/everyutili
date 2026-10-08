/**
 * Draws a QR code as SVG from its module matrix, so we can offer many looks: dot shapes, eye shapes,
 * gradients, a centre logo, a title and a frame. Everything is in "module" units inside one viewBox.
 */

export type ModuleStyle = "square" | "rounded" | "dots" | "classy" | "diamond";
export type EyeStyle = "square" | "rounded" | "circle" | "leaf";
export type FrameStyle = "none" | "line" | "box" | "bar";
export type TitlePosition = "top" | "bottom";
export type LogoShape = "square" | "rounded" | "circle";

export interface QrDesign {
  moduleStyle: ModuleStyle;
  eyeStyle: EyeStyle;
  fg: string;
  /** second gradient colour; same as fg = solid */
  fg2: string;
  eyeColor: string;
  bg: string;
  margin: number;
  logo: { url: string; ratio: number; shape: LogoShape; plate: boolean } | null;
  title: { text: string; position: TitlePosition; color: string } | null;
  frame: FrameStyle;
  frameLabel: string;
}

export const DEFAULT_DESIGN: QrDesign = {
  moduleStyle: "square",
  eyeStyle: "square",
  fg: "#000000",
  fg2: "#000000",
  eyeColor: "#000000",
  bg: "#ffffff",
  margin: 2,
  logo: null,
  title: null,
  frame: "none",
  frameLabel: "SCAN ME",
};

export interface QrPreset {
  id: string;
  label: string;
  design: Partial<QrDesign>;
}

export const PRESETS: QrPreset[] = [
  { id: "classic", label: "Classic", design: { moduleStyle: "square", eyeStyle: "square", fg: "#000000", fg2: "#000000", eyeColor: "#000000", bg: "#ffffff", frame: "none" } },
  { id: "soft", label: "Soft", design: { moduleStyle: "rounded", eyeStyle: "rounded", fg: "#111827", fg2: "#111827", eyeColor: "#111827", bg: "#ffffff", frame: "none" } },
  { id: "dots", label: "Dots", design: { moduleStyle: "dots", eyeStyle: "circle", fg: "#0f172a", fg2: "#0f172a", eyeColor: "#0f172a", bg: "#ffffff", frame: "none" } },
  { id: "ocean", label: "Ocean", design: { moduleStyle: "rounded", eyeStyle: "rounded", fg: "#0369a1", fg2: "#0f172a", eyeColor: "#0c4a6e", bg: "#f0f9ff", frame: "none" } },
  { id: "forest", label: "Forest", design: { moduleStyle: "classy", eyeStyle: "leaf", fg: "#166534", fg2: "#14532d", eyeColor: "#14532d", bg: "#f0fdf4", frame: "none" } },
  { id: "sunset", label: "Sunset", design: { moduleStyle: "dots", eyeStyle: "circle", fg: "#e11d48", fg2: "#7c3aed", eyeColor: "#be123c", bg: "#fff7ed", frame: "none" } },
  { id: "label", label: "Scan me", design: { moduleStyle: "rounded", eyeStyle: "rounded", fg: "#1e1b4b", fg2: "#1e1b4b", eyeColor: "#1e1b4b", bg: "#ffffff", frame: "bar" } },
  { id: "diamond", label: "Diamond", design: { moduleStyle: "diamond", eyeStyle: "square", fg: "#7c2d12", fg2: "#b45309", eyeColor: "#7c2d12", bg: "#fffbeb", frame: "line" } },
];

export const escapeXml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const num = (v: number) => Number(v.toFixed(3));

function inEye(x: number, y: number, n: number): boolean {
  return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
}

/** A rounded rectangle path with an individual radius on each corner (tl, tr, br, bl). */
function roundRect(x: number, y: number, w: number, h: number, r: [number, number, number, number]): string {
  const [tl, tr, br, bl] = r;
  return `M${num(x + tl)} ${num(y)}h${num(w - tl - tr)}a${tr} ${tr} 0 0 1 ${tr} ${tr}v${num(h - tr - br)}a${br} ${br} 0 0 1 ${-br} ${br}h${num(-(w - br - bl))}a${bl} ${bl} 0 0 1 ${-bl} ${-bl}v${num(-(h - bl - tl))}a${tl} ${tl} 0 0 1 ${tl} ${-tl}z`;
}

function moduleShape(style: ModuleStyle, x: number, y: number, dark: (dx: number, dy: number) => boolean): string {
  switch (style) {
    case "square":
      return `M${x} ${y}h1v1h-1z`;
    case "rounded":
      return roundRect(x + 0.04, y + 0.04, 0.92, 0.92, [0.3, 0.3, 0.3, 0.3]);
    case "dots": {
      const r = 0.43;
      return `M${num(x + 0.5 - r)} ${num(y + 0.5)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;
    }
    case "classy": {
      // square where neighbours connect, rounded on the free corners (top-left & bottom-right feel "leafy")
      const r = 0.42;
      const left = dark(-1, 0), right = dark(1, 0), up = dark(0, -1), down = dark(0, 1);
      return roundRect(x, y, 1, 1, [!left && !up ? r : 0, !up && !right ? r * 0.3 : 0, !right && !down ? r : 0, !down && !left ? r * 0.3 : 0]);
    }
    case "diamond":
      return `M${num(x + 0.5)} ${num(y - 0.02)}L${num(x + 1.02)} ${num(y + 0.5)}L${num(x + 0.5)} ${num(y + 1.02)}L${num(x - 0.02)} ${num(y + 0.5)}z`;
  }
}

function eyePath(style: EyeStyle, ox: number, oy: number): string {
  // outer 7×7 ring, inner 3×3 pupil (even-odd fill makes the ring)
  const outer = (() => {
    switch (style) {
      case "square": return `M${ox} ${oy}h7v7h-7z`;
      case "rounded": return roundRect(ox, oy, 7, 7, [2, 2, 2, 2]);
      case "circle": return `M${ox + 3.5} ${oy}a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0 -7z`;
      case "leaf": return roundRect(ox, oy, 7, 7, [3, 0.4, 3, 0.4]);
    }
  })();
  const ring = (() => {
    switch (style) {
      case "square": return `M${ox + 1} ${oy + 1}v5h5v-5z`;
      case "rounded": return roundRect(ox + 1, oy + 1, 5, 5, [1.2, 1.2, 1.2, 1.2]);
      case "circle": return `M${ox + 3.5} ${oy + 1}a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0 -5z`;
      case "leaf": return roundRect(ox + 1, oy + 1, 5, 5, [2, 0.2, 2, 0.2]);
    }
  })();
  const pupil = (() => {
    switch (style) {
      case "square": return `M${ox + 2} ${oy + 2}h3v3h-3z`;
      case "rounded": return roundRect(ox + 2, oy + 2, 3, 3, [0.9, 0.9, 0.9, 0.9]);
      case "circle": return `M${ox + 3.5} ${oy + 2}a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0 -3z`;
      case "leaf": return roundRect(ox + 2, oy + 2, 3, 3, [1.5, 0.2, 1.5, 0.2]);
    }
  })();
  return `${outer}${ring}${pupil}`;
}

export interface QrMatrix {
  size: number;
  /** row-major, 1 = dark */
  data: ArrayLike<number>;
}

/** Estimated text width in module units (system sans-serif is about 0.56 em per character). */
const textWidth = (text: string, size: number) => text.length * size * 0.56;

export interface RenderedQr {
  svg: string;
  width: number;
  height: number;
}

export function renderQr(matrix: QrMatrix, design: QrDesign, uid = "q"): RenderedQr {
  const n = matrix.size;
  const dark = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && matrix.data[y * n + x] === 1;
  const m = Math.max(0, design.margin);
  const code = n + m * 2;

  // room for a title and a frame label
  const titleText = design.title?.text.trim() ?? "";
  const hasTitle = titleText.length > 0;
  const titleSize = Math.max(2.6, code * 0.075);
  const titleBox = hasTitle ? titleSize * 2 : 0;
  const barBox = design.frame === "bar" ? Math.max(5, code * 0.13) : 0;
  const pad = design.frame === "none" ? 0 : code * 0.045;
  const top = pad + (hasTitle && design.title?.position === "top" ? titleBox : 0);
  const bottom = pad + (hasTitle && design.title?.position !== "top" ? titleBox : 0) + barBox;
  const W = code + pad * 2;
  const H = code + top + bottom;

  const useGradient = design.fg2.toLowerCase() !== design.fg.toLowerCase();
  const fill = useGradient ? `url(#${uid}g)` : design.fg;

  // logo clearing: skip modules under the logo
  const logo = design.logo;
  const box = logo ? n * logo.ratio : 0;
  const lx0 = (n - box) / 2 - 0.5;
  const lx1 = (n + box) / 2 + 0.5;
  const underLogo = (x: number, y: number) => !!logo && x + 1 > lx0 && x < lx1 && y + 1 > lx0 && y < lx1;

  let body = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!dark(x, y) || inEye(x, y, n) || underLogo(x, y)) continue;
      body += moduleShape(design.moduleStyle, x, y, (dx, dy) => dark(x + dx, y + dy) && !inEye(x + dx, y + dy, n) && !underLogo(x + dx, y + dy));
    }
  }
  const eyeFill = design.eyeColor;
  const eyes = [[0, 0], [n - 7, 0], [0, n - 7]].map(([ox, oy]) => eyePath(design.eyeStyle, ox, oy)).join("");

  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(W)} ${num(H)}" width="${num(W)}" height="${num(H)}" shape-rendering="geometricPrecision">`;
  if (useGradient) out += `<defs><linearGradient id="${uid}g" gradientUnits="userSpaceOnUse" x1="${num(pad + m)}" y1="${num(top + m)}" x2="${num(pad + m + n)}" y2="${num(top + m + n)}"><stop offset="0" stop-color="${design.fg}"/><stop offset="1" stop-color="${design.fg2}"/></linearGradient></defs>`;
  out += `<rect width="${num(W)}" height="${num(H)}" fill="${design.bg}"${design.frame === "box" || design.frame === "bar" ? ` rx="${num(code * 0.05)}"` : ""}/>`;

  if (design.frame === "line" || design.frame === "box" || design.frame === "bar") {
    out += `<rect x="${num(pad / 2)}" y="${num(pad / 2)}" width="${num(W - pad)}" height="${num(H - pad)}" rx="${num(code * 0.045)}" fill="none" stroke="${design.fg}" stroke-width="${num(Math.max(0.35, code * 0.012))}"/>`;
  }

  const ox = pad + m;
  const oy = top + m;
  out += `<g transform="translate(${num(ox)} ${num(oy)})"><path d="${body}" fill="${fill}"/><path d="${eyes}" fill="${eyeFill}" fill-rule="evenodd"/></g>`;

  if (logo) {
    const cx = ox + n / 2;
    const cy = oy + n / 2;
    const s = box;
    const plate = logo.plate ? s * 1.18 : 0;
    const clip = logo.shape === "circle" ? `<clipPath id="${uid}c"><circle cx="${num(cx)}" cy="${num(cy)}" r="${num(s / 2)}"/></clipPath>` : logo.shape === "rounded" ? `<clipPath id="${uid}c"><rect x="${num(cx - s / 2)}" y="${num(cy - s / 2)}" width="${num(s)}" height="${num(s)}" rx="${num(s * 0.2)}"/></clipPath>` : "";
    if (clip) out += `<defs>${clip}</defs>`;
    if (logo.plate) {
      out += logo.shape === "circle" ? `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(plate / 2)}" fill="${design.bg}"/>` : `<rect x="${num(cx - plate / 2)}" y="${num(cy - plate / 2)}" width="${num(plate)}" height="${num(plate)}" rx="${num(logo.shape === "rounded" ? plate * 0.2 : 0)}" fill="${design.bg}"/>`;
    }
    out += `<image href="${escapeXml(logo.url)}" x="${num(cx - s / 2)}" y="${num(cy - s / 2)}" width="${num(s)}" height="${num(s)}" preserveAspectRatio="xMidYMid slice"${clip ? ` clip-path="url(#${uid}c)"` : ""}/>`;
  }

  if (hasTitle && design.title) {
    const y = design.title.position === "top" ? pad + titleBox * 0.68 : top + code + titleBox * 0.68;
    const avail = W - pad * 2 - 1;
    const fit = textWidth(titleText, titleSize) > avail ? ` textLength="${num(avail)}" lengthAdjust="spacingAndGlyphs"` : "";
    out += `<text x="${num(W / 2)}" y="${num(y)}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-weight="700" font-size="${num(titleSize)}" fill="${design.title.color}"${fit}>${escapeXml(titleText)}</text>`;
  }

  if (design.frame === "bar" && barBox > 0) {
    const label = design.frameLabel.trim();
    const by = H - barBox - pad * 0.5;
    out += `<rect x="${num(pad)}" y="${num(by)}" width="${num(W - pad * 2)}" height="${num(barBox - pad * 0.1)}" rx="${num(code * 0.03)}" fill="${design.fg}"/>`;
    if (label) {
      const size = barBox * 0.5;
      const avail = W - pad * 4;
      const fit = textWidth(label, size) > avail ? ` textLength="${num(avail)}" lengthAdjust="spacingAndGlyphs"` : "";
      out += `<text x="${num(W / 2)}" y="${num(by + (barBox - pad * 0.1) * 0.66)}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-weight="800" font-size="${num(size)}" letter-spacing="0.4" fill="${design.bg}"${fit}>${escapeXml(label)}</text>`;
    }
  }

  out += "</svg>";
  return { svg: out, width: W, height: H };
}
