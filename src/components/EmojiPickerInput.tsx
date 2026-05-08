"use client";

import { useState, useRef, useEffect } from "react";
import Picker from "emoji-picker-react";

export function EmojiPickerInput({
  name,
  defaultValue = "🏆"
}: {
  name: string;
  defaultValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState(defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <input type="hidden" name={name} value={emoji} />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          fontSize: "1.5rem",
          padding: "0.25rem",
          background: "#ffffff",
          border: "1px solid var(--border)",
          borderRadius: "0.85rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "3.25rem",
          width: "3.25rem"
        }}
      >
        {emoji}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            top: "100%",
            left: 0,
            marginTop: "0.5rem"
          }}
        >
          <Picker
            onEmojiClick={(e) => {
              setEmoji(e.emoji);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
