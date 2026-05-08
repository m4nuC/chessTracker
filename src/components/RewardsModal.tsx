"use client";

import { useState } from "react";

export function RewardsModal({ count, children }: { count: number, children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="gift-button" onClick={() => setOpen(true)} aria-label="Récompenses" type="button">
        <span className="gift-icon">🎁</span>
        {count > 0 && <span className="gift-badge">{count}</span>}
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Récompenses débloquées</h2>
              <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fermer" type="button">✕</button>
            </div>
            <div className="modal-body">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
