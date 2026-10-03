import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, aiConfigured, friendlyError, MODEL } from "@/lib/ai/client";
import { ExtractionSchema } from "@/lib/upload/schema";

const Body = z.object({
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]),
  data: z.string().max(30 * 1024 * 1024),
});

const INSTRUCTIONS = `You are reading an astrology chart image (a chart wheel, a positions table, or both).
Extract every placement you can see — planets, nodes, Chiron, Lilith, Part of Fortune, angles — with sign, degree, minute, house (if shown) and retrograde status (an R or ℞ next to it).
Extract all house cusps shown, and any birth data printed on the chart.
Read astrological glyphs carefully: ♈ Aries ♉ Taurus ♊ Gemini ♋ Cancer ♌ Leo ♍ Virgo ♎ Libra ♏ Scorpio ♐ Sagittarius ♑ Capricorn ♒ Aquarius ♓ Pisces; ☉ Sun ☽ Moon ☿ Mercury ♀ Venus ♂ Mars ♃ Jupiter ♄ Saturn ♅/⛢ Uranus ♆ Neptune ♇ Pluto ⚷ Chiron ☊ North Node ☋ South Node ⚸ Lilith ⊗ Part of Fortune.
Prefer a printed positions table over reading positions off the wheel. Never guess: if a degree or glyph is unclear, give your best reading with confidence "low" and say so in notes. Convert positions given as absolute longitude (0–360°) into sign + degree.`;

/** POST /api/upload/extract — read placements from a chart image or PDF with Claude vision. */
export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: "Chart reading needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env.local and restart." }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Upload a PNG, JPEG, WebP, GIF or PDF." }, { status: 400 });
  const { mediaType, data } = parsed.data;
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(ExtractionSchema) },
      messages: [{
        role: "user",
        content: [
          mediaType === "application/pdf"
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
            : { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: INSTRUCTIONS },
        ],
      }],
    });
    if (res.stop_reason === "refusal") return Response.json({ error: "The model declined to read this file." }, { status: 422 });
    if (!res.parsed_output) return Response.json({ error: "Could not read structured placements from this file." }, { status: 422 });
    return Response.json({ extraction: res.parsed_output });
  } catch (e) {
    const status = e instanceof Anthropic.APIError && e.status ? e.status : 500;
    return Response.json({ error: friendlyError(e) }, { status });
  }
}
