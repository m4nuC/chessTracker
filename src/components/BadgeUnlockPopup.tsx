"use client";

import { useEffect, useRef, useState } from "react";
import type { Badge } from "@/lib/db";

export function BadgeUnlockPopup({ badges }: { badges: Badge[] }) {
  const [unlockedBadges, setUnlockedBadges] = useState<Badge[]>([]);
  const prevEarnedIds = useRef<Set<number>>(new Set());
  const initialRender = useRef(true);

  useEffect(() => {
    const currentEarnedIds = new Set(badges.filter((b) => b.earned).map((b) => b.id));

    if (initialRender.current) {
      prevEarnedIds.current = currentEarnedIds;
      initialRender.current = false;
      return;
    }

    const newUnlocked: Badge[] = [];
    badges.forEach((b) => {
      if (b.earned && !prevEarnedIds.current.has(b.id)) {
        newUnlocked.push(b);
      }
    });

    if (newUnlocked.length > 0) {
      setUnlockedBadges((prev) => [...prev, ...newUnlocked]);
    }

    prevEarnedIds.current = currentEarnedIds;
  }, [badges]);

  useEffect(() => {
    if (unlockedBadges.length > 0) {
      const timer = setTimeout(() => {
        setUnlockedBadges((prev) => prev.slice(1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [unlockedBadges]);

  if (unlockedBadges.length === 0) return null;

  return (
    <div className="badge-popup-container">
      {unlockedBadges.map((badge, index) => (
        <div 
          key={`${badge.id}-${index}`} 
          className="badge-popup"
          onClick={() => setUnlockedBadges(prev => prev.filter(b => b !== badge))}
        >
          <div className="badge-popup-icon">{badge.icon}</div>
          <div className="badge-popup-text">
            <strong>Nouveau badge débloqué !</strong>
            <span>{badge.name}</span>
            <small>+{badge.xp} XP</small>
          </div>
        </div>
      ))}
    </div>
  );
}
