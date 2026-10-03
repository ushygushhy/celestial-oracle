/**
 * The 78-card tarot deck: upright/reversed meanings (original wording),
 * elements, Golden Dawn astrological correspondences and numerology.
 */

export type Suit = "wands" | "cups" | "swords" | "pentacles";
export type Element = "fire" | "water" | "air" | "earth";

export interface TarotCard {
  id: string;
  name: string;
  arcana: "major" | "minor";
  suit?: Suit;
  /** Major 0–21; minor 1–10, 11 Page, 12 Knight, 13 Queen, 14 King */
  number: number;
  roman?: string;
  element: Element;
  astrology: string;
  /** astrological glyph(s) used on the card face */
  glyph: string;
  numerology: string;
  upright: { keywords: string[]; meaning: string };
  reversed: { keywords: string[]; meaning: string };
}

const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
const NUM_THEME: Record<number, string> = {
  0: "0 — pure potential, the unformed",
  1: "1 — beginnings, will, the seed",
  2: "2 — duality, choice, balance",
  3: "3 — growth, expression, fruit",
  4: "4 — structure, stability, foundation",
  5: "5 — conflict, change, disruption",
  6: "6 — harmony, reciprocity, recovery",
  7: "7 — reflection, testing, the inner work",
  8: "8 — movement, power, mastery",
  9: "9 — culmination, solitude, near-completion",
  10: "10 — completion and the turn to a new cycle",
};
const reduceNum = (n: number): number => (n > 9 ? reduceNum(String(n).split("").reduce((a, b) => a + Number(b), 0)) : n);

