"use client";
import { useState } from "react";

/** Midnight (gilt on navy, imgs 2–5) ↔ Almanac (ink on rose newsprint, img 1). */
export function ThemeToggle({ theme: initial }: { theme: "midnight" | "almanac" }) {
  const [theme, setTheme] = useState(initial);
  const toggle = () => {
    const next = theme === "midnight" ? "almanac" : "midnight";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <button onClick={toggle} className="engraved flex items-center gap-1.5 text-[0.65rem] text-muted hover:text-accent-bright" title="Switch edition">
      <span className="glyph text-sm">{theme === "midnight" ? "☾" : "☼"}</span>
      {theme === "midnight" ? "Midnight edition" : "Almanac edition"}
    </button>
  );
}
