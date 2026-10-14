import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  // Bundle the shared workspace package (it ships TypeScript source).
  noExternal: ["@droplet/shared"],
});
