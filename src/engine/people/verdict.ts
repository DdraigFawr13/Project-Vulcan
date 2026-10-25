// The band's word on a stranger at the green (P5.9, V-117). Everyone speaks for or against
// (welcome.ts). If they agree, that stands, whatever the law; if they are split, the Strangers
// law decides by the reason the stranger gives (laws.json `lets`), and each answers the law as
// they do Work hours: obeys, grumbles or refuses, with a line. Who stays sleeps in the hall till
// their home is up; who is turned away goes back the way they came, and anyone who spoke for them
// remembers it; a refuser who spoke for them gives them food for the road.
import type { EntityRow, WorldState } from '../core/index.ts';
import { greenOf, hallOf, housesOf, sizeOf } from '../build/index.ts';
import { bringIn } from '../flock/index.ts';
import { itemsOf, layItem, takeFrom } from '../goods/index.ts';
import { pronouns } from '../health/index.ts';
import { answerNow, settingOf } from '../law/index.ts';
import { addMemory, seedPerson } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { edgeSpot } from './edge.ts';
import { walkTo } from './walk.ts';
import { stanceOf, storeLasts, type Stance } from './welcome.ts';

export const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** "Durza of Kraghthar", or "Asgild and Ormar of Granstead". */
export const namesOf = (group: readonly EntityRow[]): string =>
  `${list(group.map((p) => p['name'] as string))} of ${group[0]!['home'] as string}`;

const WORDS = ['three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** Words for a group: "her", "him", or "them", and "She" or "They". */
function words(group: readonly EntityRow[]) {
  const one = group.length === 1 ? pronouns(group[0]!) : undefined;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    them: one?.them ?? 'them',
    They: cap(one?.they ?? 'they'),
    their: one?.their ?? 'their',
  };
}

/** Who spoke for and against, as a sentence. */
function spokeLine(
  stances: readonly { q: EntityRow; st: Stance }[],
  them: string,
  stays: boolean,
): string {
  const fors = stances.filter((x) => x.st.for).map((x) => x.q['name'] as string);
  const against = stances.filter((x) => !x.st.for).map((x) => x.q['name'] as string);
  if (fors.length && against.length)
    return `${list(fors)} spoke for ${them}; ${list(against)} against.`;
  // The reason most of them gave.
  const tally = new Map<string, number>();
  for (const x of stances) {
    const w = x.st.words[0];
    if (w) tally.set(w, (tally.get(w) ?? 0) + 1);
  }
  const top = [...tally].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
  const n = stances.length;
  const all =
    n === 1 ? (stances[0]!.q['name'] as string) : n === 2 ? 'Both' : `All ${WORDS[n - 3] ?? n}`;
  return `${all} spoke ${stays ? 'for' : 'against'} ${them}${top ? `: ${top}` : ''}.`;
}

/** Someone who stays: one of the colony, with their bedroll laid at the green to carry in. */
function admit(ctx: SystemContext, p: EntityRow, line: number): void {
  const { world, content } = ctx;
  Object.assign(p, { status: 'alive', waits: 0, wantsFrom: world.tick, path: [] });
  seedPerson(world, content, p);
  layItem(
    world,
    {
      kind: content.life.cart.bedroll,
      count: 1,
      x: p['x'] as number,
      y: p['y'] as number,
      z: 0,
      made: line,
    },
    { owner: p.id, state: 'laid' },
  );
}

/** The animal a newcomer led in joins the flock, or with none it is butchered for the store. */
function animal(ctx: SystemContext, group: readonly EntityRow[], line: number): void {
  const { world, content } = ctx;
  const species = group[0]!['brings'] as string;
  const kd = content.flock.kinds.find((k) => k.species === species);
  if (!species || !kd) return;
  const joined = bringIn(ctx, species, 'f');
  const made = ctx.emit('people.broughtAnimal', {
    causes: [line],
    actors: group.map((p) => p.id),
    data: {
      names: list(group.map((p) => p['name'] as string)),
      a: /^[aeiou]/i.test(kd.femaleName) ? 'an' : 'a',
      animal: kd.femaleName,
      fate: joined
        ? ', which joined the flock'
        : '; with no pasture, it was butchered for the store',
    },
  });
  if (joined) return;
  const meat = content.wild.species.find((s) => s.id === species)?.meat ?? 0;
  const g = greenOf(world);
  if (meat > 0) layItem(world, { kind: content.flock.cull.item, count: meat, ...g, made });
}

