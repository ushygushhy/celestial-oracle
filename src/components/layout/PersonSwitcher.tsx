"use client";
import { useRouter, usePathname } from "next/navigation";
import type { PersonSummary } from "./Masthead";

export function setActivePersonCookie(id: number) {
  document.cookie = `person=${id}; path=/; max-age=31536000; samesite=lax`;
}

export function PersonSwitcher({ people, activePersonId }: { people: PersonSummary[]; activePersonId: number | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const fromPath = /^\/(chart|transits|year)\/(\d+)/.exec(pathname);
  const current = fromPath ? Number(fromPath[2]) : activePersonId;

  const onChange = (value: string) => {
    if (value === "new") return router.push("/people/new");
    const id = Number(value);
    setActivePersonCookie(id);
    const section = fromPath?.[1] ?? "chart";
    router.push(`/${section}/${id}${window.location.search}`);
    router.refresh();
  };

  return (
    <label className="flex items-center gap-2">
      <span className="engraved text-[0.62rem] text-faint">Native</span>
      <select
        value={current && people.some((p) => p.id === current) ? String(current) : ""}
        onChange={(e) => onChange(e.target.value)}
        className="field w-auto min-w-[12rem] py-1 font-serif text-sm"
      >
        <option value="" disabled>
          {people.length ? "Select a person…" : "No charts yet"}
        </option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value="new">＋ New chart…</option>
      </select>
    </label>
  );
}
