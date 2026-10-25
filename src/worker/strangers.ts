// Strangers and homes as the page shows them (P5.9, P5.14, V-117, V-119, V-121): a stranger's
// page, the Strangers law on the Laws page, each person's Home line and the Build sheet's homes.
// Words come from content `strangers.words`; a pure read of the world, like people.ts.
import { content } from '../content/index.ts';
import {
  clockAt,
  findEvent,
  homeFor,
  householdOf,
  lawDef,
  piecesOf,
  pronouns,
  recordOf,
  rectOf,
  settingOf,
  sizeOf,
  sleepsIn,
  whoseOf,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import { answerView, lawView } from './law.ts';
import type { HouseView } from './protocol-build.ts';
import type { AnswerView, LawView, StrangersLawView } from './protocol-law.ts';
import type { LedgerLine } from './protocol.ts';
import type { StrangerView, WalkerView } from './protocol-people.ts';

const words = content.strangers.words;
const say = (key: string, vars: Record<string, string | number> = {}): string =>
  (words[key] ?? '').replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const nameOf = (rows: readonly { id: string; name: string }[], id: unknown): string =>
  rows.find((r) => r.id === id)?.name ?? String(id);
const people = (world: WorldState): EntityRow[] => world.entities['person'] ?? [];
const personOf = (world: WorldState, id: number) => people(world).find((p) => p.id === id);

/** "9 Leaffall" */
function dayOf(tick: number): string {
  const c = clockAt(tick, content.calendar);
  return `${c.day} ${content.calendar.monthNames[c.month]!}`;
}

/** The "Known for" row: why their home gives the skill they bring, and how well they have it. */
function knownRow(world: WorldState, p: EntityRow, culture: string): StrangerView['rows'] {
  const [id, key] = [p['known'] as string, p['knownWhy'] as string];
  const row = (world.entities['skill'] ?? []).find(
    (s) => s['person'] === p.id && s['skill'] === id,
  );
  const why = content.strangers.known.why[key];
  if (!row || !why) return [];
  const noun = (content.strangers.known.nouns[id] ?? id).replace(/^an? /, '');
  const [level, potential] = [row['level'] as number, row['potential'] as number];
  const sentence = cap(why.replace('{place}', p['home'] as string).replace('{people}', culture));
  const skill = nameOf(content.abilities, id).toLowerCase();
  return [
    {
      name: 'Known for',
      text: `${sentence}. ${p['name'] as string} brings ${skill} ${level} (can reach ${potential}), ${noun}’s skill.`,
    },
  ];
}

/** A stranger's page while they come, wait or walk away; none for anyone of the colony. */
export function strangerOf(world: WorldState, p: EntityRow): StrangerView | undefined {
  if (p['status'] !== 'stranger') return undefined;
  const { they, them, their } = pronouns(p);
  const waits = p['waits'] as number;
  const where = waits < 0 ? 'goingBack' : p['stranger'] ? 'atGreen' : 'onWay';
  const year = clockAt(world.tick, content.calendar).year;
  const culture = nameOf(content.cultures, p['culture']);
  const kind = content.strangers.kinds.find((k) => k.id === p['reason']);
  const skills = (world.entities['skill'] ?? [])
    .filter((s) => s['person'] === p.id && (s['level'] as number) > 0)
    .sort((a, b) => (b['level'] as number) - (a['level'] as number))
    .slice(0, 3)
    .map(
      (s) =>
        `${nameOf(content.abilities, s['skill']).toLowerCase()} ${s['level'] as number} (can reach ${s['potential'] as number})`,
    );
  const traits = (world.entities['trait'] ?? [])
    .filter((t) => t['person'] === p.id)
    .map((t) => nameOf(content.traits, t['trait']).toLowerCase());
  const leads = content.flock.kinds.find((k) => k.species === p['brings']);
  const dir = p['homeDir'] as string;
  const now = waits < 0 ? 'going' : p['stranger'] ? 'waiting' : 'coming';
  return {
    who: say('who', {
      where: say(where),
      race: nameOf(content.races, p['race']).toLowerCase(),
      culture,
      age: year - (p['born'] as number),
    }),
    rows: [
      {
        name: 'From',
        text: say('from', {
          place: p['home'] as string,
          culture,
          days: p['homeDays'] as number,
          dir,
        }),
      },
      {
        name: `Why ${they} came`,
        text: say('came', { place: p['home'] as string, words: kind?.words ?? '' }),
        why: p['sent'] as number,
      },
      ...knownRow(world, p, culture),
      { name: `${cap(they)} brings`, text: skills.join(', ') || 'no skill to speak of' },
      ...(traits.length ? [{ name: 'Traits', text: traits.join(', ') }] : []),
      ...(leads ? [{ name: `${cap(they)} leads`, text: `a ${leads.femaleName}` }] : []),
      { name: 'Now', text: say(now, { dir, they, them, their }) },
    ],
    foot: say('foot', { they, them }),
  };
}

/** Households who want a home of their own and have none built to sleep in, the longest waiting
 * first and a couple before someone alone the same day: each as its lowest id's row. */
function waiting(world: WorldState): EntityRow[][] {
  const seen = new Set<number>();
  const out: EntityRow[][] = [];
  for (const p of people(world)) {
    if (p['status'] !== 'alive' || !p['wants'] || seen.has(p.id)) continue;
    const ids = householdOf(world, p.id);
    ids.forEach((id) => seen.add(id));
    const home = homeFor(world, p.id);
    if (home?.['state'] === 'built' && sleepsIn(world, content, p.id)?.id === home.id) continue;
    out.push(ids.map((id) => personOf(world, id)!));
  }
  const day = (g: EntityRow[]) => Math.floor((g[0]!['wantsFrom'] as number) / 1440);
  return out.sort((a, b) => day(a) - day(b) || b.length - a.length || a[0]!.id - b[0]!.id);
}

/** Where a person sleeps and their want of a home of their own, in words. */
export function homeOf(world: WorldState, p: EntityRow): WalkerView['home'] {
  if (p['status'] !== 'alive') return undefined;
  const { they, their } = pronouns(p);
  const ids = householdOf(world, p.id);
  const slept = sleepsIn(world, content, p.id);
  const home = homeFor(world, p.id);
  const whose = slept?.['owner']
    ? `${whoseOf(world, householdOf(world, slept['owner'] as number))} home`
    : undefined;
  const where = !slept
    ? 'under the open sky'
    : slept['hall']
      ? 'the hall'
      : slept.id === home?.id
        ? `${ids.length > 1 ? 'their' : their} own home`
        : (whose ?? `the first ${sizeOf(content, slept).name}`);
  const others = people(world)
    .filter(
      (q) =>
        q['status'] === 'alive' &&
        !ids.includes(q.id) &&
        slept &&
        sleepsIn(world, content, q.id)?.id === slept.id,
    )
    .map((q) => q['name'] as string);
  const shared = others.length ? `, with ${list(others)}` : '';
  if (!p['wants'] || (home && slept?.id === home.id)) return { text: `${cap(where)}${shared}.` };
  const since = dayOf(p['wantsFrom'] as number);
  const queue = waiting(world).filter((g) => !homeFor(world, g[0]!.id));
  const at = queue.findIndex((g) => g.some((q) => q.id === p.id));
  const mine = ids.length > 1 ? 'theirs' : `${their === 'his' ? 'his' : 'hers'}`;
  const next = home
    ? home['state'] === 'built'
      ? `${cap(mine)} is built; ${they} moves in tonight.`
      : `${cap(mine)} is going up.`
    : at === 0
      ? `${cap(mine)} is next.`
      : at > 0
        ? `${cap(mine)} comes after ${list(
            queue.slice(0, at).map(
              (g) =>
                `${whoseOf(
                  world,
                  g.map((q) => q.id),
                )}`,
            ),
          )}.`
        : '';
  return {
    text: `${cap(where)}${shared}. ${cap(they)} has wanted a home of ${their} own since ${since}. ${next}`.trim(),
    why: p['wants'] as number,
  };
}

/** The Build sheet's homes: who wants one, who has theirs, who comes next, and the want's rule. */
export function homesRow(
  world: WorldState,
): { need: string; next: string; note: string } | undefined {
  const wanting = people(world).filter((p) => p['status'] === 'alive' && p['wants']);
  if (!wanting.length) return undefined;
  const queue = waiting(world);
  const names = (gs: EntityRow[][]) => list(gs.map((g) => list(g.map((q) => q['name'] as string))));
  const housed = wanting.filter((p) => !queue.some((g) => g.includes(p)));
  const n = queue.reduce((k, g) => k + g.length, 0);
  const need = queue.length
    ? `homes of their own for ${n}: ${names(queue)}.${housed.length ? ` ${list(housed.map((p) => p['name'] as string))} ${housed.length > 1 ? 'have theirs' : 'has one'}.` : ''}`
    : 'everyone has a home of their own.';
  const unplanned = queue.filter((g) => !homeFor(world, g[0]!.id));
  const homes = unplanned.map(
    (g) =>
      `${whoseOf(
        world,
        g.map((q) => q.id),
      )} home`,
  );
  const next = homes.length
    ? `Next: ${homes[0]!}${homes.length > 1 ? `, then ${list(homes.slice(1).map((h) => h.replace(/ home$/, '')))}` : ''}.`
    : '';
  return { need, next, note: `${say('homeWant')} ${say('homeNext')}` };
}

/** "lets them stay", "lets in someone fleeing hunger, sickness, a feud or a war", "sends them away". */
function letsWords(lets: readonly string[] | undefined): string {
  const kinds = content.strangers.kinds;
  const lets_ = lets ?? [];
  if (!lets_.length) return 'sends them away';
  if (kinds.every((k) => lets_.includes(k.id))) return 'lets them stay';
  const names = kinds.filter((k) => lets_.includes(k.id)).map((k) => k.name);
  return `lets in someone fleeing ${names.slice(0, -1).join(', ')}${names.length > 1 ? ' or ' : ''}${names.at(-1)}`;
}

/** The band's word on a stranger, from its line's data. */
function verdictOf(world: WorldState): StrangersLawView['verdict'] {
  const id = world.systems['strangers']?.['last'];
  const e = id ? findEvent(world.log, id) : undefined;
  if (!e) return undefined;
  const group = e.actors.flatMap((a) => personOf(world, a) ?? []);
  const lead = group[0];
  if (!lead) return undefined;
  const stays = e.type === 'people.strangerStays';
  const { they } = group.length > 1 ? { they: 'they' } : pronouns(lead);
  const kind = content.strangers.kinds.find((k) => k.id === lead['reason']);
  const outcome = stays
    ? `${they} ${group.length > 1 ? 'stay' : 'stays'}${kind?.need ? `, fleeing ${kind.name}` : ''}`
    : `${they} ${group.length > 1 ? 'were' : 'was'} turned away`;
  const counts = `${e.data['fors'] as number} for, ${e.data['against'] as number} against`;
  const how = e.data['split']
    ? `Split, so the law decided: ${outcome}.`
    : `Everyone agreed, so the law did not come into it: ${outcome}.`;
  const names = `${list(group.map((q) => q['name'] as string))} of ${lead['home'] as string}`;
  return { text: `${names}, ${dayOf(e.tick)}: ${counts}. ${how}`, why: e.id };
}

/** One answer to the Strangers law, said against the stranger it was given for. */
function strangerAnswer(world: WorldState, a: EntityRow): AnswerView | undefined {
  const view = answerView(world, a);
  if (!view) return undefined;
  const said = findEvent(world.log, a['line'] as number);
  const verdict = said ? findEvent(world.log, said.causes[0] ?? 0) : undefined;
  const lead = verdict ? personOf(world, verdict.actors[0] ?? 0) : undefined;
  const fors = String(verdict?.data['spokeFor'] ?? '')
    .split('|')
    .map(Number);
  const spoke = fors.includes(view.person);
  const stays = verdict?.type === 'people.strangerStays';
  const q = personOf(world, view.person)!;
  const though =
    lead && spoke !== stays
      ? `, though ${pronouns(q).they} spoke ${spoke ? 'for' : 'against'} ${lead['name'] as string}`
      : '';
  const verb = { obeys: 'keeps', grumbles: 'grumbles at', refuses: 'refuses' }[view.answer];
  return { ...view, text: `${view.name} ${verb} the Strangers law${though}.` };
}

const ORDER = ['refuses', 'grumbles', 'obeys'];

/** The Strangers law on the Laws page. */
export function strangersLawView(world: WorldState): StrangersLawView {
  const def = lawDef(content, content.strangers.law)!;
  const s = settingOf(world, content, def.id);
  const row = (world.entities['law'] ?? []).find((r) => r['law'] === def.id);
  const tick = row ? (row['changed'] as number) : undefined;
  const verdict = verdictOf(world);
  return {
    id: def.id,
    name: def.name,
    setting: s.id,
    settings: def.settings.map((x) => ({ id: x.id, name: x.name })),
    about: say('lawAside', {
      settings: def.settings.map((x) => `${x.name} ${letsWords(x.lets)}`).join('; '),
    }),
    since:
      tick === undefined
        ? `${s.name}, the custom since the colony began.`
        : `Set to ${s.name} on ${dayOf(tick)}.`,
    why: row ? (row['line'] as number) : world.begunEvent,
    ...(verdict && { verdict }),
    answers: (world.entities['answer'] ?? [])
      .filter((a) => a['law'] === def.id)
      .flatMap((a) => strangerAnswer(world, a) ?? [])
      .sort((a, b) => ORDER.indexOf(a.answer) - ORDER.indexOf(b.answer) || a.person - b.person),
  };
}

/** A home's or the hall's rows and lines (P5.14) for its tile page; none for another house. */
export function homeRows(
  world: WorldState,
  main: EntityRow,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): Pick<HouseView, 'rows' | 'lines'> {
  const owner = main['owner'] as number;
  if (!owner && !main['hall']) return {};
  const r = rectOf(main);
  const inside = (b: EntityRow) =>
    (b['x'] as number) >= r.x &&
    (b['x'] as number) < r.x + r.w &&
    (b['y'] as number) >= r.y &&
    (b['y'] as number) < r.y + r.h;
  const name = (id: unknown) => (personOf(world, id as number)?.['name'] as string) ?? 'someone';
  const beds = piecesOf(world, 'bed').filter((b) => b['z'] === 0 && inside(b));
  const sleepers = people(world).filter(
    (p) => p['status'] === 'alive' && sleepsIn(world, content, p.id)?.id === main.id,
  );
  const lines: LedgerLine[] = [];
  const add = (id: number | undefined) => {
    const e = id ? recordOf(world, id) : undefined;
    if (e) lines.push(lineOf(e));
  };
  if (!main['hall']) {
    const ids = householdOf(world, owner);
    const owned = beds.filter((b) => b['owner']).map((b) => `${name(b['owner'])}'s`);
    add(main['moved'] as number);
    add(main['built'] as number);
    return {
      rows: [
        { name: 'Household', text: list(ids.map(name)) },
        {
          name: 'Beds',
          text: beds.length
            ? `${beds.length} bed${beds.length > 1 ? 's' : ''}${owned.length ? `, ${list(owned)}` : ''}`
            : 'none yet: bedrolls on the floor',
        },
      ],
      lines,
    };
  }
  const hall = main['hall'] as number;
  const since = findEvent(world.log, hall) ?? recordOf(world, hall);
  const feast = [...world.log].reverse().find((e) => e.type === 'hall.feast');
  const free = Math.max(0, beds.length - sleepers.length);
  add(feast?.id);
  add(hall);
  return {
    rows: [
      {
        name: 'Role',
        text: `the hall${since ? `, since ${dayOf(since.tick)}` : ''}`,
        why: hall,
      },
      {
        name: 'Beds',
        text: `${beds.length}${sleepers.length ? `: ${list(sleepers.map((p) => p['name'] as string))} sleep${sleepers.length > 1 ? '' : 's'} here until ${sleepers.length > 1 ? 'their homes are' : 'a home is'} up` : ''}; ${free} free`,
      },
      ...(feast
        ? [
            {
              name: 'Feasts',
              text: `the harvest-home supper on ${dayOf(feast.tick)}: ${feast.data['count'] as number} ate here`,
              why: feast.id,
            },
          ]
        : [{ name: 'Feasts', text: 'the harvest-home supper is eaten here' }]),
      { name: 'Mourning', text: 'after a burial the mourners gather here' },
    ],
    lines,
  };
}

/** The Laws page: the work-hours law, then the Strangers law. */
export const lawsOf = (world: WorldState): LawView => ({
  ...lawView(world),
  strangers: strangersLawView(world),
});
