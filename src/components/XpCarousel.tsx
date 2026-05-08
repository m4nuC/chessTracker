"use client";

import { useRef, useState, useEffect } from "react";

export function XpCarousel({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [jumpBackState, setJumpBackState] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    const wrapper = scrollRef.current;
    if (!wrapper) return;

    function handleScroll() {
      if (!wrapper) return;
      const fill = wrapper.querySelector('.progress-fill') as HTMLElement;
      if (!fill) return;
      
      const wrapperRect = wrapper.getBoundingClientRect();
      const fillRect = fill.getBoundingClientRect();
      
      // We consider the XP point (right edge of the fill bar) out of view if it's significantly outside the wrapper bounds
      if (fillRect.right < wrapperRect.left - 20) {
        setJumpBackState("left");
      } else if (fillRect.right > wrapperRect.right + 20) {
        setJumpBackState("right");
      } else {
        setJumpBackState(null);
      }
    }

    wrapper.addEventListener("scroll", handleScroll);
    setTimeout(handleScroll, 100);
    window.addEventListener("resize", handleScroll);

    // Initial jump to current progress
    setTimeout(() => {
      jumpToCurrent(true);
      setTimeout(handleScroll, 50);
    }, 100);

    return () => {
      wrapper.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  function jumpToCurrent(instant: boolean | React.MouseEvent = false) {
    if (!scrollRef.current) return;
    const wrapper = scrollRef.current;
    const fill = wrapper.querySelector('.progress-fill') as HTMLElement;
    if (!fill) return;
    
    const wrapperRect = wrapper.getBoundingClientRect();
    const fillRect = fill.getBoundingClientRect();
    const relativeRight = fillRect.right - wrapperRect.left + wrapper.scrollLeft;
    
    const targetScroll = relativeRight - wrapper.clientWidth / 2;
    wrapper.scrollTo({ left: targetScroll, behavior: instant === true ? "auto" : "smooth" });
  }

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const wrapper = scrollRef.current;
    
    let markers = Array.from(wrapper.querySelectorAll('.reward-marker')) as HTMLElement[];
    if (markers.length === 0) {
      const amount = wrapper.clientWidth * 0.75;
      wrapper.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
      return;
    }

    // Sort markers visually from left to right to ensure sequential navigation
    markers.sort((a, b) => a.offsetLeft - b.offsetLeft);

    const currentScroll = wrapper.scrollLeft;
    const viewCenter = currentScroll + wrapper.clientWidth / 2;

    if (dir === "right") {
      const nextMarker = markers.find(m => m.offsetLeft > viewCenter + 10);
      if (nextMarker) {
        const targetScroll = nextMarker.offsetLeft - wrapper.clientWidth / 2;
        wrapper.scrollTo({ left: targetScroll, behavior: "smooth" });
      } else {
        wrapper.scrollBy({ left: wrapper.clientWidth * 0.75, behavior: "smooth" });
      }
    } else {
      const prevMarker = [...markers].reverse().find(m => m.offsetLeft < viewCenter - 10);
      if (prevMarker) {
        const targetScroll = prevMarker.offsetLeft - wrapper.clientWidth / 2;
        wrapper.scrollTo({ left: targetScroll, behavior: "smooth" });
      } else {
        wrapper.scrollBy({ left: -wrapper.clientWidth * 0.75, behavior: "smooth" });
      }
    }
  }

  return (
    <div className="xp-carousel">
      <button className="carousel-arrow" onClick={() => scroll("left")} aria-label="Défiler à gauche" type="button">
        &lt;
      </button>
      <div className="progress-scroll-wrapper" ref={scrollRef}>
        {children}
      </div>
      <button className="carousel-arrow" onClick={() => scroll("right")} aria-label="Défiler à droite" type="button">
        &gt;
      </button>

      {jumpBackState && (
        <button 
          onClick={jumpToCurrent}
          style={{
            position: 'absolute',
            bottom: '-2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ffffff',
            border: '1px solid var(--border)',
            padding: '0.4rem 1rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: '600',
            color: 'var(--accent)',
            cursor: 'pointer',
            zIndex: 30,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {jumpBackState === "left" && <span>&larr;</span>}
          Rejoindre l&apos;XP actuel
          {jumpBackState === "right" && <span>&rarr;</span>}
        </button>
      )}
    </div>
  );
}
