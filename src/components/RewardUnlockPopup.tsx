"use client";

import { useEffect, useRef, useState } from "react";
import type { Reward } from "@/lib/db";

export function RewardUnlockPopup({ rewards }: { rewards: Reward[] }) {
  const [unlockedRewards, setUnlockedRewards] = useState<Reward[]>([]);
  const prevUnlocks = useRef<Record<number, number>>({});
  const initialRender = useRef(true);

  useEffect(() => {
    const currentUnlocks: Record<number, number> = {};
    rewards.forEach(r => currentUnlocks[r.id] = r.timesUnlocked);

    if (initialRender.current) {
      prevUnlocks.current = currentUnlocks;
      initialRender.current = false;
      return;
    }

    const newUnlocked: Reward[] = [];
    rewards.forEach((r) => {
      const prev = prevUnlocks.current[r.id] || 0;
      if (r.timesUnlocked > prev) {
        newUnlocked.push(r);
      }
    });

    if (newUnlocked.length > 0) {
      setUnlockedRewards((prev) => [...prev, ...newUnlocked]);
    }

    prevUnlocks.current = currentUnlocks;
  }, [rewards]);

  useEffect(() => {
    if (unlockedRewards.length > 0) {
      const timer = setTimeout(() => {
        setUnlockedRewards((prev) => prev.slice(1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [unlockedRewards]);

  if (unlockedRewards.length === 0) return null;

  return (
    <div className="reward-popup-container">
      {unlockedRewards.map((reward, index) => (
        <div
          key={`${reward.id}-${index}`}
          className="reward-popup"
          onClick={() => setUnlockedRewards(prev => prev.filter(r => r !== reward))}
        >
          <div className="reward-popup-icon">{reward.icon}</div>
          <div className="reward-popup-text">
            <strong>Nouvelle récompense !</strong>
            <span>{reward.name}</span>
            <small>Va vite voir tes cadeaux !</small>
          </div>
        </div>
      ))}
    </div>
  );
}
