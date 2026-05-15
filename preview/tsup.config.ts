import { defineConfig } from "tsup";
import { getBuildEnv } from "../scripts/build-env";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  bundle: true,
  minify: false,
  clean: true,
  sourcemap: true,
  noExternal: [/.*/], // Bundle ALL dependencies inline - required for GitHub Actions runners
  platform: "node",
  target: "node20",
  env: getBuildEnv(),
});
