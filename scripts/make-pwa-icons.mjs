// Draws the app icon (the extension's wrench on an indigo rounded square) at PWA sizes.
// Usage: node scripts/make-pwa-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const WRENCH = "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z";

/** `maskable` icons keep the artwork inside the central safe zone and fill the whole square. */
const svg = (size, maskable) => {
  const radius = maskable ? 0 : size * 0.22;
  const scale = (size * (maskable ? 0.5 : 0.58)) / 24;
  const offset = (size - 24 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#635bff"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${WRENCH}"/></g>
  </svg>`;
};

mkdirSync("public/icons", { recursive: true });
for (const [file, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
]) {
  await sharp(Buffer.from(svg(size, maskable))).png().toFile(`public/icons/${file}`);
  console.log("wrote public/icons/" + file);
}
