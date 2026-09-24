/**
 * vitest.config.ts
 * ----------------
 * Tells Vitest to resolve @demolition-labs/engine directly from its TypeScript
 * source files instead of requiring a compiled dist/ build.
 * This makes `pnpm test` work without running `pnpm build` first.
 */

import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@demolition-labs/engine": path.resolve(
        __dirname,
        "../engine/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
  },
});
