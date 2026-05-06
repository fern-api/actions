import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  bundle: true,
  minify: false,
  clean: true,
  sourcemap: false,
  noExternal: [/.*/],
  platform: "node",
  target: "node20",
});
