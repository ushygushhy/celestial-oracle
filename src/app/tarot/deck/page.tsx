import Link from "next/link";
import { DECK } from "@/lib/tarot/deck";
import { CardFace } from "@/components/tarot/CardFace";
import { Frame } from "@/components/ui/Frame";

export default function DeckPage() {
  const groups: [string, typeof DECK][] = [
    ["Major Arcana", DECK.filter((c) => c.arcana === "major")],
    ["Wands · Fire", DECK.filter((c) => c.suit === "wands")],
    ["Cups · Water", DECK.filter((c) => c.suit === "cups")],
    ["Swords · Air", DECK.filter((c) => c.suit === "swords")],
    ["Pentacles · Earth", DECK.filter((c) => c.suit === "pentacles")],
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Tarot</p>
          <h1 className="font-masthead text-3xl font-bold tracking-wide">The Deck</h1>
        </div>
        <Link href="/tarot" className="btn btn-gilt">Draw cards</Link>
      </div>
      {groups.map(([title, cards]) => (
        <Frame key={title} title={title}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {cards.map((c) => (
              <details key={c.id} className="panel group flex gap-3 p-3">
                <summary className="flex cursor-pointer list-none gap-3">
                  <CardFace card={c} className="h-32 w-20 shrink-0 rounded-[6%] shadow-[var(--shadow-card)]" />
                  <span className="text-sm">
                    <span className="engraved block text-[0.78rem] text-accent-bright">{c.name}</span>
                    <span className="block text-xs text-faint">{c.element} · {c.astrology}</span>
                    <span className="block text-xs text-faint">{c.numerology}</span>
                    <span className="mt-1 block text-muted">{c.upright.keywords.join(" · ")}</span>
                  </span>
                </summary>
                <div className="mt-2 space-y-1 border-t border-rule pt-2 text-sm">
                  <p><b className="text-accent-bright">Upright.</b> {c.upright.meaning}</p>
                  <p><b className="text-accent-bright">Reversed</b> <span className="text-xs text-faint">({c.reversed.keywords.join(", ")})</span>. {c.reversed.meaning}</p>
                </div>
              </details>
            ))}
          </div>
        </Frame>
      ))}
    </div>
  );
}
