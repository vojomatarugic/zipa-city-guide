import { useEffect } from "react";

/** Syncs the browser tab title; use strings from `utils/documentTitle` for consistency. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
