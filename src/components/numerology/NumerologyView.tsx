"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FullProfile } from "@/lib/numerology/full";
import { CHALLENGE_MEANINGS } from "@/lib/numerology/full";
import type { CoreNumber } from "@/lib/numerology/core";
import { meaningOf, PERSONAL_YEAR, KARMIC_DEBT_MEANINGS } from "@/lib/numerology/meanings";
import { Frame, Panel } from "../ui/Frame";
import { InterpretationPanel, type InterpretRequest } from "../chart/InterpretationPanel";
import { Sparkle } from "../ui/Ornaments";

const lbl = (n: CoreNumber) => (n.master ? `${n.value}` : n.compound > 9 && n.compound !== n.value ? `${n.compound}/${n.value}` : `${n.value}`);

function CoreCard({ title, subtitle, n }: { title: string; subtitle: string; n: CoreNumber }) {
  const m = meaningOf(n.value);
  return (
    <div className="panel flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="engraved text-[0.72rem] text-accent-bright">{title}</p>
          <p className="text-[0.7rem] italic text-faint">{subtitle}</p>
        </div>
        <span className="font-masthead text-4xl leading-none text-text">{lbl(n)}</span>
      </div>
      <p className="mt-2 text-sm"><b className="text-accent-bright">{m.keyword}</b></p>
      <p className="text-sm text-muted">{m.core}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {n.master && <span className="chip !text-[0.65rem] text-accent-bright">master number</span>}
        {n.karmicDebt.map((k) => <span key={k} className="chip !text-[0.65rem] text-danger" title={KARMIC_DEBT_MEANINGS[k]}>karmic debt {k}</span>)}
      </div>
      <details className="mt-auto pt-2 text-xs text-faint">
        <summary className="cursor-pointer text-muted">Show the workings</summary>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">{n.steps.map((s, i) => <li key={i} className="num">{s}</li>)}</ol>
      </details>
    </div>
  );
}

