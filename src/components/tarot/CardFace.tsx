import type { TarotCard, Suit } from "@/lib/tarot/deck";

/**
 * Engraved card faces in the style of the reference collage (img3): dark field,
 * gilt double frame, roman numeral above, engraved name plaque below.
 * Card faces use fixed inks so they look the same in both editions, like real cards.
 */
const GOLD = "#cca874";
const GOLD_BRIGHT = "#e6c992";
const FIELD: Record<string, string> = { major: "#18322b", wands: "#3a1c14", cups: "#132e37", swords: "#232842", pentacles: "#2d2914" };
const INK: Record<string, string> = { major: GOLD_BRIGHT, wands: "#e08a5f", cups: "#7fc1c4", swords: "#b7a8e0", pentacles: "#c9c47a" };
const RANKS = ["", "Ace", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "Page", "Knight", "Queen", "King"];

function Rays({ cx, cy, r1, r2, n = 32, color = GOLD, w = 0.8 }: { cx: number; cy: number; r1: number; r2: number; n?: number; color?: string; w?: number }) {
  return (
    <g stroke={color} strokeWidth={w}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const long = i % 2 === 0;
        const rr = long ? r2 : r1 + (r2 - r1) * 0.6;
        return <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * rr} y2={cy + Math.sin(a) * rr} opacity={long ? 0.95 : 0.6} />;
      })}
    </g>
  );
}

const star = (cx: number, cy: number, R: number, r: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    return `${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`;
  }).join(" ");

export function SuitSymbol({ suit, x, y, s = 1, color }: { suit: Suit; x: number; y: number; s?: number; color: string }) {
  const t = `translate(${x} ${y}) scale(${s})`;
  switch (suit) {
    case "wands":
      return (
        <g transform={t} stroke={color} fill="none" strokeWidth={1.4}>
          <line x1={0} y1={-16} x2={0} y2={16} strokeWidth={2.4} strokeLinecap="round" />
          <ellipse cx={-4} cy={-8} rx={3.2} ry={1.6} transform="rotate(-35 -4 -8)" fill={color} />
          <ellipse cx={4} cy={-2} rx={3.2} ry={1.6} transform="rotate(35 4 -2)" fill={color} />
          <ellipse cx={-4} cy={5} rx={3.2} ry={1.6} transform="rotate(-35 -4 5)" fill={color} />
        </g>
      );
    case "cups":
      return (
        <g transform={t} stroke={color} fill="none" strokeWidth={1.4}>
          <path d="M -11 -12 Q -11 4 0 5 Q 11 4 11 -12 Z" fill={color} fillOpacity={0.25} />
          <line x1={0} y1={5} x2={0} y2={12} />
          <path d="M -7 15 L 7 15 L 4 12 L -4 12 Z" fill={color} fillOpacity={0.4} />
        </g>
      );
    case "swords":
      return (
        <g transform={t} stroke={color} fill="none" strokeWidth={1.3}>
          <path d="M 0 -18 L 2.6 -14 L 2.6 7 L -2.6 7 L -2.6 -14 Z" fill={color} fillOpacity={0.3} />
          <line x1={-8} y1={7} x2={8} y2={7} strokeWidth={2} />
          <line x1={0} y1={7} x2={0} y2={14} strokeWidth={2} />
          <circle cx={0} cy={16} r={1.8} fill={color} />
        </g>
      );
    case "pentacles":
      return (
        <g transform={t} stroke={color} fill="none" strokeWidth={1.3}>
          <circle cx={0} cy={0} r={13} fill={color} fillOpacity={0.15} />
          <circle cx={0} cy={0} r={10.5} />
          <polygon points={star(0, 0.6, 10, 3.9, 5)} />
        </g>
      );
  }
}

/** Pip positions within the central field (x 30–170, y 62–238). */
const PIPS: Record<number, [number, number][]> = {
  2: [[100, 95], [100, 205]],
  3: [[100, 85], [100, 150], [100, 215]],
  4: [[65, 95], [135, 95], [65, 205], [135, 205]],
  5: [[65, 95], [135, 95], [100, 150], [65, 205], [135, 205]],
  6: [[65, 90], [135, 90], [65, 150], [135, 150], [65, 210], [135, 210]],
  7: [[65, 88], [135, 88], [100, 119], [65, 150], [135, 150], [65, 212], [135, 212]],
  8: [[65, 85], [135, 85], [100, 117], [65, 150], [135, 150], [100, 183], [65, 215], [135, 215]],
  9: [[65, 84], [135, 84], [65, 128], [135, 128], [100, 150], [65, 172], [135, 172], [65, 216], [135, 216]],
  10: [[65, 82], [135, 82], [100, 106], [65, 130], [135, 130], [65, 170], [135, 170], [100, 194], [65, 218], [135, 218]],
};