type MajorRow = [string, string, string, string, string[], string, string[], string];
// [name, astrology, glyph, element, upright keywords, upright meaning, reversed keywords, reversed meaning]
const MAJORS: MajorRow[] = [
  ["The Fool", "Air (Uranus)", "♅", "air", ["beginnings", "faith", "spontaneity", "innocence"], "A leap into the unknown with an open heart. Trust the journey more than the map; freedom comes from beginning before you feel ready.", ["recklessness", "naivety", "hesitation"], "Either a careless leap that ignores real risk, or fear that keeps you on the cliff edge. Look before you jump — then jump."],
  ["The Magician", "Mercury", "☿", "air", ["will", "skill", "manifestation", "focus"], "All four elements are on your table. Concentrated intention and skill turn ideas into reality; you have what you need to act.", ["manipulation", "scattered power", "untapped talent"], "Talent misdirected or unused, or cleverness used to deceive. Realign intention with integrity."],
  ["The High Priestess", "Moon", "☽", "water", ["intuition", "mystery", "inner knowing", "stillness"], "The answer is beneath the surface. Be quiet, observe, and trust what you know without being able to explain it.", ["secrets", "disconnection from intuition", "surface noise"], "Inner guidance is being drowned out, or something is concealed. Withdraw from the noise to hear yourself."],
  ["The Empress", "Venus", "♀", "earth", ["abundance", "nurture", "fertility", "beauty"], "Creativity and care bear fruit. Tend what you love — bodies, projects, gardens, people — and let pleasure nourish growth.", ["smothering", "creative block", "self-neglect"], "Over-giving, dependency, or neglect of your own needs blocks the flow of abundance."],
  ["The Emperor", "Aries", "♈", "fire", ["authority", "structure", "protection", "leadership"], "Build order and take responsibility. Clear boundaries and decisive leadership create safety and lasting results.", ["rigidity", "domination", "lack of discipline"], "Control has become tyranny — or structure is missing entirely. Find authority that serves rather than suppresses."],
  ["The Hierophant", "Taurus", "♉", "earth", ["tradition", "teaching", "institutions", "belief"], "Wisdom handed down through teachers, rituals and shared values. Learning within a tradition gives form to the sacred.", ["dogma", "rebellion", "unconventional path"], "Questioning inherited rules — healthy if it leads to your own truth, unhealthy if it is reaction for its own sake."],
  ["The Lovers", "Gemini", "♊", "air", ["union", "choice", "values", "alignment"], "A meaningful relationship or a choice that defines who you are. Choose from your deepest values, not convenience.", ["disharmony", "misalignment", "avoidance of choice"], "A rift between head and heart, or between partners. Honest self-examination restores alignment."],
  ["The Chariot", "Cancer", "♋", "water", ["determination", "victory", "willpower", "direction"], "Harness opposing forces and drive forward. Discipline and focused will carry you through obstacles to success.", ["loss of direction", "aggression", "scattered force"], "Pulled in two directions or pushing too hard. Regain the reins before charging on."],
  ["Strength", "Leo", "♌", "fire", ["courage", "gentle power", "compassion", "patience"], "True strength is calm and kind. Meet raw instinct with patience; love tames what force cannot.", ["self-doubt", "raw emotion", "inner weakness"], "Fear or anger is in charge. Reconnect with quiet confidence rather than forcing control."],
  ["The Hermit", "Virgo", "♍", "earth", ["solitude", "introspection", "guidance", "wisdom"], "Step back from the crowd and carry your own lantern. Solitude and reflection reveal the next step.", ["isolation", "loneliness", "withdrawal"], "Healthy retreat has become isolation — or you avoid the reflection you need. Seek balance."],
  ["Wheel of Fortune", "Jupiter", "♃", "fire", ["cycles", "fate", "turning point", "luck"], "The wheel turns: a change of fortune and a new cycle. Ride it with grace; what rises falls and rises again.", ["resistance to change", "bad luck", "repeating patterns"], "Fighting the turn of events, or stuck in a loop. Ask what pattern is asking to be broken."],
  ["Justice", "Libra", "♎", "air", ["fairness", "truth", "cause and effect", "accountability"], "Actions meet their consequences. Weigh things honestly, take responsibility, and a fair outcome follows.", ["injustice", "dishonesty", "avoiding accountability"], "Imbalance, bias or self-deception. The scales want a more honest accounting."],
  ["The Hanged Man", "Water (Neptune)", "♆", "water", ["surrender", "pause", "new perspective", "sacrifice"], "Suspension by choice. Let go of control and see the situation upside down; the pause brings revelation.", ["stalling", "needless sacrifice", "indecision"], "Martyrdom or limbo without purpose. Release the stalemate or make the sacrifice count."],
  ["Death", "Scorpio", "♏", "water", ["endings", "transformation", "transition", "release"], "Something must end for new life to begin. Let it go cleanly; transformation is underway.", ["resisting change", "stagnation", "fear of endings"], "Clinging to what is already over prolongs the pain. Allow the ending."],
  ["Temperance", "Sagittarius", "♐", "fire", ["balance", "moderation", "alchemy", "patience"], "Blend opposites slowly and with care. The middle way and steady practice create something new.", ["excess", "imbalance", "impatience"], "Extremes and haste upset the mixture. Return to measure and rhythm."],
  ["The Devil", "Capricorn", "♑", "earth", ["attachment", "shadow", "temptation", "materialism"], "Chains of habit, desire or fear — often looser than they look. Name the bondage to begin to release it.", ["release", "breaking free", "facing the shadow"], "Loosening an addiction or unhealthy tie; reclaiming power from what held you."],
  ["The Tower", "Mars", "♂", "fire", ["upheaval", "revelation", "sudden change", "liberation"], "A structure built on false foundations falls. Shocking, but clarifying: the truth sets you free.", ["averted disaster", "fear of change", "delayed collapse"], "Resisting an inevitable upheaval, or an internal shake-up rather than an external one."],
  ["The Star", "Aquarius", "♒", "air", ["hope", "renewal", "inspiration", "serenity"], "After the storm, healing and faith return. Let yourself be guided by a bright, gentle hope.", ["despair", "disconnection", "lost faith"], "Hope has dimmed. Small acts of renewal reconnect you with your guiding light."],
  ["The Moon", "Pisces", "♓", "water", ["illusion", "dreams", "the unconscious", "uncertainty"], "Not everything is as it seems. Move carefully through the fog, attend to dreams and fears, and trust intuition over appearances.", ["clarity returning", "released fear", "confusion"], "Illusions begin to lift — or anxiety distorts perception. Check facts and feelings separately."],
  ["The Sun", "Sun", "☉", "fire", ["joy", "vitality", "success", "clarity"], "Warmth, confidence and success. Things become clear and life feels simple and bright.", ["temporary clouds", "dimmed joy", "overconfidence"], "Joy is present but muted, or ego overshines. The sun is still there behind the cloud."],
  ["Judgement", "Fire (Pluto)", "♇", "fire", ["awakening", "reckoning", "calling", "rebirth"], "A call to rise and answer your purpose. Review the past honestly and step into a renewed self.", ["self-doubt", "ignoring the call", "harsh self-judgement"], "Refusing the summons or judging yourself too harshly to move forward."],
  ["The World", "Saturn (Earth)", "♄", "earth", ["completion", "integration", "wholeness", "achievement"], "A cycle completes in fulfilment. Celebrate the integration of what you have learned before the next journey.", ["incompletion", "loose ends", "delay"], "So close to completion — tie up what remains rather than starting something new."],
];

