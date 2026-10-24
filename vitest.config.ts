import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/**/*.test.{ts,tsx}"],
    // next-intl's ESM build imports `next/server` without an extension, which Node's resolver rejects when the package is
    // loaded externally; let Vite resolve it so the real locale middleware runs in src/test/proxy-decisions.test.ts.
    server: { deps: { inline: ["next-intl"] } },
  },
});
