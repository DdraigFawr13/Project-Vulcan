// A child born in the valley (P6.1, V-145): one parent's race, the mother's culture and its names,
// attributes from the race with a few mild gifts and weaknesses passed from a parent (family.json
// `inherit`), parents who share a parent making a weakness likelier, skills with a potential and
// no level, traits drawn as anyone's, and a parent's hair. Pure: every draw is from `rng`.
import type { EngineContent, EntityRow, RngStream } from '../core/index.ts';
import { clamp, dice } from '../core/index.ts';
import { drawTraits, givenName, potentialOf, tradeOf, type Person } from './band.ts';
import { ATTRIBUTES } from './row.ts';

/** What a child took from a parent: the word (family.json `gifts` or `weaknesses`), from whom. */
export interface Inherited {
  word: string;
  from: 'mother' | 'father';
  gift: boolean;
}

/** Whether two share a living or dead parent. */
const closeKin = (a: EntityRow, b: EntityRow): boolean =>
  (!!a['mother'] && a['mother'] === b['mother']) || (!!a['father'] && a['father'] === b['father']);

/** Gifts and weaknesses from the parents, applied to `attributes`. */
function inherit(
  rng: RngStream,
  content: EngineContent,
  race: EngineContent['races'][number],
  parents: readonly [EntityRow, EntityRow],
  attributes: Record<string, number>,
): Inherited[] {
  const odds = content.family.inherit;
  const kin = closeKin(parents[0], parents[1]) ? odds.kin : 0;
  const out: Inherited[] = [];
  for (const id of ATTRIBUTES) {
    const mean = (race.attributeMeans as Record<string, number>)[id] ?? 10;
    parents.forEach((p, k) => {
      const v = (p[id] as number) ?? mean;
      const from = k === 0 ? 'mother' : 'father';
      if (v >= mean + odds.by && rng.int(100) < odds.gift) {
        attributes[id] = Math.max(attributes[id]!, v);
        out.push({ word: content.family.gifts[id] ?? id, from, gift: true });
      } else if (v <= mean - odds.by && rng.int(100) < odds.weakness + kin) {
        attributes[id] = Math.min(attributes[id]!, v);
        out.push({ word: content.family.weaknesses[id] ?? id, from, gift: false });
      }
    });
  }
  return out;
}

/** A newborn of `mother` and `father`, named unlike anyone in `taken`. */
export function drawChild(
  rng: RngStream,
  content: EngineContent,
  [mother, father]: readonly [EntityRow, EntityRow],
  taken: readonly string[],
): { person: Person; inherited: Inherited[] } {
  const { band } = content;
  const raceId =
    mother['race'] === father['race'] ? mother['race'] : rng.pick([mother['race'], father['race']]);
  const race = content.races.find((r) => r.id === raceId) ?? content.races[0]!;
  const culture = mother['culture'] as string;
  const sex = rng.chance(0.5) ? 'f' : 'm';
  let name = givenName(rng, content, culture, sex);
  for (let k = 0; k < 20 && taken.includes(name); k += 1)
    name = givenName(rng, content, culture, sex);
  const [lo, hi] = race.attributeRange as [number, number];
  const attributes: Record<string, number> = {};
  for (const [id, mean] of Object.entries(race.attributeMeans))
    attributes[id] = clamp(mean + dice(rng, band.attributeDice), lo, hi);
  const inherited = inherit(rng, content, race, [mother, father], attributes);
  const skills: Person['skills'] = {};
  for (const id of band.skills)
    skills[id] = { level: 0, potential: potentialOf(rng, content, attributes, id) };
  const looks = rng.chance(0.5) ? mother : father;
  const hair = rng.weighted(Object.entries(band.hairStyles));
  const person: Person = {
    ...{ name, sex, race: race.id, culture, age: 0, attributes, skills },
    home: { name: '', culture, days: 0, dir: '' },
    traits: drawTraits(rng, content),
    trade: tradeOf(band, skills),
    ...{ hair: hair === 'bald' ? '' : hair, hairColour: looks['hairColour'] as string },
    clothes: rng.pick(band.clothes[culture] ?? band.defaultClothes),
  };
  return { person, inherited };
}