/** Food for the road from the store, up to `count`: what is taken. */
function roadFood(world: WorldState, ctx: SystemContext, count: number): number {
  const { content } = ctx;
  let took = 0;
  for (const i of [...itemsOf(world)]) {
    if (took >= count) break;
    const kind = i['kind'] as string;
    if (
      i['holder'] ||
      content.life.eat[kind] === undefined ||
      content.life.lastResort.includes(kind)
    )
      continue;
    took += takeFrom(world, i, count - took);
  }
  return took;
}

/** The band speaks on `lead` (and a partner), then they stay or are turned away. */
export function decide(ctx: SystemContext, lead: EntityRow, group: EntityRow[]): void {
  const { world, content, state } = ctx;
  const def = content.strangers;
  const band = (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
  const lasts = storeLasts(world, content, group.length);
  const stances = band.map((q) => ({ q, st: stanceOf(world, content, q, lead, lasts) }));
  const fors = stances.filter((x) => x.st.for).length;
  const split = fors > 0 && fors < stances.length;
  const s = settingOf(world, content, def.law);
  const reason = lead['reason'] as string;
  const kind = def.kinds.find((k) => k.id === reason);
  const stays = split ? (s.lets ?? []).includes(reason) : fors > 0 || !stances.length;
  const w = words(group);
  const name = lead['name'] as string;
  const law = (world.entities['law'] ?? []).find((r) => r['law'] === def.law);
  const what = stays
    ? kind?.need
      ? `lets in someone fleeing ${kind.name}`
      : 'lets in whoever comes'
    : s.lets?.length
      ? `turns away someone with no trouble to flee`
      : 'turns every stranger away';
  const why = split ? `The band was split, and the Strangers law, ${s.name}, ${what}.` : '';
  const hall = hallOf(world) ?? housesOf(world).find((h) => !h['of'] && h['state'] === 'built');
  const room = hall
    ? hall['hall']
      ? 'the hall'
      : `the first ${sizeOf(content, hall).name}`
    : 'the open';
  const causes = [lead['stranger'] as number, ...(split && law ? [law['line'] as number] : [])];
  const data = {
    names: namesOf(group),
    spoke: spokeLine(stances, w.them, stays),
    why,
  };
  const line = stays
    ? ctx.emit('people.strangerStays', {
        causes,
        actors: group.map((p) => p.id),
        data: {
          ...data,
          names: list(group.map((p) => p['name'] as string)),
          verb: group.length > 1 ? 'stay' : 'stays',
          where: `${w.They} will sleep in ${room} until ${w.their} home is up.`,
        },
      })
    : ctx.emit('people.strangerTurnedAway', {
        causes,
        actors: group.map((p) => p.id),
        data: {
          ...data,
          verb: group.length > 1 ? 'were' : 'was',
          dir: lead['homeDir'] as string,
        },
      });
  // A split is settled by the law: everyone answers it, those it overrode the less willing.
  if (split)
    for (const { q, st } of stances) {
      const word = `spoke ${st.for ? 'for' : 'against'} ${name}`;
      const by = st.for === stays ? 0 : def.dissent;
      const answer = answerNow(ctx, def.law, s, q, { by, word }, [line]);
      if (answer !== 'refuses') continue;
      addMemory(ctx, q.id, def.memories.refused, line);
      if (stays || !st.for) continue;
      const took = roadFood(world, ctx, def.road.count);
      if (took)
        ctx.emit('people.strangerFed', {
          causes: [line],
          actors: [q.id, lead.id],
          data: { name: q['name'] as string, them: w.them, count: took },
        });
    }
  if (stays) {
    for (const p of group) admit(ctx, p, line);
    state['stayed'] = (state['stayed'] ?? 0) + group.length;
    animal(ctx, group, line);
    return;
  }
  for (const { q, st } of stances)
    if (st.for) addMemory(ctx, q.id, def.memories.turned, line, lead.id);
  const back = edgeSpot(world, content, lead['homeDir'] as string);
  for (const p of group) {
    p['waits'] = -1;
    if (!back || !walkTo(ctx, p, back)) p['status'] = 'gone';
  }
}
