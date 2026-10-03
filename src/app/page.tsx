import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { listPeople } from "@/lib/db/people";
import { ephemerisInfo } from "@/lib/astro/ephemeris";
import { tzdbVersion } from "@/lib/astro/tz";
import { aiConfigured, MODEL } from "@/lib/ai/client";
import { Frame, Panel, BoxedHead } from "@/components/ui/Frame";
import { Sunburst, StarRule } from "@/components/ui/Ornaments";

export default function Home() {
  const people = listPeople();
  const eph = ephemerisInfo();
  const files = ["sepl_18.se1", "semo_18.se1", "seas_18.se1"].map((f) => ({ f, ok: fs.existsSync(path.join(eph.path, f)) }));
  const ai = aiConfigured();
  const forPerson = (section: string) => (people[0] ? `/${section}/${people[0].id}` : "/people/new");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Frame>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Sunburst size={72} className="text-accent" />
            <BoxedHead title="Today's Edition" tagline="The darkest nights produce the brightest stars." />
            <p className="max-w-2xl text-[1.05rem] leading-relaxed text-muted">
              A private observatory for charts, cycles and cards. Every position is calculated with the Swiss Ephemeris and
              checked against astro.com; the interpreter only ever reads what the engine computed.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link href="/people/new" className="btn btn-gilt">Cast a new chart</Link>
              {people[0] && <Link href={`/chart/${people[0].id}`} className="btn">Open {people[0].name}</Link>}
            </div>
          </div>
        </Frame>

        <Panel title="The Register" actions={<Link href="/people" className="text-xs text-muted hover:text-accent-bright">All people →</Link>}>
          {people.length === 0 ? (
            <p className="py-6 text-center italic text-muted">Nobody here yet — cast your own chart first.</p>
          ) : (
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {people.slice(0, 12).map((p) => (
                <li key={p.id} className="border-b border-rule py-2">
                  <Link href={`/chart/${p.id}`} className="flex items-baseline justify-between gap-3 hover:text-accent-bright">
                    <span className="engraved text-sm">{p.name}</span>
                    <span className="num text-xs text-faint">{p.birthDate}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <StarRule />
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          {[
            { t: "Sky Now & Transits", d: "Live planetary positions, Moon phase and void-of-course, transit timeline with exact dates.", links: [["Sky Now", "/sky"], ["Transits", forPerson("transits")]] },
            { t: "Your Year", d: "Profections, Lord of the Year, solar return, progressions and personal-year numerology.", links: [["Your Year", forPerson("year")]] },
            { t: "Numerology · Tarot · Chat", d: "Full numerology with workings, a 78-card deck with spreads, and an always-on interpreter.", links: [["Numerology", "/numerology"], ["Tarot", "/tarot"]] },
          ].map(({ t, d, links }) => (
            <div key={t} className="panel p-4">
              <h3 className="engraved text-[0.75rem] text-accent-bright">{t}</h3>
              <p className="mt-1 text-muted">{d}</p>
              <p className="mt-2 flex gap-4 text-xs">
                {links.map(([label, href]) => <Link key={label} href={href} className="text-accent hover:text-accent-bright">{label} →</Link>)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <aside className="space-y-6">
        <Panel title="Observatory Status">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="engraved text-[0.6rem] text-faint">Swiss Ephemeris {eph.version}</dt>
              <dd>{files.map(({ f, ok }) => <span key={f} className={`mr-2 ${ok ? "text-success" : "text-danger"}`}>{ok ? "✓" : "✗"} {f}</span>)}</dd>
            </div>
            <div>
              <dt className="engraved text-[0.6rem] text-faint">Time zones</dt>
              <dd>IANA tzdb {tzdbVersion()} with pre-1970 backzone history</dd>
            </div>
            <div>
              <dt className="engraved text-[0.6rem] text-faint">Interpreter</dt>
              <dd className={ai ? "text-success" : "text-danger"}>{ai ? `✓ ${MODEL}` : "✗ ANTHROPIC_API_KEY not set (see README)"}</dd>
            </div>
            <div>
              <dt className="engraved text-[0.6rem] text-faint">Charts saved</dt>
              <dd className="num">{people.length}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Accuracy">
          <p className="text-sm text-muted">
            Validated against five Astro-Databank reference charts (Jobs, Obama, Diana, Einstein, Hendrix) including
            Local Mean Time and US War Time births: every planet, node, Lilith, Chiron, angle and house cusp matches astro.com
            to well under one arcsecond. Run <code className="text-accent-bright">npm test</code> to re-verify.
          </p>
        </Panel>
      </aside>
    </div>
  );
}
