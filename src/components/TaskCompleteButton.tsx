"use client";

import { useRef, useState } from "react";

export function TaskCompleteButton({
  pointsPerUnit,
  label
}: {
  pointsPerUnit: number;
  label: React.ReactNode;
}) {
  const [bubbles, setBubbles] = useState<number[]>([]);
  const counter = useRef(0);

  function spawn() {
    const id = ++counter.current;
    setBubbles((b) => [...b, id]);
    setTimeout(() => setBubbles((b) => b.filter((x) => x !== id)), 1200);
  }

  return (
    <span className="task-button-wrap">
      <button type="submit" className="task-button" onClick={spawn}>
        {label}
      </button>
      {bubbles.map((id) => (
        <span key={id} className="xp-bubble">
          +{pointsPerUnit} XP
        </span>
      ))}
    </span>
  );
}
