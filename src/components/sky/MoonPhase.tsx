/** Engraved-style Moon disc lit according to the Sun–Moon elongation (northern-hemisphere view). */
export function MoonPhase({ elongation, size = 96 }: { elongation: number; size?: number }) {
  const r = 40, cx = 50, cy = 50;
  const e = ((elongation % 360) + 360) % 360;
  const c = Math.cos((e * Math.PI) / 180);
  const rx = Math.round(r * Math.abs(c) * 100) / 100;
  const waxing = e < 180;
  const outerSweep = waxing ? 1 : 0;
  const crescent = c > 0;
  const termSweep = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0;
  const lit = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label={`Moon, ${Math.round(((1 - c) / 2) * 100)}% illuminated`}>
      <defs>
        <pattern id="moon-stipple" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.45" fill="var(--wheel-line-faint)" />
        </pattern>
      </defs>
      <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="var(--rule)" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r={r} fill="var(--wheel-center)" stroke="var(--wheel-line)" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r={r} fill="url(#moon-stipple)" />
      {e > 0.5 && e < 359.5 && <path d={lit} fill="var(--color-parchment-200)" opacity="0.92" />}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent)" strokeWidth="0.8" />
    </svg>
  );
}
