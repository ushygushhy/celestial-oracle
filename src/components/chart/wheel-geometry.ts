/** Geometry for the SVG chart wheel. Pure functions, no React. */

export const norm = (x: number) => ((x % 360) + 360) % 360;

/**
 * Screen position of ecliptic longitude `lon` at radius `r`, with the
 * Ascendant (or `rotation`) at 9 o'clock and the zodiac running
 * counter-clockwise, as in a traditional chart.
 */
export function polar(cx: number, cy: number, r: number, lon: number, rotation: number) {
  const a = ((lon - rotation) * Math.PI) / 180;
  // Rounded to 0.01 viewBox units: server (Node) and browser trig can differ in
  // the last float digit, which would otherwise cause hydration mismatches.
  return { x: Math.round((cx - r * Math.cos(a)) * 100) / 100, y: Math.round((cy + r * Math.sin(a)) * 100) / 100 };
}

/**
 * Collision avoidance for glyphs on a ring. Returns display longitudes such
 * that neighbours are at least `minSep` degrees apart, keeping each cluster
 * centred on the mean of its true positions and preserving zodiacal order.
 *
 * The circle is cut at the widest gap so no cluster straddles the cut, then
 * clusters are merged greedily until none overlap.
 */
export function spreadLongitudes(lons: number[], minSep: number): number[] {
  const n = lons.length;
  if (n < 2) return lons.map(norm);
  const sep = Math.min(minSep, 360 / n);
  const order = lons.map((l, i) => ({ l: norm(l), i })).sort((a, b) => a.l - b.l);

  let cut = 0, widest = -1;
  for (let k = 0; k < n; k++) {
    const gap = norm(order[(k + 1) % n].l - order[k].l) || (n === 1 ? 360 : 0);
    if (gap > widest) { widest = gap; cut = (k + 1) % n; }
  }
  const seq = [...order.slice(cut), ...order.slice(0, cut)];
  const base = seq[0].l;
  const xs = seq.map((o) => norm(o.l - base));

  type Cluster = { sum: number; members: number[] };
  let clusters: Cluster[] = xs.map((x, k) => ({ sum: x, members: [k] }));
  const center = (c: Cluster) => c.sum / c.members.length;
  const start = (c: Cluster) => center(c) - ((c.members.length - 1) * sep) / 2;
  const end = (c: Cluster) => center(c) + ((c.members.length - 1) * sep) / 2;

  let merged = true;
  while (merged && clusters.length > 1) {
    merged = false;
    for (let k = 0; k < clusters.length - 1; k++) {
      if (start(clusters[k + 1]) - end(clusters[k]) < sep - 1e-9) {
        const a = clusters[k], b = clusters[k + 1];
        clusters = [...clusters.slice(0, k), { sum: a.sum + b.sum, members: [...a.members, ...b.members] }, ...clusters.slice(k + 2)];
        merged = true;
        break;
      }
    }
    // also resolve overlap across the cut
    if (!merged && clusters.length > 1) {
      const first = clusters[0], last = clusters[clusters.length - 1];
      if (start(first) + 360 - end(last) < sep - 1e-9) {
        const shift = (sep - (start(first) + 360 - end(last))) / 2;
        first.sum += shift * first.members.length;
        last.sum -= shift * last.members.length;
        merged = true;
      }
    }
  }

  const out = new Array<number>(n);
  for (const c of clusters) {
    const s = start(c);
    c.members.forEach((k, j) => {
      out[seq[k].i] = norm(base + s + j * sep);
    });
  }
  return out;
}

/** SVG arc path for a ring segment between two longitudes. */
export function ringSegment(cx: number, cy: number, rOuter: number, rInner: number, lonStart: number, lonEnd: number, rotation: number) {
  const span = norm(lonEnd - lonStart) || 360;
  const large = span > 180 ? 1 : 0;
  const p1 = polar(cx, cy, rOuter, lonStart, rotation);
  const p2 = polar(cx, cy, rOuter, lonStart + span, rotation);
  const p3 = polar(cx, cy, rInner, lonStart + span, rotation);
  const p4 = polar(cx, cy, rInner, lonStart, rotation);
  // increasing longitude runs counter-clockwise on screen → sweep-flag 0
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 0 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 1 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}
