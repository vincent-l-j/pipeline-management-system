import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@hello-pangea/dnd": path.resolve(__dirname, "./src/test/mocks/dnd.ts"),
    },
  },
  test: {
    environment: "jsdom",
    // The browser suite shares this suffix; jsdom cannot satisfy it.
    exclude: ["**/node_modules/**", "**/dist/**", "src/**/*.browser.test.tsx"],
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
  },
});