const SUIT_INFO: Record<Suit, { element: Element; name: string; elementName: string }> = {
  wands: { element: "fire", name: "Wands", elementName: "Fire" },
  cups: { element: "water", name: "Cups", elementName: "Water" },
  swords: { element: "air", name: "Swords", elementName: "Air" },
  pentacles: { element: "earth", name: "Pentacles", elementName: "Earth" },
};

/** Golden Dawn decan attributions for 2–10. */
const PIP_ASTRO: Record<Suit, string[]> = {
  wands: ["Mars in Aries", "Sun in Aries", "Venus in Aries", "Saturn in Leo", "Jupiter in Leo", "Mars in Leo", "Mercury in Sagittarius", "Moon in Sagittarius", "Saturn in Sagittarius"],
  cups: ["Venus in Cancer", "Mercury in Cancer", "Moon in Cancer", "Mars in Scorpio", "Sun in Scorpio", "Venus in Scorpio", "Saturn in Pisces", "Jupiter in Pisces", "Mars in Pisces"],
  swords: ["Moon in Libra", "Saturn in Libra", "Jupiter in Libra", "Venus in Aquarius", "Mercury in Aquarius", "Moon in Aquarius", "Jupiter in Gemini", "Mars in Gemini", "Sun in Gemini"],
  pentacles: ["Jupiter in Capricorn", "Mars in Capricorn", "Sun in Capricorn", "Mercury in Taurus", "Moon in Taurus", "Saturn in Taurus", "Sun in Virgo", "Venus in Virgo", "Mercury in Virgo"],
};
const GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄",
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};
const COURT_ELEMENT: Record<number, string> = { 11: "Earth", 12: "Air", 13: "Water", 14: "Fire" };
const RANK = ["", "Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];

type MinorRow = [string[], string, string[], string];
// [upright keywords, upright meaning, reversed keywords, reversed meaning] for Ace..King
const MINORS: Record<Suit, MinorRow[]> = {
  wands: [
    [["inspiration", "spark", "potential"], "A surge of creative fire: a new passion, idea or venture wants to be born.", ["delay", "lack of drive", "false start"], "The spark is there but stalls — clarify what you really want."],
    [["planning", "decisions", "vision"], "Surveying the world from a position of strength; plan the next move with courage.", ["fear of the unknown", "poor planning"], "Staying safe instead of committing to a bigger vision."],
    [["expansion", "foresight", "progress"], "Your ships are coming in; early efforts open wider horizons.", ["obstacles", "delays", "short-sightedness"], "Plans meet setbacks; reassess the route rather than the goal."],
    [["celebration", "home", "harmony"], "A joyful milestone, homecoming or stable foundation worth celebrating.", ["instability", "transition", "tension at home"], "The celebration is delayed or the foundation feels shaky."],
    [["competition", "conflict", "friction"], "Clashing egos and energetic rivalry — healthy sport or needless squabbles.", ["avoiding conflict", "resolution"], "Tension is easing, or conflict is being suppressed rather than resolved."],
    [["victory", "recognition", "confidence"], "Public success and acclaim; you are seen for what you have achieved.", ["ego", "fall from grace", "lack of recognition"], "Seeking applause, or success feels hollow or unacknowledged."],
    [["defence", "perseverance", "conviction"], "Holding your ground against challenge; stand by what you believe.", ["overwhelm", "giving up", "defensiveness"], "Exhausted by the fight — choose which battles still matter."],
    [["speed", "momentum", "news"], "Rapid movement and swift developments; things finally fly.", ["delays", "frustration", "haste"], "Momentum stalls or rushing creates errors."],
    [["resilience", "persistence", "last stand"], "Battle-worn but still standing; one more push brings you through.", ["paranoia", "fatigue", "rigidity"], "Guardedness has turned into exhaustion; let support in."],
    [["burden", "responsibility", "hard work"], "Carrying too much on your own; success has brought heavy obligations.", ["delegation", "release", "collapse"], "Time to put some loads down before they crush you."],
    [["enthusiasm", "exploration", "messages"], "A curious, eager spirit and exciting news or a new adventure.", ["scattered energy", "impatience", "bad news"], "Ideas without follow-through, or restless distraction."],
    [["energy", "adventure", "impulsiveness"], "Charging ahead with passion and daring; action over deliberation.", ["recklessness", "frustration", "delays"], "Haste and hot-headedness lead to burnout or broken plans."],
    [["confidence", "warmth", "determination"], "Vibrant, magnetic and self-assured; lead with warmth and courage.", ["insecurity", "jealousy", "demanding"], "Confidence slips into envy or need for attention."],
    [["leadership", "vision", "boldness"], "A visionary who inspires others and turns big ideas into enterprise.", ["impulsiveness", "domineering", "high expectations"], "Leadership becomes arrogance or impatience with others."],
  ],
  cups: [
    [["new feelings", "love", "compassion"], "An overflowing heart: new love, emotional renewal or spiritual opening.", ["blocked emotions", "emptiness"], "Feelings are held back or the cup feels empty — fill yourself first."],
    [["partnership", "attraction", "mutual respect"], "A meeting of hearts; connection based on equality and care.", ["imbalance", "broken trust", "tension"], "Disharmony or a one-sided bond needs honest repair."],
    [["friendship", "celebration", "community"], "Joyful gatherings and the support of friends.", ["overindulgence", "gossip", "isolation"], "Too much of a good thing, or feeling outside the circle."],
    [["apathy", "contemplation", "reevaluation"], "Boredom or withdrawal; something offered goes unnoticed.", ["new motivation", "acceptance"], "Emerging from a slump and noticing what is on offer."],
    [["loss", "grief", "regret"], "Mourning what has spilled — yet two cups remain standing.", ["acceptance", "moving on", "forgiveness"], "Healing begins; turning toward what remains."],
    [["nostalgia", "innocence", "memories"], "Sweet memories, childhood joys or a reunion with the past.", ["living in the past", "moving forward"], "Letting nostalgia keep you from the present."],
    [["choices", "fantasy", "illusion"], "Many tempting options, not all real; daydreams cloud judgement.", ["clarity", "decisiveness", "alignment"], "The fog clears and the real choice becomes obvious."],
    [["walking away", "seeking meaning", "withdrawal"], "Leaving behind what no longer fulfils you to search for something deeper.", ["fear of change", "aimless drifting"], "Hesitating to leave, or leaving without direction."],
    [["contentment", "satisfaction", "wishes"], "The wish card: emotional and material satisfaction.", ["smugness", "dissatisfaction", "indulgence"], "Contentment on the surface masks a deeper wish."],
    [["harmony", "family", "fulfilment"], "Lasting happiness, a loving home and emotional fulfilment.", ["disconnection", "misaligned values"], "Family tensions or a gap between the ideal and reality."],
    [["intuition", "creative messages", "sensitivity"], "A gentle dreamer bringing an emotional or creative invitation.", ["emotional immaturity", "escapism"], "Moodiness or retreat into fantasy."],
    [["romance", "charm", "following the heart"], "The romantic idealist bearing an offer of love or art.", ["moodiness", "unrealistic expectations"], "Romance without substance, or jealousy and sulking."],
    [["compassion", "emotional security", "intuition"], "Deeply caring and intuitive; nurture others while honouring your own depths.", ["codependence", "insecurity", "martyrdom"], "Absorbing others' feelings until you lose yourself."],
    [["emotional balance", "diplomacy", "wisdom"], "Calm mastery of feeling; compassionate, steady counsel.", ["manipulation", "coldness", "volatility"], "Repressed emotion surfaces as control or outbursts."],
  ],
  swords: [
    [["clarity", "breakthrough", "truth"], "A sharp new insight cuts through confusion; speak and think clearly.", ["confusion", "misinformation", "harshness"], "Clouded thinking, or truth used as a weapon."],
    [["stalemate", "indecision", "avoidance"], "Blindfolded between two options; a decision deferred.", ["information overload", "decision made"], "The stalemate breaks — or overwhelm makes choice harder."],
    [["heartbreak", "grief", "painful truth"], "Sorrow and emotional pain that must be felt to heal.", ["recovery", "releasing pain", "forgiveness"], "The worst of the hurt is passing."],
    [["rest", "recovery", "contemplation"], "Retreat and recuperate; the mind needs stillness.", ["restlessness", "burnout", "reawakening"], "Pushing on without rest, or ready to rejoin the world."],
    [["conflict", "hollow victory", "tension"], "Winning at a cost; consider whether the battle is worth it.", ["reconciliation", "making amends"], "Moving past conflict and repairing bridges."],
    [["transition", "moving on", "calmer waters"], "Leaving troubled waters behind for a quieter shore.", ["unresolved baggage", "resistance"], "Carrying old troubles into the new place."],
    [["strategy", "stealth", "deception"], "Cunning, strategy or getting away with something — check who is deceiving whom.", ["coming clean", "conscience", "exposed"], "Secrets surface; honesty becomes the better strategy."],
    [["restriction", "self-imposed limits", "victimhood"], "Feeling trapped by thoughts more than by reality.", ["release", "new perspective", "freedom"], "Seeing the way out that was there all along."],
    [["anxiety", "worry", "nightmares"], "Sleepless worry and fear magnified in the dark.", ["hope", "reaching out", "despair easing"], "Sharing the fear shrinks it."],
    [["endings", "rock bottom", "betrayal"], "A painful ending — the worst is over, dawn follows.", ["recovery", "regeneration", "resisting the end"], "Slowly rising again from the ground."],
    [["curiosity", "new ideas", "vigilance"], "A sharp, inquisitive mind eager to learn and speak up.", ["gossip", "all talk", "scattered thoughts"], "Words without action or careless speech."],
    [["ambition", "action", "drive"], "Charging toward a goal with fierce determination.", ["recklessness", "aggression", "burnout"], "Rushing in without thinking of the cost."],
    [["clarity", "independence", "honesty"], "Perceptive, direct and fair; wisdom earned through experience.", ["coldness", "bitterness", "cruelty"], "Hurt has hardened into harshness."],
    [["intellect", "authority", "truth"], "Clear judgement and ethical authority; lead with reason.", ["manipulation", "tyranny", "abuse of power"], "Intellect used to dominate or deceive."],
  ],
  pentacles: [
    [["opportunity", "prosperity", "manifestation"], "A tangible new opportunity: money, health, a job or a home.", ["missed chance", "poor planning"], "An opportunity slips through careless planning."],
    [["balance", "adaptability", "priorities"], "Juggling resources and responsibilities with flexibility.", ["overwhelm", "disorganisation"], "Too many balls in the air; simplify."],
    [["teamwork", "craft", "collaboration"], "Skilled work recognised; building something together.", ["disharmony", "poor workmanship"], "Misaligned teams or rushed work."],
    [["security", "saving", "control"], "Holding tight to resources; stability, perhaps at the cost of flow.", ["greed", "release", "generosity"], "Loosening an over-tight grip — or clinging harder."],
    [["hardship", "loss", "isolation"], "Financial or health struggle; help is nearer than it seems.", ["recovery", "spiritual poverty easing"], "Difficult times lifting; accepting support."],
    [["generosity", "charity", "sharing"], "Giving and receiving in balance; resources flow where needed.", ["strings attached", "debt", "inequality"], "Help with hidden costs or one-sided giving."],
    [["patience", "investment", "long-term view"], "Assessing slow growth; your investment will pay off with time.", ["impatience", "poor returns"], "Frustration at slow results — or effort in the wrong place."],
    [["diligence", "mastery", "skill"], "Dedicated practice and skill-building; apprenticeship to excellence.", ["perfectionism", "lack of focus"], "Busywork or obsessive detail without progress."],
    [["self-sufficiency", "luxury", "independence"], "Enjoying the fruits of your labour in refined independence.", ["overwork", "superficiality"], "Comfort bought at the cost of freedom or depth."],
    [["legacy", "wealth", "family"], "Lasting wealth, inheritance and multi-generational security.", ["financial loss", "family disputes"], "Legacy or money becomes a source of conflict."],
    [["ambition", "study", "new venture"], "A diligent learner eager to make a dream real.", ["procrastination", "lack of progress"], "Plans that never leave the drawing board."],
    [["reliability", "routine", "hard work"], "Steady, methodical progress; slow and sure wins.", ["boredom", "stagnation", "laziness"], "Routine has become a rut."],
    [["nurturing", "practicality", "abundance"], "Practical care and down-to-earth generosity; home and body thrive.", ["self-care neglected", "smothering"], "Caring for everyone but yourself."],
    [["wealth", "security", "discipline"], "A successful, dependable provider who builds lasting prosperity.", ["materialism", "stubbornness"], "Status and money eclipse what matters."],
  ],
};

function majorCards(): TarotCard[] {
  return MAJORS.map(([name, astro, glyph, element, uk, um, rk, rm], i) => ({
    id: `major-${String(i).padStart(2, "0")}`,
    name,
    arcana: "major",
    number: i,
    roman: ROMAN[i],
    element: element as Element,
    astrology: astro,
    glyph,
    numerology: i === 0 ? NUM_THEME[0] : `${i}${i > 9 ? ` → ${reduceNum(i)}` : ""} — ${NUM_THEME[reduceNum(i)].split(" — ")[1]}`,
    upright: { keywords: uk, meaning: um },
    reversed: { keywords: rk, meaning: rm },
  }));
}

function minorCards(): TarotCard[] {
  const out: TarotCard[] = [];
  for (const suit of ["wands", "cups", "swords", "pentacles"] as Suit[]) {
    const info = SUIT_INFO[suit];
    MINORS[suit].forEach(([uk, um, rk, rm], idx) => {
      const n = idx + 1;
      const astro = n === 1 ? `Root of ${info.elementName}` : n <= 10 ? PIP_ASTRO[suit][n - 2] : `${COURT_ELEMENT[n]} of ${info.elementName}`;
      const glyph = n >= 2 && n <= 10 ? astro.split(" in ").map((w) => GLYPH[w]).join("") : "";
      out.push({
        id: `${suit}-${String(n).padStart(2, "0")}`,
        name: `${RANK[n]} of ${info.name}`,
        arcana: "minor",
        suit,
        number: n,
        element: info.element,
        astrology: astro,
        glyph,
        numerology: n <= 10 ? NUM_THEME[n] : `Court card — ${RANK[n]} (${COURT_ELEMENT[n].toLowerCase()} aspect of ${info.elementName.toLowerCase()})`,
        upright: { keywords: uk, meaning: um },
        reversed: { keywords: rk, meaning: rm },
      });
    });
  }
  return out;
}

export const DECK: TarotCard[] = [...majorCards(), ...minorCards()];
export const CARD_BY_ID = new Map(DECK.map((c) => [c.id, c]));
