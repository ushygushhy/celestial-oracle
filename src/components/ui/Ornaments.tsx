/**
 * Engraved ornaments derived from the reference images:
 *  - Sunburst: img5's fine radiating gilt rays around a disc
 *  - Sparkle: the four-pointed stars scattered through img2/img4/img5
 *  - FrameCorners: corner stars on the double gilt frame (img5)
 */
export function Sunburst({ size = 48, rays = 48, className = "" }: { size?: number; rays?: number; className?: string }) {
  const c = 50;
  const lines = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2;
    const long = i % 2 === 0;
    const r1 = 14, r2 = long ? 48 : 34;
    return (
      <line
        key={i}
        x1={c + Math.cos(a) * r1}
        y1={c + Math.sin(a) * r1}
        x2={c + Math.cos(a) * r2}
        y2={c + Math.sin(a) * r2}
        strokeWidth={long ? 0.9 : 0.6}
        opacity={long ? 0.95 : 0.7}
      />
    );
  });
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <g stroke="currentColor" fill="none">
        {lines}
        <circle cx={c} cy={c} r={11} strokeWidth={1.2} />
        <circle cx={c} cy={c} r={8} strokeWidth={0.5} opacity={0.6} />
      </g>
      <circle cx={c} cy={c} r={7.5} fill="currentColor" opacity={0.18} />
    </svg>
  );
}

export function Sparkle({ size = 10, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={className} aria-hidden>
      <path d="M10 0 L11.6 8.4 L20 10 L11.6 11.6 L10 20 L8.4 11.6 L0 10 L8.4 8.4 Z" fill="currentColor" />
    </svg>
  );
}

export function FrameCorners() {
  const pos = ["-top-[5px] -left-[5px]", "-top-[5px] -right-[5px]", "-bottom-[5px] -left-[5px]", "-bottom-[5px] -right-[5px]"];
  return (
    <>
      {pos.map((p) => (
        <span key={p} className={`frame-corner ${p}`}>
          <Sparkle size={9} />
        </span>
      ))}
    </>
  );
}

/** Centered divider: rule · sparkle · rule */
export function StarRule({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-accent ${className}`} aria-hidden>
      <span className="h-px flex-1 bg-rule" />
      <Sparkle size={8} />
      <Sparkle size={12} />
      <Sparkle size={8} />
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
