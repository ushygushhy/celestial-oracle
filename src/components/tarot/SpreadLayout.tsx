"use client";
import type { CSSProperties } from "react";
import type { Spread } from "@/lib/tarot/spreads";
import { CARD_BY_ID } from "@/lib/tarot/deck";
import { CardBack, CardFace } from "./CardFace";

export interface Drawn { id: string; reversed: boolean }

/** Lays out drawn cards for a spread; clicking a face-down card flips it. */
export function SpreadLayout({ spread, drawn, revealed, onReveal, width = 120, dealKey }: {
  spread: Spread;
  drawn: Drawn[];
  revealed: boolean[];
  onReveal?: (i: number) => void;
  width?: number;
  dealKey?: string | number;
}) {
  const W = width, H = width * 1.6;
  const xs = spread.positions.map((p) => p.x), ys = spread.positions.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const boxW = (Math.max(...xs) - minX) * W + W + (spread.positions.some((p) => p.rotate) ? H - W : 0);
  const boxH = (Math.max(...ys) - minY) * W + H;
  return (
    <div className="relative mx-auto" style={{ width: boxW, height: boxH + 26 }}>
      {spread.positions.map((pos, i) => {
        const d = drawn[i];
        if (!d) return null;
        const card = CARD_BY_ID.get(d.id)!;
        const left = (pos.x - minX) * W, top = (pos.y - minY) * W;
        const style = { left, top, width: W, height: H, animationDelay: `${i * 110}ms`, "--dx": `${boxW / 2 - left - W / 2}px`, "--dy": `${-top - 60}px`, zIndex: pos.rotate ? 2 : 1 } as CSSProperties;
        return (
          <div key={`${dealKey}-${i}`} className="tarot-slot" style={style}>
            <div style={{ position: "absolute", inset: 0, transform: pos.rotate ? `rotate(${pos.rotate}deg)` : undefined }}>
              <button className="tarot-card" onClick={() => onReveal?.(i)} aria-label={revealed[i] ? `${pos.label}: ${card.name}${d.reversed ? " reversed" : ""}` : `Reveal ${pos.label}`}>
                <div className={`tarot-inner ${revealed[i] ? "is-flipped" : ""}`}>
                  <div className="tarot-face"><CardBack /></div>
                  <div className="tarot-face" style={{ transform: `rotateY(180deg)${d.reversed ? " rotate(180deg)" : ""}` }}><CardFace card={card} /></div>
                </div>
              </button>
            </div>
            {!pos.rotate && (
              <p className="engraved absolute left-0 right-0 truncate text-center text-[0.58rem] text-muted" style={{ top: H + 4 }}>{pos.label}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
