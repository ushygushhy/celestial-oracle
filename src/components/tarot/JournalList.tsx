"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Reading } from "@/lib/db/tarot";
import { CARD_BY_ID } from "@/lib/tarot/deck";
import { CardFace } from "./CardFace";
import { LocalTime } from "../ui/LocalTime";

export function JournalList({ readings }: { readings: Reading[] }) {
  const router = useRouter();
  if (!readings.length) return <p className="py-10 text-center italic text-muted">No saved readings yet. Draw some cards and save them here.</p>;
  return (
    <ul className="space-y-3">
      {readings.map((r) => (
        <li key={r.id} className="panel flex items-center gap-4 p-3">
          <div className="flex shrink-0 -space-x-6">
            {r.cards.slice(0, 4).map((c, i) => (
              <div key={i} className="h-20 w-[50px] overflow-hidden rounded-[6%] shadow-[var(--shadow-card)]" style={{ transform: c.reversed ? "rotate(180deg)" : undefined }}>
                <CardFace card={CARD_BY_ID.get(c.id)!} className="h-full w-full" />
              </div>
            ))}
          </div>
          <Link href={`/tarot/journal/${r.id}`} className="min-w-0 flex-1 hover:text-accent-bright">
            <p className="engraved text-[0.75rem] text-accent-bright">{r.spread.name}{r.personName ? ` · for ${r.personName}` : ""}</p>
            <p className="truncate">{r.question || <em className="text-muted">No question</em>}</p>
            <p className="text-xs text-faint"><LocalTime iso={r.createdAt.replace(" ", "T") + "Z"} /> · {r.cards.map((c) => CARD_BY_ID.get(c.id)!.name).slice(0, 4).join(", ")}{r.cards.length > 4 ? "…" : ""}{r.interpretation ? " · interpreted" : ""}</p>
          </Link>
          <button
            className="text-xs text-faint hover:text-danger"
            onClick={async () => {
              if (!confirm("Delete this reading?")) return;
              await fetch(`/api/tarot/readings/${r.id}`, { method: "DELETE" });
              router.refresh();
            }}
          >
            delete
          </button>
        </li>
      ))}
    </ul>
  );
}
