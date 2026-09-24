import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { defineBrowserCommand, playwright } from "@vitest/browser-playwright";

/** A viewport coordinate as the test frame measures it, not the host page. */
interface Point {
  x: number;
  y: number;
}

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
      // touch sequence, compat mouse events and all. It is also all that is
      // needed: adding isMobile changes nothing measurable here, because the
      // tester page already carries width=device-width and hasTouch alone already
      // reports pointer: coarse and hover: none.
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
        // A finger that touches down, rolls a few pixels and lifts. Playwright's
        // tap cannot express the roll, so this drops to CDP — which addresses the
        // top-level page, while callers measure inside the tester iframe, so the
        // frame's own offset has to be added back or the touch lands elsewhere.
        touchDrag: defineBrowserCommand<
          [from: Point, to: Point, steps?: number]
        >(async ({ page, iframe }, from, to, steps = 10) => {
          const frame = await iframe.owner().boundingBox();
          const originX = frame?.x ?? 0;
          const originY = frame?.y ?? 0;
          const at = (x: number, y: number) => [
            { x: originX + x, y: originY + y, radiusX: 8, radiusY: 8 },
          ];
          const cdp = await page.context().newCDPSession(page);
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: at(from.x, from.y),
          });
          for (let i = 1; i <= steps; i++) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: at(
                from.x + ((to.x - from.x) * i) / steps,
                from.y + ((to.y - from.y) * i) / steps,
              ),
            });
            // Real frames, so Chromium's gesture recogniser sees a drag.
            await new Promise((r) => setTimeout(r, 16));
          }
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await cdp.detach();
        }),
        // Sideways scrolling as a user asks for it, over the element itself. A
        // wheel rather than a finger: synthesised touch events reach the page
        // but never the compositor, so they pan nothing — and a wheel is
        // refused by a clipped container exactly as a finger is, which is the
        // difference these tests are about.
        scrollX: defineBrowserCommand<[selector: string, by: number]>(
          async ({ page, iframe }, selector, by) => {
            await iframe.locator(selector).hover();
            await page.mouse.wheel(by, 0);
          },
        ),
      },
    },
  },
});
