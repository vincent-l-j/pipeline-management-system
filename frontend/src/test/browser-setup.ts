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

declare module "vitest/internal/browser" {
  interface BrowserCommands {
    emulateMedia: (media: "screen" | "print") => Promise<void>;
  }
}
