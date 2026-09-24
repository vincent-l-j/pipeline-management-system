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
      // hasTouch is what makes page.tap() legal and makes a tap dispatch the real
      // touch sequence, compat mouse events and all. isMobile is deliberately off:
      // it switches Chromium to a 980px layout viewport for pages with no viewport
      // meta, which is every test page here, and that would silently move the
      // suite off its 360px floor.
      provider: playwright({ contextOptions: { hasTouch: true } }),
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
        // A real touchscreen tap, not a click: userEvent.click drives the mouse,
        // which is the one input device these tests are not about.
        tap: defineBrowserCommand<[selector: string]>(
          async ({ iframe }, selector) => {
            await iframe.locator(selector).tap();
          },
        ),
        touchDrag: defineBrowserCommand<
          [x1: number, y1: number, x2: number, y2: number]
        >(async ({ page }, x1, y1, x2, y2) => {
          const steps = 10;
          const cdp = await page.context().newCDPSession(page);
          const at = (x: number, y: number) => [
            { x, y, radiusX: 8, radiusY: 8 },
          ];
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: at(x1, y1),
          });
          for (let i = 1; i <= steps; i++) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: at(
                x1 + ((x2 - x1) * i) / steps,
                y1 + ((y2 - y1) * i) / steps,
              ),
            });
            await new Promise((r) => setTimeout(r, 16));
          }
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await cdp.detach();
        }),
      },
    },
  },
});
