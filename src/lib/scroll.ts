/**
 * Robust scroll-to-top utility for Credify.
 * Scrolls window, documentElement, body, and #root to cover all containers.
 */
export function scrollToTop(behavior: ScrollBehavior = "auto") {
  try {
    window.scrollTo({ top: 0, left: 0, behavior });
  } catch {
    window.scrollTo(0, 0);
  }
  if (document.documentElement) {
    try {
      document.documentElement.scrollTo({ top: 0, left: 0, behavior });
    } catch {
      document.documentElement.scrollTop = 0;
    }
    document.documentElement.scrollTop = 0;
  }
  if (document.body) {
    try {
      document.body.scrollTo({ top: 0, left: 0, behavior });
    } catch {
      document.body.scrollTop = 0;
    }
    document.body.scrollTop = 0;
  }
  const root = document.getElementById("root");
  if (root) {
    try {
      root.scrollTo({ top: 0, left: 0, behavior });
    } catch {
      root.scrollTop = 0;
    }
    root.scrollTop = 0;
  }
}
