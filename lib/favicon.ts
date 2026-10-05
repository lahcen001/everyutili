export interface IconImage {
  size: number;
  png: Uint8Array;
}

/** Build a .ico that embeds PNG images (supported by every current browser and Windows since Vista). */
export function buildIco(images: IconImage[]): Uint8Array {
  const count = images.length;
  const headerSize = 6 + 16 * count;
  const total = headerSize + images.reduce((n, i) => n + i.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, count, true);
  let offset = headerSize;
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    out[e] = img.size >= 256 ? 0 : img.size;
    out[e + 1] = img.size >= 256 ? 0 : img.size;
    out[e + 2] = 0; // palette
    out[e + 3] = 0;
    view.setUint16(e + 4, 1, true); // colour planes
    view.setUint16(e + 6, 32, true); // bits per pixel
    view.setUint32(e + 8, img.png.length, true);
    view.setUint32(e + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.length;
  });
  return out;
}

export interface ManifestOptions {
  name: string;
  shortName: string;
  themeColor: string;
  backgroundColor: string;
}

export function buildManifest(o: ManifestOptions): string {
  return JSON.stringify(
    {
      name: o.name,
      short_name: o.shortName || o.name,
      icons: [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      theme_color: o.themeColor,
      background_color: o.backgroundColor,
      display: "standalone",
    },
    null,
    2
  );
}

export function buildHtmlSnippet(themeColor: string): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${themeColor}">`,
  ].join("\n");
}

export type FitMode = "cover" | "contain";

/** Where the source is drawn inside a square of `size`, honouring fit mode and padding (0–40 %). */
export function placeSource(srcW: number, srcH: number, size: number, fit: FitMode, paddingPercent: number) {
  const pad = (Math.min(Math.max(paddingPercent, 0), 40) / 100) * size;
  const inner = size - pad * 2;
  if (fit === "cover") {
    const s = Math.min(srcW, srcH);
    return { sx: (srcW - s) / 2, sy: (srcH - s) / 2, sw: s, sh: s, dx: pad, dy: pad, dw: inner, dh: inner };
  }
  const scale = inner / Math.max(srcW, srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (size - dw) / 2, dy: (size - dh) / 2, dw, dh };
}
