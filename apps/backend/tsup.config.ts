import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  // @repo/shared ships TypeScript source, so it has to be bundled rather than
  // left as a runtime import that Node couldn't resolve.
  noExternal: ["@repo/shared"],
});
