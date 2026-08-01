import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Keep production assets relative so GitHub Pages continues to work after a
// repository rename or when the runtime is hosted beneath another base path.
const base = process.env.JUANPAGER_BASE ?? "./";

export default defineConfig({
  base,
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        builder: resolve(__dirname, "builder.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
