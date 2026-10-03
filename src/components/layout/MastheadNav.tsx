"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";

export function MastheadNav({ activePersonId }: { activePersonId: number | null }) {
  const pathname = usePathname();
  const fromPath = /^\/(?:chart|transits|year)\/(\d+)/.exec(pathname)?.[1];
  const personId = fromPath ? Number(fromPath) : activePersonId;

  return (
    <nav className="flex flex-wrap items-center gap-x-1 gap-y-1">
      {NAV.map((item) => {
        const href = item.needsPerson ? (personId ? item.href.replace(":person", String(personId)) : "/people/new") : item.href;
        const base = item.href.split("/:")[0];
        const active = base !== "/" && pathname.startsWith(base);
        return (
          <Link
            key={item.label}
            href={href}
            className={`engraved px-2.5 py-1 text-[0.7rem] transition-colors ${active ? "text-accent-bright underline decoration-1 underline-offset-[6px]" : item.ready ? "text-muted hover:text-accent-bright" : "text-faint hover:text-muted"}`}
          >
            {item.label}
            {!item.ready && <sup className="ml-0.5 text-[0.5rem] normal-case tracking-normal opacity-70">soon</sup>}
          </Link>
        );
      })}
    </nav>
  );
}
