// A person's rows (P2.1, P5.9): the `person` row with every field, a row per skill and per trait.
// The band's five are added when the world begins; a stranger when they come to the valley.
import type { WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import type { Person } from './band.ts';
import { SMITHING } from './smithing.ts';

export const ATTRIBUTES = [
  'strength',
  'agility',
  'endurance',
  'intellect',
  'willpower',
  'perception',
  'charisma',
];

export const NEWCOMER_FIELDS = {
  /** Who they came with as a couple (P5.9), sharing a home; 0 for none. */
  partner: 'entity',
  /** The line they came to the green under, for a newcomer; 0 for the band. */
  stranger: 'event',
  /** A stranger's reason kind (strangers.json `kinds`), the line that sent them (the record's,
   * else the draw's) and the flock species they lead in, if any. */
  reason: 'text',
  sent: 'event',
  brings: 'text',
  /** The skill their home is known for and the key that says why (strangers.json `known`). */
  known: 'text',
  knownWhy: 'text',
  /** While a stranger: the tick the band will have spoken by, -1 once turned away; else 0. */
  waits: 'int',
  /** The tick from which they want a home of their own (P5.14), and the line that said so. */
  wantsFrom: 'int',
  wants: 'event',
} as const;

/** Adds `p` standing at (x, y) with `status`, their skills (smithing drawn apart) and traits. */
export function addPerson(
  world: WorldState,
  content: { band: { skills: readonly string[] } },
  p: Person,
  at: { x: number; y: number; status: string; arrived: number; born: number; rest: number },
  smithing: { level: number; potential: number },
  extra: Partial<Record<keyof typeof NEWCOMER_FIELDS, number | string>> = {},
): number {
  const id = addEntity(world, 'person', {
    ...{ name: p.name, sex: p.sex, race: p.race, culture: p.culture },
    ...{ home: p.home.name, homeDays: p.home.days, homeDir: p.home.dir, born: at.born },
    ...Object.fromEntries(ATTRIBUTES.map((a) => [a, p.attributes[a] ?? 0])),
    ...{ trade: p.trade, hair: p.hair, hairColour: p.hairColour, clothes: p.clothes },
    ...{ x: at.x, y: at.y, z: 0, status: at.status, arrived: at.arrived },
    ...{ path: [], stride: 0, rest: at.rest, doing: '', retry: 0, bedTo: 0, chill: 0, seeded: 0 },
    ...{ job: '', target: -1, work: 0, took: 0, next: 0, plan: 0, make: '' },
    ...{ making: '', fine: 0, task: '', what: '', hay: 0, herdId: 0, sat: 0, pail: 0 },
    ...{
      partner: 0,
      stranger: 0,
      reason: '',
      sent: 0,
      brings: '',
      known: '',
      knownWhy: '',
      waits: 0,
    },
    ...{ wantsFrom: 0, wants: 0, ...extra },
  });
  for (const skill of content.band.skills)
    addEntity(world, 'skill', { person: id, skill, ...p.skills[skill]!, xp: 0 });
  addEntity(world, 'skill', { person: id, skill: SMITHING, ...smithing, xp: 0 });
  for (const trait of p.traits) addEntity(world, 'trait', { person: id, trait });
  return id;
}
