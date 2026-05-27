"use client";

import { useEffect, useRef } from "react";

export function StreakScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      // Start at the most recent day; the older history is reachable by
      // scrolling left.
      el.scrollLeft = el.scrollWidth;
    }
  }, []);

  return (
    <div className="streak-row" ref={ref}>
      {children}
    </div>
  );
}
