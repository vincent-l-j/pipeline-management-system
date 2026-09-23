import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { defineBrowserCommand, playwright } from "@vitest/browser-playwright";

// Separate from vitest.config.ts so `npm test` stays runnable without a Chromium.
export default defineConfig({
  plugins: [react()],
  test: {
    // vitest.config.ts excludes this glob, so the two suites run side by side.
    include: ["src/**/*.browser.test.tsx"],
    globals: true,
    setupFiles: ["./src/test/browser-setup.ts"],
    clearMocks: true,
    // Vitest stubs CSS imports by default; without this the suite asserts nothing.
    css: true,
    browser: {
      enabled: true,
      headless: true,
      // The failure message names the layout fact; a PNG adds nothing.
      screenshotFailures: false,
      provider: playwright(),
      instances: [
        {
          browser: "chromium",
          // 360px is the design floor the mobile work was built to.
          viewport: { width: 360, height: 780 },
        },
      ],
      commands: {
        // jsdom applies no stylesheet, so it has no print media to evaluate.
        emulateMedia: defineBrowserCommand<[media: "screen" | "print"]>(
          async ({ page }, media) => {
            await page.emulateMedia({ media });
          },
        ),
      },
    },
  },
});
