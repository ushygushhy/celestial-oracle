import type { ReactNode } from "react";
import { FrameCorners } from "./Ornaments";

/** Double gilt frame with corner stars (img5) — for primary panels. */
export function Frame({ children, className = "", title, subtitle, actions }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`frame-gilt p-5 ${className}`}>
      <FrameCorners />
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h2 className="engraved text-[0.95rem] text-accent-bright">{title}</h2>}
            {subtitle && <p className="headline-italic mt-0.5 text-sm font-normal text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/** Plain hairline panel — for dense data. */
export function Panel({ children, className = "", title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`panel p-4 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-3 border-b border-rule pb-2">
          {title && <h3 className="engraved text-[0.78rem] text-accent-bright">{title}</h3>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/** Boxed newspaper section head — "CONSTELLATIONS" box (img1). */
export function BoxedHead({ title, tagline }: { title: string; tagline?: string }) {
  return (
    <div className="head-boxed">
      <span className="text-lg leading-tight">{title}</span>
      {tagline && <span className="font-serif text-[0.7rem] normal-case tracking-normal text-muted">{tagline}</span>}
    </div>
  );
}
