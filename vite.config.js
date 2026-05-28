import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// Build id stamped into the bundle so we can verify which build a browser runs.
// Prefer Vercel's commit SHA; fall back to local git; finally a timestamp.
function buildId() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  try { return execSync("git rev-parse --short HEAD").toString().trim(); }
  catch { return "dev-" + Date.now().toString().slice(-6); }
}

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
});
