import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // The devcontainer reaches its siblings by service name, and Vite's host
    // check 403s a Host header it was not told to expect. Without this, `app`
    // has no working address for the dev server and ends up running its own.
    allowedHosts: ["frontend"],
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
