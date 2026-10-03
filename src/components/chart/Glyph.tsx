import { POINTS, SIGNS, ASPECTS, type AspectId, type PointId, type SignId } from "@/lib/astro/constants";
import { elementColor, aspectColor, TEXT_VS } from "@/lib/design/tokens";

export function PointGlyph({ id, className = "" }: { id: PointId; className?: string }) {
  const g = POINTS[id].glyph;
  if (g.length > 1) return <span className={`engraved text-[0.7em] ${className}`}>{g}</span>;
  return <span className={`glyph ${className}`}>{g}</span>;
}

export function SignGlyph({ sign, className = "", colored = true }: { sign: SignId; className?: string; colored?: boolean }) {
  const s = SIGNS.find((x) => x.id === sign)!;
  return (
    <span className={`glyph ${className}`} style={colored ? { color: elementColor[s.element] } : undefined} title={s.name}>
      {s.glyph + TEXT_VS}
    </span>
  );
}

export function AspectGlyph({ type, className = "" }: { type: AspectId; className?: string }) {
  return (
    <span className={`glyph ${className}`} style={{ color: aspectColor[type] }} title={ASPECTS[type].name}>
      {ASPECTS[type].glyph}
    </span>
  );
}
