/**
 * Genera los iconos PNG de la PWA a partir de un SVG.
 * Uso: node scripts/make-icons.mjs   (ya están generados en public/icons)
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const BG = "#282828";

/** Euro partido en dos mitades; `scale` deja margen para iconos "maskable". */
function svg(size, scale) {
  const s = (size * scale) / 64;
  const offset = (size - 64 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${s})">
    <path d="M32 8a24 24 0 0 0 0 48z" fill="#fabd2f"/>
    <path d="M32 8a24 24 0 0 1 0 48z" fill="#b8bb26"/>
    <path d="M21 28h20M21 36h20" stroke="${BG}" stroke-width="4" stroke-linecap="round"/>
    <path d="M45 23.5a14 14 0 1 0 0 17" fill="none" stroke="${BG}" stroke-width="4" stroke-linecap="round"/>
  </g>
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, scale: 0.92 },
  { file: "icon-512.png", size: 512, scale: 0.92 },
  { file: "maskable-512.png", size: 512, scale: 0.66 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.8 },
];

await mkdir("public/icons", { recursive: true });
for (const { file, size, scale } of targets) {
  await sharp(Buffer.from(svg(size, scale))).png().toFile(`public/icons/${file}`);
  console.log("generado", file);
}
