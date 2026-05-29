import { useEffect, useRef } from "react";
import { scrollToTop } from "@/lib/scroll";

/**
 * Scrolls to top whenever any dependency changes.
 * Skips the first mount so initial page loads don't fight with ScrollToTop.
 */
export function useScrollToTop(deps: React.DependencyList, behavior: ScrollBehavior = "auto") {
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    scrollToTop(behavior);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
