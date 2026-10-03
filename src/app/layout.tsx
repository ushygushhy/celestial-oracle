import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Cinzel, Cinzel_Decorative, EB_Garamond, Noto_Sans_Symbols, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Masthead } from "@/components/layout/Masthead";
import { listPeople } from "@/lib/db/people";
import { OracleChat } from "@/components/chat/OracleChat";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const cinzelDeco = Cinzel_Decorative({ variable: "--font-cinzel-deco", subsets: ["latin"], weight: ["400", "700", "900"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "700", "800", "900"] });
const garamond = EB_Garamond({ variable: "--font-garamond", subsets: ["latin", "latin-ext"], style: ["normal", "italic"] });
const symbols = Noto_Sans_Symbols({ variable: "--font-symbols", subsets: ["symbols"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Celestial Oracle",
  description: "A personal astrology, numerology and tarot workstation.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value === "almanac" ? "almanac" : "midnight";
  const activePerson = Number(cookieStore.get("person")?.value) || null;
  const people = listPeople().map((p) => ({ id: p.id, name: p.name, birthDate: p.birthDate }));

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${cinzel.variable} ${cinzelDeco.variable} ${playfair.variable} ${garamond.variable} ${symbols.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <Masthead people={people} activePersonId={activePerson} theme={theme} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-16 pt-6 sm:px-6">{children}</main>
        <footer className="mx-auto w-full max-w-[1500px] px-6 pb-8 text-center text-xs text-faint">
          <div className="rule-hair mb-3" />
          Ephemeris: Swiss Ephemeris (AGPL) · Time zones: IANA tz database with backzone · Places: © OpenStreetMap contributors
        </footer>
        <OracleChat people={people.map(({ id, name }) => ({ id, name }))} activePersonId={activePerson} />
      </body>
    </html>
  );
}