export function NumerologyView({ profile, people, personId, today }: { profile: FullProfile | null; people: { id: number; name: string }[]; personId: number | null; today: string }) {
  const router = useRouter();
  const [name, setName] = useState(profile?.name ?? "");
  const [date, setDate] = useState(profile?.birthDate ?? "");
  const [reading, setReading] = useState(false);
  const system = profile?.system ?? "pythagorean";
  const go = (q: Record<string, string>) => router.push(`/numerology?${new URLSearchParams(q)}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="engraved text-[0.65rem] text-faint">Numerology</p>
          <h1 className="font-masthead text-3xl font-bold tracking-wide">The Arithmetic of a Name</h1>
          <p className="headline-italic mt-1 text-sm font-normal text-muted">Every number shown with its reduction, step by step.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex overflow-hidden rounded-sm border border-rule text-xs">
            {(["pythagorean", "chaldean"] as const).map((s) => (
              <button key={s} onClick={() => profile && go({ ...(personId ? { person: String(personId) } : { name: profile.name, date: profile.birthDate }), system: s })} className={`px-3 py-1.5 capitalize ${system === s ? "bg-[rgb(204_168_116/0.18)] text-text" : "text-muted"}`}>{s}</button>
            ))}
          </span>
          {profile && <button className="btn btn-gilt" onClick={() => setReading(true)}><Sparkle size={10} /> Interpret</button>}
        </div>
      </div>

      <Panel title="Whose numbers?">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
          <label>
            <span className="label">Saved person</span>
            <select className="field" value={personId ?? ""} onChange={(e) => e.target.value && go({ person: e.target.value, system })}>
              <option value="">Choose…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <span className="pb-2 text-center text-sm italic text-faint">or</span>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <label><span className="label">Full birth name</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="As on the birth certificate" /></label>
            <label><span className="label">Birth date</span><input type="date" className="field num" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
          <button className="btn" disabled={!name.trim() || !date} onClick={() => go({ name, date, system })}>Calculate</button>
        </div>
        {personId && profile && <p className="mt-2 text-xs text-faint">Using the full birth name saved for this person: “{profile.name}”. Edit the person to change it.</p>}
      </Panel>

      {!profile ? (
        <p className="py-10 text-center italic text-muted">Choose a person or enter a name and birth date.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <CoreCard title="Life Path" subtitle="The road you walk — from the birth date" n={profile.lifePath} />
            <CoreCard title="Expression · Destiny" subtitle="Your talents and aims — all letters" n={profile.expression} />
            <CoreCard title="Soul Urge" subtitle="The heart's desire — vowels" n={profile.soulUrge} />
            <CoreCard title="Personality" subtitle="How others first see you — consonants" n={profile.personality} />
            <CoreCard title="Birthday" subtitle="A special gift — day of birth" n={profile.birthday} />
            <CoreCard title="Maturity" subtitle="Who you grow into — Life Path + Expression" n={profile.maturity} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Frame title="Pinnacles" subtitle="The four great chapters of life">
              <table className="table-almanac text-sm">
                <thead><tr><th>Pinnacle</th><th>Ages</th><th>Number</th><th>Working</th></tr></thead>
                <tbody>
                  {profile.pinnacles.map((p) => (
                    <tr key={p.label}><td>{p.label}</td><td className="num">{p.fromAge}–{p.toAge ?? "∞"}</td><td className="font-masthead text-lg text-accent-bright">{p.number}</td><td className="text-xs text-faint">{p.steps} · {meaningOf(p.number).keyword}</td></tr>
                  ))}
                </tbody>
              </table>
            </Frame>
            <Frame title="Challenges" subtitle="The lessons that run alongside each pinnacle">
              <table className="table-almanac text-sm">
                <thead><tr><th>Challenge</th><th>Ages</th><th>Number</th><th>Meaning</th></tr></thead>
                <tbody>
                  {profile.challenges.map((c) => (
                    <tr key={c.label}><td>{c.label}</td><td className="num">{c.fromAge}–{c.toAge ?? "∞"}</td><td className="font-masthead text-lg text-accent-bright">{c.number}</td><td className="text-xs text-faint">{c.steps} · {CHALLENGE_MEANINGS[c.number]}</td></tr>
                  ))}
                </tbody>
              </table>
            </Frame>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Personal cycles">
              <p className="mb-2 text-xs text-faint">For {today} (calendar-year method)</p>
              {([["Year", profile.cycles.year], ["Month", profile.cycles.month], ["Day", profile.cycles.day]] as const).map(([k, n]) => (
                <div key={k} className="border-b border-rule py-2 last:border-0">
                  <p className="flex justify-between"><span className="engraved text-[0.65rem] text-faint">Personal {k}</span><span className="font-masthead text-xl text-accent-bright">{lbl(n)}</span></p>
                  <p className="text-sm text-muted">{PERSONAL_YEAR[n.value] ?? PERSONAL_YEAR[((n.value - 1) % 9) + 1]}</p>
                  <p className="num text-[0.68rem] text-faint">{n.steps.join(" · ")}</p>
                </div>
              ))}
            </Panel>
            <Panel title="Karmic notes">
              <p className="engraved text-[0.65rem] text-faint">Karmic debt</p>
              {profile.karmicDebts.length ? profile.karmicDebts.map((k) => <p key={k} className="mb-1 text-sm text-muted">{KARMIC_DEBT_MEANINGS[k]}</p>) : <p className="mb-1 text-sm italic text-muted">None.</p>}
              <p className="engraved mt-3 text-[0.65rem] text-faint">Karmic lessons (numbers missing from the name)</p>
              <p className="text-sm text-muted">{profile.karmicLessons.length ? profile.karmicLessons.map((n) => `${n} (${meaningOf(n).keyword})`).join(", ") : "None — every number is present."}</p>
              <p className="engraved mt-3 text-[0.65rem] text-faint">Hidden passion (most frequent)</p>
              <p className="text-sm text-muted">{profile.hiddenPassion.map((n) => `${n} (${meaningOf(n).keyword})`).join(", ") || "—"}</p>
            </Panel>
            <Panel title={`Letter values · ${system}`}>
              <div className="space-y-2">
                {profile.letters.map((w, i) => (
                  <div key={i} className="flex flex-wrap gap-1">
                    {w.map((c, k) => (
                      <span key={k} className={`flex w-8 flex-col items-center rounded-sm border px-1 py-0.5 ${c.vowel ? "border-[color:var(--rule-strong)]" : "border-rule"}`}>
                        <span className="engraved text-sm">{c.letter}</span>
                        <span className="num text-xs text-accent-bright">{c.value}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[0.68rem] text-faint">Gold-bordered letters count as vowels (Y is a vowel only when no vowel stands beside it).</p>
            </Panel>
          </div>
        </>
      )}

      <InterpretationPanel
        request={reading && profile ? { personId, target: { kind: "numerology", system, name: profile.name, date: profile.birthDate } } as InterpretRequest : null}
        title={`Numerology of ${profile?.name ?? ""}`}
        topic={profile ? `my numerology (Life Path ${lbl(profile.lifePath)})` : undefined}
        facts={profile ? <div>Life Path {lbl(profile.lifePath)} · Expression {lbl(profile.expression)} · Soul Urge {lbl(profile.soulUrge)} · Personality {lbl(profile.personality)} · Personal Year {lbl(profile.cycles.year)}</div> : null}
        onClose={() => setReading(false)}
      />
    </div>
  );
}
