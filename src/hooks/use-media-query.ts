"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    list.addEventListener("change", listener);
    return () => list.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
