import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// GitHub Pages project site base. Change if the repository name differs.
const base = process.env.JUANPAGER_BASE ?? "/juanpager/";

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
