"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DECK, CARD_BY_ID } from "@/lib/tarot/deck";
import { SPREADS, type Spread } from "@/lib/tarot/spreads";
import { Frame, Panel } from "../ui/Frame";
import { Sparkle } from "../ui/Ornaments";
import { CardBack } from "./CardFace";
import { SpreadLayout, type Drawn } from "./SpreadLayout";
import { InterpretationPanel } from "../chart/InterpretationPanel";

function secureShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  const r = new Uint32Array(1);
  for (let i = a.length - 1; i > 0; i--) {
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const coin = () => {
  const r = new Uint8Array(1);
  crypto.getRandomValues(r);
  return (r[0] & 1) === 1;
};

const ELEMENT_COLOR: Record<string, string> = { fire: "var(--element-fire)", water: "var(--element-water)", air: "var(--element-air)", earth: "var(--element-earth)" };

export function TarotTable({ customSpreads, people, defaultPersonId }: { customSpreads: Spread[]; people: { id: number; name: string }[]; defaultPersonId: number | null }) {
  const router = useRouter();
  const spreads = useMemo(() => [...SPREADS, ...customSpreads], [customSpreads]);
  const [spreadId, setSpreadId] = useState("three");
  const [question, setQuestion] = useState("");
  const [personId, setPersonId] = useState<number | null>(defaultPersonId);
  const [reversals, setReversals] = useState(true);
  const [phase, setPhase] = useState<"setup" | "shuffling" | "dealt">("setup");
  const [drawn, setDrawn] = useState<Drawn[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [dealKey, setDealKey] = useState(0);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);
  const [custom, setCustom] = useState<{ name: string; positions: { label: string; meaning: string }[] }>({ name: "", positions: [{ label: "", meaning: "" }] });
  const [error, setError] = useState<string | null>(null);

  const spread = spreads.find((s) => s.id === spreadId) ?? SPREADS[0];
  const allRevealed = revealed.length > 0 && revealed.every(Boolean);
  const cardWidth = spread.positions.length > 10 ? 78 : spread.positions.length > 3 ? 92 : 128;

  const shuffleAndDeal = () => {
    setPhase("shuffling");
    setInterpretation(null);
    setSavedId(null);
    setTimeout(() => {
      const cards = secureShuffle(DECK).slice(0, spread.positions.length).map((c) => ({ id: c.id, reversed: reversals ? coin() : false }));
      setDrawn(cards);
      setRevealed(cards.map(() => false));
      setDealKey((k) => k + 1);
      setPhase("dealt");
    }, 1400);
  };

  const reveal = (i: number) => setRevealed((r) => r.map((v, k) => (k === i ? true : v)));

  const save = async () => {
    setError(null);
    const res = await fetch("/api/tarot/readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, question, spread, cards: drawn, interpretation }),
    });
    const d = await res.json();
    if (!res.ok) return setError(d.error ?? "Could not save");
    setSavedId(d.id);
  };

  const saveCustom = async () => {
    setError(null);
    const positions = custom.positions.filter((p) => p.label.trim());
    const res = await fetch("/api/tarot/spreads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: custom.name, positions }) });
    const d = await res.json();
    if (!res.ok) return setError(d.error ?? "Could not save spread");
    setBuilding(false);
    setCustom({ name: "", positions: [{ label: "", meaning: "" }] });
    router.refresh();
    setSpreadId(d.id);
  };

  const tally = drawn.reduce<Record<string, number>>((acc, d) => {
    const c = CARD_BY_ID.get(d.id)!;
    acc[c.element] = (acc[c.element] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Tarot</p>
          <h1 className="font-masthead text-3xl font-bold tracking-wide">Seventy-Eight Keys</h1>
          <p className="headline-italic mt-1 text-sm font-normal text-muted">Shuffled with the browser&apos;s cryptographic randomness.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/tarot/journal" className="btn">Journal</Link>
          <Link href="/tarot/deck" className="btn">The deck</Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title="The question">
          <div className="space-y-3">
            <label className="block">
              <span className="label">Spread</span>
              <select className="field" value={spreadId} onChange={(e) => { setSpreadId(e.target.value); setPhase("setup"); setDrawn([]); }}>
                {spreads.map((s) => <option key={s.id} value={s.id}>{s.name}{s.custom ? " (custom)" : ""}</option>)}
              </select>
              <span className="mt-1 block text-xs text-faint">{spread.description}</span>
            </label>
            <button className="text-xs text-muted underline decoration-dotted underline-offset-4 hover:text-accent-bright" onClick={() => setBuilding((b) => !b)}>{building ? "Close the spread builder" : "Build a custom spread…"}</button>
            {building && (
              <div className="panel space-y-2 p-3">
                <input className="field text-sm" placeholder="Spread name" value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} />
                {custom.positions.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-1">
                    <input className="field py-1 text-sm" placeholder={`Position ${i + 1}`} value={p.label} onChange={(e) => setCustom((c) => ({ ...c, positions: c.positions.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) }))} />
                    <input className="field py-1 text-sm" placeholder="What it shows" value={p.meaning} onChange={(e) => setCustom((c) => ({ ...c, positions: c.positions.map((x, k) => (k === i ? { ...x, meaning: e.target.value } : x)) }))} />
                    <button className="px-1 text-danger" onClick={() => setCustom((c) => ({ ...c, positions: c.positions.filter((_, k) => k !== i) }))} aria-label="Remove position">×</button>
                  </div>
                ))}
                <div className="flex justify-between">
                  <button className="btn px-2 py-1 text-[0.6rem]" disabled={custom.positions.length >= 15} onClick={() => setCustom((c) => ({ ...c, positions: [...c.positions, { label: "", meaning: "" }] }))}>+ Position</button>
                  <button className="btn btn-gilt px-2 py-1 text-[0.6rem]" disabled={!custom.name.trim() || !custom.positions.some((p) => p.label.trim())} onClick={saveCustom}>Save spread</button>
                </div>
              </div>
            )}
            <label className="block">
              <span className="label">Your question</span>
              <textarea className="field min-h-20" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What do I need to understand about…" />
            </label>
            <label className="block">
              <span className="label">Read for (links current transits)</span>
              <select className="field" value={personId ?? ""} onChange={(e) => setPersonId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">No one in particular</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={reversals} onChange={(e) => setReversals(e.target.checked)} className="accent-[var(--accent)]" /> Allow reversed cards
            </label>
            <button className="btn btn-gilt w-full" onClick={shuffleAndDeal} disabled={phase === "shuffling"}>
              {phase === "shuffling" ? "Shuffling…" : phase === "dealt" ? "Shuffle again" : "Shuffle & deal"}
            </button>
            {phase === "dealt" && !allRevealed && <button className="btn w-full" onClick={() => setRevealed((r) => r.map(() => true))}>Reveal all</button>}
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </Panel>

        <Frame className="min-h-[520px]">
          {phase !== "dealt" ? (
            <div className="flex h-full min-h-[460px] flex-col items-center justify-center gap-6">
              <div className={`tarot-deck ${phase === "shuffling" ? "riffling" : ""}`}>
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} style={{ transform: `translate(${i * 0.8}px, ${-i * 0.8}px)` }}>
                    <div className="tarot-face"><CardBack /></div>
                  </div>
                ))}
              </div>
              <p className="headline-italic text-sm font-normal text-muted">{phase === "shuffling" ? "The cards are being shuffled…" : "Hold your question in mind, then shuffle."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto py-4">
              <SpreadLayout spread={spread} drawn={drawn} revealed={revealed} onReveal={reveal} width={cardWidth} dealKey={dealKey} />
              {!allRevealed && <p className="mt-2 text-center text-xs text-faint">Click each card to turn it over.</p>}
            </div>
          )}
        </Frame>
      </div>

      {phase === "dealt" && revealed.some(Boolean) && (
        <Panel title="The cards" actions={
          <div className="flex gap-2">
            <button className="btn btn-gilt px-3 py-1 text-[0.65rem]" disabled={!allRevealed} onClick={() => setInterpreting(true)}><Sparkle size={9} /> Interpret</button>
            <button className="btn px-3 py-1 text-[0.65rem]" onClick={save} disabled={!!savedId}>{savedId ? "Saved" : "Save to journal"}</button>
            {savedId && <Link href={`/tarot/journal/${savedId}`} className="btn px-3 py-1 text-[0.65rem]">Open</Link>}
          </div>
        }>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {Object.entries(tally).map(([el, n]) => <span key={el} className="chip capitalize" style={{ color: ELEMENT_COLOR[el] }}>{el} {n}</span>)}
            <span className="chip">{drawn.filter((d) => CARD_BY_ID.get(d.id)!.arcana === "major").length} major</span>
            <span className="chip">{drawn.filter((d) => d.reversed).length} reversed</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {drawn.map((d, i) => {
              if (!revealed[i]) return <div key={i} className="panel p-3 text-sm italic text-faint">{spread.positions[i].label} — face down</div>;
              const c = CARD_BY_ID.get(d.id)!;
              const side = d.reversed ? c.reversed : c.upright;
              return (
                <div key={i} className="panel p-3 text-sm">
                  <p className="engraved text-[0.62rem] text-faint">{spread.positions[i].label} · {spread.positions[i].meaning}</p>
                  <p className="engraved mt-0.5 text-[0.85rem] text-accent-bright">{c.name}{d.reversed ? " · reversed" : ""}</p>
                  <p className="text-xs text-muted">{side.keywords.join(" · ")}</p>
                  <p className="mt-1">{side.meaning}</p>
                  <p className="mt-1 text-[0.7rem] text-faint"><span style={{ color: ELEMENT_COLOR[c.element] }}>{c.element}</span> · {c.astrology} · {c.numerology}</p>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <InterpretationPanel
        request={interpreting ? ({ spreadName: spread.name, positions: spread.positions.map(({ label, meaning }) => ({ label, meaning })), cards: drawn, question, personId } as never) : null}
        endpoint="/api/tarot/interpret"
        title={`${spread.name}${question ? ` — “${question.slice(0, 60)}${question.length > 60 ? "…" : ""}”` : ""}`}
        topic={`my ${spread.name} tarot reading${question ? ` about "${question.slice(0, 80)}"` : ""}`}
        facts={<div>{drawn.map((d, i) => `${spread.positions[i]?.label}: ${CARD_BY_ID.get(d.id)!.name}${d.reversed ? " (reversed)" : ""}`).join(" · ")}</div>}
        onDone={(t) => setInterpretation(t)}
        initialText={interpretation}
        footerExtra={interpretation && !savedId ? <button className="btn px-3 py-1 text-[0.65rem]" onClick={save}>Save to journal</button> : savedId ? <span className="text-xs text-success">Saved to journal</span> : null}
        onClose={() => setInterpreting(false)}
      />
    </div>
  );
}
