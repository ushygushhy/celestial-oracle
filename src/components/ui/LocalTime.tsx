"use client";

/** Renders an ISO instant in the viewer's own time zone. */
export function LocalTime({ iso, mode = "datetime", className = "" }: { iso: string | null | undefined; mode?: "datetime" | "date" | "short" | "time"; className?: string }) {
  if (!iso) return <span className={className}>—</span>;
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    mode === "date" ? { year: "numeric", month: "short", day: "numeric" }
    : mode === "short" ? { month: "short", day: "numeric" }
    : mode === "time" ? { hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  return (
    <time dateTime={iso} className={`num ${className}`} suppressHydrationWarning title={d.toString()}>
      {d.toLocaleString(undefined, opts)}
    </time>
  );
}
