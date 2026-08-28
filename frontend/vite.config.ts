import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        // Right for both container workflows, since Vite runs inside the
        // `frontend` container in each. The env var is the escape hatch for
        // running Vite natively on the host, where `backend` does not resolve.
        target: process.env.VITE_API_PROXY_TARGET ?? "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});
