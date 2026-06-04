// Rasterise public/icon.svg into the PNG sizes browsers + iOS + Android expect.
// Run: `node scripts/gen-icons.mjs` after changing the SVG.

import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here   = dirname(fileURLToPath(import.meta.url));
const pub    = resolve(here, "..", "public");
const svgBuf = readFileSync(resolve(pub, "icon.svg"));

const sizes = [
  { size: 32,  name: "favicon-32.png"       },
  { size: 180, name: "apple-touch-icon.png" }, // iOS home screen
  { size: 192, name: "icon-192.png"         }, // Android / manifest
  { size: 512, name: "icon-512.png"         }, // Splash / install
];

for (const { size, name } of sizes) {
  await sharp(svgBuf).resize(size, size).png().toFile(resolve(pub, name));
  console.log(`✓ ${name} (${size}×${size})`);
}
