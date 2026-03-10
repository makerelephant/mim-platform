import { useEffect } from "react";

/**
 * Re-runs the given callback when the window regains focus
 * or the tab becomes visible again. This ensures list pages
 * show fresh data after the user edits a detail page and
 * navigates back (SPA navigation preserves component state).
 */
export function useRefetchOnFocus(refetch: () => void) {
  useEffect(() => {
    const onFocus = () => refetch();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetch]);
}