function MajorEmblem({ card }: { card: TarotCard }) {
  const cx = 100, cy = 150;
  switch (card.number) {
    case 19: // The Sun
      return (
        <g>
          <Rays cx={cx} cy={cy} r1={30} r2={66} n={40} color={GOLD_BRIGHT} w={1} />
          <circle cx={cx} cy={cy} r={28} fill="#d9a441" fillOpacity={0.25} stroke={GOLD_BRIGHT} strokeWidth={1.4} />
          <circle cx={cx - 9} cy={cy - 5} r={2} fill={GOLD_BRIGHT} /><circle cx={cx + 9} cy={cy - 5} r={2} fill={GOLD_BRIGHT} />
          <path d={`M ${cx - 9} ${cy + 9} Q ${cx} ${cy + 15} ${cx + 9} ${cy + 9}`} stroke={GOLD_BRIGHT} fill="none" strokeWidth={1.4} />
        </g>
      );
    case 18: // The Moon
      return (
        <g>
          <circle cx={cx} cy={cy} r={50} fill="none" stroke={GOLD} strokeWidth={0.6} strokeDasharray="2 4" />
          <path d={`M ${cx + 6} ${cy - 40} A 40 40 0 1 0 ${cx + 6} ${cy + 40} A 30 30 0 1 1 ${cx + 6} ${cy - 40} Z`} fill="#e6d9b4" fillOpacity={0.85} stroke={GOLD_BRIGHT} />
          <polygon points={star(cx + 38, cy - 34, 5, 2, 4)} fill={GOLD_BRIGHT} /><polygon points={star(cx + 44, cy + 30, 3.5, 1.4, 4)} fill={GOLD_BRIGHT} />
        </g>
      );
    case 17: // The Star
      return (
        <g>
          <polygon points={star(cx, cy - 6, 44, 12, 8)} fill={GOLD_BRIGHT} fillOpacity={0.85} stroke={GOLD_BRIGHT} />
          {[[-52, 38], [52, 40], [-40, -48], [44, -46], [0, 56], [-60, -6], [60, -2]].map(([dx, dy], i) => <polygon key={i} points={star(cx + dx, cy + dy, 6, 2.2, 8)} fill={GOLD} />)}
        </g>
      );
    case 10: // Wheel of Fortune
      return (
        <g stroke={GOLD_BRIGHT} fill="none">
          <circle cx={cx} cy={cy} r={50} strokeWidth={1.6} /><circle cx={cx} cy={cy} r={40} strokeWidth={0.8} /><circle cx={cx} cy={cy} r={10} strokeWidth={1.4} />
          {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={cx + Math.cos(a) * 10} y1={cy + Math.sin(a) * 10} x2={cx + Math.cos(a) * 50} y2={cy + Math.sin(a) * 50} strokeWidth={1} />; })}
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill={GOLD_BRIGHT} stroke="none" style={{ fontFamily: "var(--font-glyph)" }}>{card.glyph}</text>
        </g>
      );
    case 21: // The World
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={42} ry={60} fill="none" stroke={GOLD_BRIGHT} strokeWidth={4} strokeDasharray="3 2" opacity={0.8} />
          <ellipse cx={cx} cy={cy} rx={36} ry={54} fill="none" stroke={GOLD} strokeWidth={0.8} />
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={34} fill={GOLD_BRIGHT} style={{ fontFamily: "var(--font-glyph)" }}>{card.glyph}</text>
        </g>
      );
    case 16: // The Tower
      return (
        <g stroke={GOLD_BRIGHT} fill="none" strokeWidth={1.3}>
          <path d={`M ${cx - 20} ${cy + 60} L ${cx - 16} ${cy - 30} L ${cx + 16} ${cy - 30} L ${cx + 20} ${cy + 60} Z`} fill={GOLD} fillOpacity={0.12} />
          <path d={`M ${cx - 22} ${cy - 30} L ${cx - 14} ${cy - 46} L ${cx + 14} ${cy - 46} L ${cx + 22} ${cy - 30}`} />
          <path d={`M ${cx + 40} ${cy - 70} L ${cx + 10} ${cy - 38} L ${cx + 24} ${cy - 36} L ${cx - 4} ${cy - 6}`} stroke="#f2d27a" strokeWidth={2} />
          <rect x={cx - 5} y={cy - 6} width={10} height={14} /><rect x={cx - 5} y={cy + 26} width={10} height={14} />
        </g>
      );
    default:
      return (
        <g>
          <Rays cx={cx} cy={cy} r1={30} r2={58} n={36} />
          <circle cx={cx} cy={cy} r={28} fill="none" stroke={GOLD} strokeWidth={1.2} />
          <circle cx={cx} cy={cy} r={24} fill={GOLD} fillOpacity={0.08} stroke={GOLD} strokeWidth={0.5} />
          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize={30} fill={GOLD_BRIGHT} style={{ fontFamily: "var(--font-glyph)" }}>{card.glyph}</text>
        </g>
      );
  }
}

