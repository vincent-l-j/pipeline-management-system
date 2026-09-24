import "../index.css";

// Zeroed so tests assert what renders, never how long the drawer takes to slide.
const withoutMotion = document.createElement("style");
withoutMotion.textContent = `*, *::before, *::after {
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
}`;
document.head.append(withoutMotion);

interface Point {
  x: number;
  y: number;
}

declare module "vitest/internal/browser" {
  interface BrowserCommands {
    emulateMedia: (media: "screen" | "print") => Promise<void>;
    tap: (selector: string) => Promise<void>;
    touchDrag: (from: Point, to: Point, steps?: number) => Promise<void>;
  }
}
