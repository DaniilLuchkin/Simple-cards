import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        // Main Mini App + a standalone SRS-card design playground at /srs-demo.html.
        main: resolve(__dirname, "index.html"),
        "srs-demo": resolve(__dirname, "srs-demo.html"),
      },
    },
  },
});
