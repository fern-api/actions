import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/sync.ts" },
  format: ["cjs"],
  outDir: "dist",
  bundle: true,
  minify: false,
  clean: true,
  sourcemap: false,
  noExternal: [/.*/], // Bundle ALL dependencies inline - required for GitHub Actions runners
  platform: "node",
  target: "node20",
});