export function CardFace({ card, className = "" }: { card: TarotCard; className?: string }) {
  const key = card.arcana === "major" ? "major" : card.suit!;
  const ink = INK[key];
  const top = card.arcana === "major" ? card.roman : RANKS[card.number];
  const short = card.name.replace(/^The /, "");
  return (
    <svg viewBox="0 0 200 320" className={className} role="img" aria-label={card.name}>
      <defs>
        <radialGradient id={`glow-${card.id}`} cx="50%" cy="46%" r="60%">
          <stop offset="0%" stopColor={ink} stopOpacity="0.16" />
          <stop offset="100%" stopColor={ink} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={200} height={320} rx={12} fill={FIELD[key]} />
      <rect x={0} y={0} width={200} height={320} rx={12} fill={`url(#glow-${card.id})`} />
      <rect x={7} y={7} width={186} height={306} rx={8} fill="none" stroke={GOLD} strokeWidth={1.6} />
      <rect x={12} y={12} width={176} height={296} rx={5} fill="none" stroke={GOLD} strokeWidth={0.6} />
      {[[16, 16], [184, 16], [16, 304], [184, 304]].map(([x, y]) => <polygon key={`${x}${y}`} points={star(x, y, 4, 1.4, 4)} fill={GOLD_BRIGHT} />)}
      <text x={100} y={38} textAnchor="middle" fontSize={15} fill={GOLD_BRIGHT} style={{ fontFamily: "var(--font-display)", letterSpacing: "0.12em" }}>{top}</text>

      {card.arcana === "major" ? (
        <MajorEmblem card={card} />
      ) : card.number === 1 ? (
        <g>
          <Rays cx={100} cy={148} r1={34} r2={62} n={28} color={ink} w={0.7} />
          <SuitSymbol suit={card.suit!} x={100} y={148} s={2.4} color={ink} />
        </g>
      ) : card.number <= 10 ? (
        <g>{PIPS[card.number].map(([x, y], i) => <SuitSymbol key={i} suit={card.suit!} x={x} y={y} s={1.05} color={ink} />)}</g>
      ) : (
        <g>
          <Rays cx={100} cy={142} r1={36} r2={56} n={24} color={ink} w={0.6} />
          <SuitSymbol suit={card.suit!} x={100} y={150} s={2} color={ink} />
          {card.number >= 13 && <path d="M 82 100 L 86 86 L 93 96 L 100 82 L 107 96 L 114 86 L 118 100 Z" fill={GOLD_BRIGHT} stroke={GOLD_BRIGHT} strokeWidth={0.6} />}
          {card.number === 12 && <polygon points={star(100, 92, 9, 3.4, 4)} fill={GOLD_BRIGHT} />}
          {card.number === 11 && <circle cx={100} cy={93} r={5} fill="none" stroke={GOLD_BRIGHT} strokeWidth={1.4} />}
        </g>
      )}

      {card.arcana === "minor" && card.glyph && <text x={100} y={254} textAnchor="middle" fontSize={11} fill={GOLD} style={{ fontFamily: "var(--font-glyph)" }}>{card.glyph}</text>}
      <rect x={24} y={264} width={152} height={30} rx={3} fill="#0b1418" fillOpacity={0.55} stroke={GOLD} strokeWidth={1} />
      <text x={100} y={283} textAnchor="middle" fontSize={short.length > 14 ? 10.5 : 12.5} fill={GOLD_BRIGHT} style={{ fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{card.name}</text>
    </svg>
  );
}

export function CardBack({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 320" className={className} aria-label="Card back">
      <rect x={0} y={0} width={200} height={320} rx={12} fill="#0f1e24" />
      <pattern id="back-stars" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="6" r="0.8" fill={GOLD} opacity="0.6" /><circle cx="15" cy="16" r="0.6" fill={GOLD} opacity="0.45" />
      </pattern>
      <rect x={0} y={0} width={200} height={320} rx={12} fill="url(#back-stars)" />
      <rect x={7} y={7} width={186} height={306} rx={8} fill="none" stroke={GOLD} strokeWidth={1.6} />
      <rect x={12} y={12} width={176} height={296} rx={5} fill="none" stroke={GOLD} strokeWidth={0.6} />
      <Rays cx={100} cy={160} r1={20} r2={70} n={48} />
      <circle cx={100} cy={160} r={18} fill="none" stroke={GOLD} strokeWidth={1.4} />
      <circle cx={100} cy={160} r={74} fill="none" stroke={GOLD} strokeWidth={0.6} />
      <polygon points={star(100, 160, 12, 4, 4)} fill={GOLD_BRIGHT} />
      {[[100, 52], [100, 268], [40, 160], [160, 160]].map(([x, y]) => <polygon key={`${x}${y}`} points={star(x, y, 6, 2, 4)} fill={GOLD} />)}
    </svg>
  );
}
