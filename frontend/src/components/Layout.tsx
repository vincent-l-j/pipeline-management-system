import { ReactNode, useEffect, useState } from "react";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  useEffect(() => {
    if (!drawerOpen) return;
    // Listen on the document so Escape works wherever focus sits in the drawer.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-navy-700 bg-navy-900 px-4 text-white md:hidden">
        <button
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
          className="fixed inset-0 z-30 bg-navy-950/60 md:hidden"
        />
      )}

      <div
        id="app-navigation"
        // `invisible` keeps the closed drawer out of the tab order and the
        // accessibility tree; the desktop sidebar is always visible.
        className={`fixed inset-y-0 left-0 z-40 w-64 transition-transform md:visible md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <Sidebar onNavigate={closeDrawer} />
      </div>

      <main className="p-4 md:ml-64 md:p-8">{children}</main>
    </div>
  );
}
