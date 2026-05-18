import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll to the top on every route change (path or search).
 * - Targets window plus common scrollable containers (html, body, #root).
 * - Uses 'auto' so the jump is instant and feels native on mobile.
 * - Skips when the URL contains a hash (anchor navigation).
 */
const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) return;

    // Disable browser scroll restoration (back/forward) for SPA feel.
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      try {
        window.history.scrollRestoration = "manual";
      } catch {
        /* noop */
      }
    }

    const scrollAll = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {
        window.scrollTo(0, 0);
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const root = document.getElementById("root");
      if (root) root.scrollTop = 0;
    };

    // Run now and on next frame (covers layouts that mount after route change).
    scrollAll();
    const raf = requestAnimationFrame(scrollAll);
    return () => cancelAnimationFrame(raf);
  }, [pathname, search, hash]);

  return null;
};

export default ScrollToTop;
