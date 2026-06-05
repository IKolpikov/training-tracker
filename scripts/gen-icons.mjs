// Rasterise public/icon.svg into the PNG sizes browsers + iOS + Android expect.
// Run: `node scripts/gen-icons.mjs` after changing the SVG.

import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pub  = resolve(here, "..", "public");

// "any" icons — full-bleed runner, edge to edge. Used for splash, favicon, iOS.
const anySvg = readFileSync(resolve(pub, "icon.svg"));
const anySizes = [
  { size: 32,  name: "favicon-32.png"       },
  { size: 180, name: "apple-touch-icon.png" }, // iOS home screen
  { size: 192, name: "icon-192.png"         }, // Android / manifest
  { size: 512, name: "icon-512.png"         }, // Splash / install
];

// "maskable" icons — same figure but with 10% safe-zone padding so Android
// adaptive shapes (circle / squircle / teardrop) can't crop a limb.
const maskSvg = readFileSync(resolve(pub, "icon-maskable.svg"));
const maskSizes = [
  { size: 192, name: "icon-maskable-192.png" },
  { size: 512, name: "icon-maskable-512.png" },
];

for (const { size, name } of anySizes) {
  await sharp(anySvg).resize(size, size).png().toFile(resolve(pub, name));
  console.log(`✓ ${name} (${size}×${size})`);
}
for (const { size, name } of maskSizes) {
  await sharp(maskSvg).resize(size, size).png().toFile(resolve(pub, name));
  console.log(`✓ ${name} (${size}×${size}, maskable)`);
}
