/** Turns stored API messages into what the chat UI shows. */
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { POINTS, type PointId } from "../astro/constants";
import type { StoredKind } from "../db/chat";

export interface DisplayItem {
  role: "user" | "assistant" | "context";
  text: string;
  images?: string[];
  files?: string[];
  tools?: string[];
}

const pn = (id: unknown) => (typeof id === "string" ? POINTS[id as PointId]?.name ?? id : "");

export function toolDisplayLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "get_positions": return `Calculated positions for ${input.datetime}`;
    case "get_transits": return `Calculated transits for ${input.datetime}`;
    case "find_aspect_dates": return `Searched ${pn(input.transiting)} ${input.aspect} ${input.natal_point ? `natal ${pn(input.natal_point)}` : `${input.longitude}°`} (${input.start} → ${input.end})`;
    case "find_ingresses_and_stations": return `Found ${pn(input.body)} ingresses & stations (${input.start} → ${input.end})`;
    case "get_progressions": return `Calculated progressions for ${input.date}`;
    case "get_profection": return `Calculated profection for ${input.date}`;
    case "get_numerology": return "Calculated numerology";
    case "get_natal_chart": return "Read a natal chart";
    case "list_people": return "Looked up saved people";
    default: return name.replace(/_/g, " ");
  }
}

export function toDisplay(rows: { message: BetaMessageParam; kind: StoredKind }[]): DisplayItem[] {
  const out: DisplayItem[] = [];
  let current: DisplayItem | null = null;
  for (const { message, kind } of rows) {
    const blocks = typeof message.content === "string" ? [{ type: "text", text: message.content }] : (message.content as unknown as Record<string, unknown>[]);
    if (kind === "user") {
      current = null;
      const item: DisplayItem = { role: "user", text: "", images: [], files: [] };
      for (const b of blocks) {
        if (b.type === "text") item.text += b.text as string;
        else if (b.type === "image") {
          const src = b.source as { media_type: string; data: string };
          item.images!.push(`data:${src.media_type};base64,${src.data}`);
        } else if (b.type === "document") item.files!.push((b.title as string) || "PDF");
      }
      out.push(item);
    } else if (kind === "system") {
      out.push({ role: "context", text: "Context refreshed for today's sky." });
    } else if (kind === "assistant") {
      if (!current) {
        current = { role: "assistant", text: "", tools: [] };
        out.push(current);
      }
      for (const b of blocks) {
        if (b.type === "text") current.text += (current.text && !current.text.endsWith("\n") ? "\n\n" : "") + (b.text as string);
        else if (b.type === "tool_use") current.tools!.push(toolDisplayLabel(b.name as string, (b.input ?? {}) as Record<string, unknown>));
      }
    }
  }
  return out;
}
