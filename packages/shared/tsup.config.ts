import { defineConfig } from "tsup";
import { getBuildEnv } from "../../scripts/build-env";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  env: getBuildEnv(),
});
