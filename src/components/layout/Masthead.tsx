import Link from "next/link";
import { Sunburst, Sparkle } from "../ui/Ornaments";
import { MastheadNav } from "./MastheadNav";
import { ThemeToggle } from "./ThemeToggle";
import { PersonSwitcher } from "./PersonSwitcher";

export interface PersonSummary {
  id: number;
  name: string;
  birthDate: string;
}

function editionLine() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  const date = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return { date, issue: `No. ${dayOfYear}` };
}

export function Masthead({ people, activePersonId, theme }: { people: PersonSummary[]; activePersonId: number | null; theme: "midnight" | "almanac" }) {
  const { date, issue } = editionLine();
  return (
    <header className="mx-auto w-full max-w-[1500px] px-4 pt-4 sm:px-6">
      <div className="flex items-center justify-between gap-4 pb-1.5 text-[0.7rem] text-muted">
        <span className="engraved tracking-[0.18em]">Vol. I · {issue}</span>
        <span className="hidden font-serif italic sm:inline">{date}</span>
        <ThemeToggle theme={theme} />
      </div>
      <div className="rule-double" />
      <div className="flex items-center justify-center gap-4 py-3 sm:gap-6">
        <Sunburst size={44} className="hidden text-accent sm:block" />
        <Link href="/" className="group text-center">
          <h1 className="font-masthead text-[1.9rem] font-bold uppercase leading-none tracking-[0.08em] text-text sm:text-[2.6rem]">
            Celestial Oracle
          </h1>
          <p className="headline-italic mt-1 flex items-center justify-center gap-2 text-sm text-accent-bright sm:text-base">
            <Sparkle size={8} /> Look to the Stars <Sparkle size={8} />
          </p>
        </Link>
        <Sunburst size={44} className="hidden text-accent sm:block" />
      </div>
      <div className="rule-double" />
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <MastheadNav activePersonId={activePersonId} />
        <PersonSwitcher people={people} activePersonId={activePersonId} />
      </div>
      <div className="rule-hair" />
    </header>
  );
}
