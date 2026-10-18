// Draws the band that arrives (P2.1): five people from the valley's neighbouring settlements, each
// with a culture's given name, an age, attributes from their race, traits, and skills with a fixed
// potential. Pure: every draw comes from the stream it is given.
import type { BandDef, EngineContent, RngStream } from '../core/index.ts';

export interface Home {
  /** The settlement, '' when the world has no region (a plain seed). */
  name: string;
  /** The culture's id. */
  culture: string;
  days: number;
  dir: string;
}

export interface Person {
  name: string;
  sex: string;
  race: string;
  culture: string;
  home: Home;
  age: number;
  attributes: Record<string, number>;
  /** Level and potential by skill, in `band.skills` order. */
  skills: Record<string, { level: number; potential: number }>;
  traits: string[];
  trade: string;
  hair: string;
  hairColour: string;
  clothes: string;
}

const VOWELS = /[aeiouy]/i;

/** Joins name parts so a doubled letter at the seam stays doubled, not tripled ("Gunn" + "nar"). */
function join(start: string, end: string): string {
  return start && end && start.at(-1)!.toLowerCase() === end[0]!.toLowerCase()
    ? start + end.slice(1)
    : start + end;
}

/** Three consonants in a row read badly ("Strl"); a name with them is drawn again. */
function awkward(name: string): boolean {
  let run = 0;
  for (const ch of name) {
    run = VOWELS.test(ch) ? 0 : run + 1;
    if (run >= 3) return true;
  }
  return false;
}

function givenName(rng: RngStream, content: EngineContent, culture: string, sex: string): string {
  const names = content.cultures.find((c) => c.id === culture)!.names;
  const whole = names.givenNames?.[sex];
  if (whole?.length) return rng.pick(whole);
  let name = '';
  for (let k = 0; k < 6; k += 1) {
    const start = rng.pick(names.givenStarts);
    const end = rng.pick(names.givenEnds);
    name = join(start, end);
    // A lone consonant after a consonant ("Modk") reads as badly as three in a row.
    const stray = end.length === 1 && !VOWELS.test(end) && !VOWELS.test(start.at(-1) ?? 'a');
    if (!awkward(name) && !stray) break;
  }
  return name;
}

const dice = (rng: RngStream, n: number): number => {
  let sum = 0;
  for (let k = 0; k < n; k += 1) sum += rng.between(1, 6);
  return sum - Math.floor((7 * n) / 2);
};

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The best skill now; a tie goes to the higher potential, then to the skill listed first. */
export function tradeOf(band: BandDef, skills: Person['skills']): string {
  let best = band.skills[0]!;
  for (const id of band.skills) {
    const a = skills[id]!;
    const b = skills[best]!;
    if (a.level > b.level || (a.level === b.level && a.potential > b.potential)) best = id;
  }
  return best;
}

function drawPerson(rng: RngStream, content: EngineContent, homes: readonly Home[]): Person {
  const { band } = content;
  const home = rng.weighted(
    homes.map((h) => [h, Math.max(1, Math.floor(60 / Math.max(1, h.days)))] as const),
  );
  const culture = content.cultures.find((c) => c.id === home.culture)!;
  const race = content.races.find((r) => r.id === culture.raceId)!;
  const sex = rng.chance(0.5) ? 'f' : 'm';
  const name = givenName(rng, content, culture.id, sex);
  const span = Math.max(
    1,
    Math.floor((race.lifespanYears * band.ageShare) / 100) - race.maturityYears,
  );
  const lived = band.minAdult + rng.int(Math.max(1, span - band.minAdult));
  const adult = Math.min(100, Math.floor((lived * 100) / span)); // percent of adult life lived
  const [lo, hi] = race.attributeRange as [number, number];
  const attributes: Record<string, number> = {};
  for (const [id, mean] of Object.entries(race.attributeMeans))
    attributes[id] = clamp(mean + dice(rng, band.attributeDice), lo, hi);
  const skills: Person['skills'] = {};
  for (const id of band.skills) {
    const learn = content.abilities.find((a) => a.id === id)!.learnAttributes;
    const aptitude = Math.round(learn.reduce((t, k) => t + attributes[k]!, 0) / learn.length);
    const potential = clamp(
      aptitude + band.potentialOffset + dice(rng, 2),
      band.potential[0]!,
      band.potential[1]!,
    );
    const share = band.levelBase + Math.floor((band.levelAdult * adult) / 100);
    const jitter = rng.between(band.levelJitter[0]!, band.levelJitter[1]!);
    skills[id] = { level: Math.round((potential * share * jitter) / 10_000), potential };
  }
  // One skill they made a living by: drawn towards their strongest potentials.
  const picked = rng.weighted(
    band.skills.map((id) => [id, skills[id]!.potential * skills[id]!.potential] as const),
  );
  const floor = band.tradeBase + Math.floor((band.tradeAdult * adult) / 100);
  const s = skills[picked]!;
  s.level = Math.max(s.level, Math.round((s.potential * floor) / 100));
  const traits: string[] = [];
  for (let k = 0; k < band.traits; k += 1) {
    const free = content.traits.filter(
      (t) =>
        !traits.includes(t.id) &&
        !traits.some((o) => t.excludes.includes(o)) &&
        !content.traits.find((o) => traits.includes(o.id) && o.excludes.includes(t.id)),
    );
    if (free.length === 0) break;
    traits.push(rng.weighted(free.map((t) => [t.id, t.weight] as const)));
  }
  const hair = rng.weighted(Object.entries(band.hairStyles));
  const hairColour = rng.pick(band.hair[race.id]!);
  const clothes = rng.pick(band.clothes[culture.id] ?? band.defaultClothes);
  return {
    ...{ name, sex, race: race.id, culture: culture.id, home, age: race.maturityYears + lived },
    ...{ attributes, skills, traits, trade: tradeOf(band, skills) },
    ...{ hair: hair === 'bald' ? '' : hair, hairColour, clothes },
  };
}

const able = (band: BandDef, people: readonly Person[], skill: string): boolean =>
  people.some((p) => p.skills[skill]!.level >= band.able);

/**
 * Draws the band from `homes` (nearer ones more often), with no two given names alike. Whole bands
 * are drawn up to `band.tries` times until someone is able in every `band.must` skill; if none is,
 * the person with the most potential in a missing skill is trained up to `band.able` instead.
 */
export function drawBand(rng: RngStream, content: EngineContent, homes: readonly Home[]): Person[] {
  const { band } = content;
  let people: Person[] = [];
  for (let attempt = 0; attempt < band.tries; attempt += 1) {
    people = [];
    for (let guard = 0; people.length < band.size && guard < band.size * 20; guard += 1) {
      const p = drawPerson(rng, content, homes);
      if (!people.some((o) => o.name === p.name)) people.push(p);
    }
    if (band.must.every((m) => able(band, people, m))) return people;
  }
  for (const m of band.must) {
    if (able(band, people, m)) continue;
    const best = people.reduce((a, b) => (b.skills[m]!.potential > a.skills[m]!.potential ? b : a));
    const s = best.skills[m]!;
    s.potential = Math.max(s.potential, band.able);
    s.level = band.able;
    best.trade = tradeOf(band, best.skills);
  }
  return people;
}
