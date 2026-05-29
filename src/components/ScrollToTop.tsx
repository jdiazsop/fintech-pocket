import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollToTop } from "@/lib/scroll";

// Disable browser scroll restoration as early as possible so back/forward
// navigation never restores old scroll positions in this SPA.
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  try {
    window.history.scrollRestoration = "manual";
  } catch {
    /* noop */
  }
}

/**
 * Resets scroll to the top on every route change (path or search).
 * - Uses the shared scrollToTop utility for consistency.
 * - Uses 'auto' so the jump is instant and feels native on mobile.
 * - Skips when the URL contains a hash (anchor navigation).
 */
const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) return;

    // Run immediately and again on next frame (covers layouts that mount after route change).
    scrollToTop("auto");
    const raf = requestAnimationFrame(() => scrollToTop("auto"));
    return () => cancelAnimationFrame(raf);
  }, [pathname, search, hash]);

  return null;
};

export default ScrollToTop;
