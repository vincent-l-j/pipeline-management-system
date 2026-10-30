import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

// Tailwind's `md`, where the drawer gives way to the fixed sidebar.
const DESKTOP_QUERY = "(min-width: 768px)";

// Each page renders its own shell, so choosing a destination in the drawer
// usually unmounts this one before focus can come back to its toggle. The
// shell the navigation lands on — a new one, or this one on the same page —
// finishes the handoff.
let focusToggleAfterNavigation = false;

function focusableIn(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ];
}

export default function Layout({ children }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  // Memoised so the effects can depend on it without re-subscribing.
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    const drawer = drawerRef.current;
    const toggle = toggleRef.current;
    if (!drawerOpen || !drawer) return;

    focusableIn(drawer)[0]?.focus();

    // Listen on the document so the keys work wherever focus sits.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableIn(drawer);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // Focus outside the drawer (the app bar, or nothing) re-enters it too.
      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !drawer.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Every close route passes through here. Above `md` the toggle is not
      // rendered and focus() is a no-op, which leaves focus in the sidebar.
      toggle?.focus();
    };
  }, [drawerOpen, closeDrawer]);

  const handleNavigate = useCallback(() => {
    focusToggleAfterNavigation = true;
    closeDrawer();
  }, [closeDrawer]);

  const { key: locationKey } = useLocation();
  useEffect(() => {
    if (!focusToggleAfterNavigation) return;
    focusToggleAfterNavigation = false;
    toggleRef.current?.focus();
  }, [locationKey]);

  useEffect(() => {
    // A phone rotated past `md` has no drawer to hold the page behind.
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) closeDrawer();
    };
    desktop.addEventListener("change", handleChange);
    return () => {
      desktop.removeEventListener("change", handleChange);
    };
  }, [closeDrawer]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* print:hidden — index.css hides `aside`, which never covered this bar. */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-navy-700 bg-navy-900 px-4 text-white print:hidden md:hidden">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => {
            setDrawerOpen((open) => !open);
          }}
          aria-expanded={drawerOpen}
          aria-controls="app-navigation"
          aria-label="Menu"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-xl transition-colors hover:bg-navy-800"
        >
          ☰
        </button>
        <span className="text-lg font-bold tracking-tight">Rozetta</span>
      </header>

      {drawerOpen && (
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close navigation"
          className="fixed inset-0 z-20 bg-navy-950/60 md:hidden"
        />
      )}

      <div
        ref={drawerRef}
        id="app-navigation"
        // `invisible` keeps the closed drawer out of the tab order and the
        // accessibility tree; the desktop sidebar is always visible.
        // The drawer opens below the app bar, so the toggle stays tappable and
        // keeps matching its aria-expanded state; at md there is no app bar.
        // Transitioning visibility on close holds it visible for the duration,
        // so the slide-out plays before it leaves the tab order. Only on close:
        // opening through the same transition starts it at `hidden`, which
        // refuses the focus the shell moves in.
        className={`fixed bottom-0 left-0 top-14 z-30 w-64 print:hidden md:visible md:top-0 md:translate-x-0 ${
          drawerOpen
            ? "translate-x-0 transition-transform"
            : "invisible -translate-x-full transition-[transform,visibility]"
        }`}
      >
        <Sidebar onNavigate={handleNavigate} />
      </div>

      <main className="p-4 md:ml-64 md:p-8">{children}</main>
    </div>
  );
}
