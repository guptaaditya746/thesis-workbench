/// <reference types="vitest/config" />
// Vite config for the web app (README, "Web app").
//
// - `npm run dev`: /api is proxied to the FastAPI backend (`webapp serve`, 127.0.0.1:8080 by
//   default; override with WEBAPP_API).
// - `npm run build`: dist/, which the backend serves at /.
// - `npm test`: Vitest in jsdom; MSW in Node answers /api per test.
import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": { target: process.env.WEBAPP_API ?? "http://127.0.0.1:8080", changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 900,
  },
  test: {
    // jsdom, installed by the setup file (src/test/environment.ts says why).
    environment: "./src/test/environment.ts",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // One worker, reused for every file: loading jsdom and the app's modules is slow on the
    // /mnt/c checkout under WSL, so it is done once. Tests reset shared state themselves.
    fileParallelism: false,
    isolate: false,
    testTimeout: 30_000,
  },
})
