import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Resolve engine from TypeScript source — no build step required in dev
      "@demolition-labs/engine": path.resolve(__dirname, "../engine/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy WebSocket connections to the game server
      "/room": {
        target: "http://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
      // Proxy health check
      "/health": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      // Proxy replay fetches to MinIO to bypass CORS
      "/demolition-replays": {
        target: "http://localhost:9000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
