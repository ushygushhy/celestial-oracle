/** Short, original meanings for numerology numbers. */

export interface NumberMeaning {
  keyword: string;
  core: string;
}

export const NUMBER_MEANINGS: Record<number, NumberMeaning> = {
  1: { keyword: "The Initiator", core: "Independence, will and beginnings. Leads from the front, learns to trust its own direction and to act before certainty arrives." },
  2: { keyword: "The Diplomat", core: "Partnership, receptivity and nuance. Builds through cooperation and patience; the lesson is to value its own needs inside relationship." },
  3: { keyword: "The Communicator", core: "Expression, creativity and joy. Thrives on words, art and play; the challenge is focus and carrying ideas through." },
  4: { keyword: "The Builder", core: "Structure, discipline and craft. Makes things last through steady work; the lesson is flexibility within the frame." },
  5: { keyword: "The Adventurer", core: "Freedom, change and experience. Learns through the senses and movement; the challenge is commitment without feeling caged." },
  6: { keyword: "The Nurturer", core: "Responsibility, love and home. Gives care and beauty to others; the lesson is to give without control or self-neglect." },
  7: { keyword: "The Seeker", core: "Inner life, analysis and spirit. Needs solitude and depth to find truth; the challenge is trust and letting others in." },
  8: { keyword: "The Executive", core: "Power, ambition and material mastery. Organises resources and authority; the lesson is ethical use of power and balance with spirit." },
  9: { keyword: "The Humanitarian", core: "Completion, compassion and wisdom. Serves the wider world and lets go gracefully; the lesson is release without bitterness." },
  11: { keyword: "Master 11 · The Illuminator", core: "Heightened intuition and inspiration (resting on the 2). Sensitive, visionary and nervous in equal measure; asked to channel insight into service." },
  22: { keyword: "Master 22 · The Master Builder", core: "Vision made concrete at scale (resting on the 4). Great practical capacity; asked to build something that outlasts the self." },
  33: { keyword: "Master 33 · The Master Teacher", core: "Compassionate guidance and healing (resting on the 6). Rare and demanding; asked to uplift through selfless care." },
};

export const PERSONAL_YEAR: Record<number, string> = {
  1: "A new nine-year cycle begins: plant seeds, start projects, take initiative. What you begin now sets the tone for years.",
  2: "A slower year of patience, partnership and detail. Cultivate what you planted; cooperation outperforms force.",
  3: "Expansion, visibility and creativity. Socialise, write, make, enjoy — but watch scattered energy.",
  4: "Foundation work: systems, health, finances, home. Effort now is unglamorous and lasting.",
  5: "Change, travel and freedom. Expect the unexpected; adapt, explore and loosen what has become rigid.",
  6: "Responsibility, love and domestic matters. Relationships, family and commitments ask for attention and care.",
  7: "A reflective, inward year: study, spiritual practice, rest and analysis. Answers come through solitude.",
  8: "Harvest and power: career, money, authority and recognition. Results reflect the effort of the cycle.",
  9: "Completion and release. Finish, forgive, clear out — make room for the new cycle that begins next year.",
  11: "A master year of illumination and heightened sensitivity (a higher octave of 2): inspiration arrives; ground it.",
  22: "A master year of building on a large scale (a higher octave of 4): ambitious plans can become real.",
  33: "A master year of compassionate service (a higher octave of 6).",
};

export const KARMIC_DEBT_MEANINGS: Record<number, string> = {
  13: "13/4 — Effort and focus: shortcuts backfire; steady, disciplined work turns frustration into lasting achievement.",
  14: "14/5 — Freedom with moderation: the lesson is self-control and commitment amid constant change.",
  16: "16/7 — The fall of the ego: sudden upheavals strip away illusion and pride, opening the way to genuine insight.",
  19: "19/1 — Independence balanced with humility: learning to stand alone without isolating, and to accept help.",
};

export const meaningOf = (n: number) => NUMBER_MEANINGS[n] ?? NUMBER_MEANINGS[((n - 1) % 9) + 1];
