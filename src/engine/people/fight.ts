// The pack's attacks (P5.4a, V-109, V-111): when the pack has gone `attackAfter` days without a
// meal, by night, a wolf goes for a person who is alone in the open, or the last of a fleeing
// group still short of shelter; it walks towards one within `prowl` tiles and, beside them,
// fights: up to `rounds` blows. Each blow a standing, armed person beside the target strikes
// first (a chance by hunting skill and weapon): a hit hurts the wolf, which flees limping, and a
// second kills it (wild `woundPredator`); a miss, and the wolf may bite (`bite.chance`), the part
// and depth drawn by weight into the health system. One line, `wild.attacked`, tells it all and
// cites the sighting; the pack then draws off to its den. Witnesses within `witness` remember.
import { streamFor, type EntityRow } from '../core/index.ts';
import { heldSpeed } from './tools.ts';
import { pronouns, wound } from '../health/index.ts';
import { addMemory } from '../needs/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { middensOf } from '../build/index.ts';
import {
  animalsOf,
  approach,
  drawOff,
  markAttack,
  packOf,
  setLures,
  woundPredator,
} from '../wild/index.ts';
import { armedWith, isNight, sheltered, shelterFor, upAndAbout } from './flee.ts';
import { people, skillOf, spotOf } from './spots.ts';

const reach = (a: Spot, b: Spot): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Whether a wolf may go for `t`: out of shelter, not standing, and alone or the last of those
 * fleeing to shelter. */
function exposed(ctx: SystemContext, t: EntityRow): boolean {
  const { world, content } = ctx;
  if (t['status'] !== 'alive' || t['z'] !== 0 || t['doing'] === 'stand' || sheltered(ctx, t))
    return false;
  const mates = people(world).filter(
    (q) =>
      q.id !== t.id &&
      q['status'] === 'alive' &&
      q['z'] === 0 &&
      reach(spotOf(q), spotOf(t)) <= content.wild.folk.alone,
  );
  return (
    !mates.length ||
    (t['doing'] === 'flee' && mates.every((q) => sheltered(ctx, q) || q['doing'] === 'stand'))
  );
}

const listOf = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** The midden is where a hungry pack goes first (V-072): told to wild when one is sited. */
export function syncLures(ctx: SystemContext): void {
  const { world, state } = ctx;
  const middens = middensOf(world);
  if ((state['lured'] ?? 0) === middens.length) return;
  state['lured'] = middens.length;
  setLures(
    ctx,
    middens.map((m) => m.y * world.map.width + m.x),
  );
}

/** Each minute: a hungry pack by night prowls towards, and falls on, the exposed. */
export function attacksMinute(ctx: SystemContext): void {
  const { world, content } = ctx;
  const folk = content.wild.folk;
  const pack = packOf(world);
  if (!pack || (pack['hunger'] as number) < folk.attackAfter || !isNight(ctx)) return;
  const wolves = animalsOf(world).filter(
    (a) => a['pack'] && !(a['path'] as number[]).length && a['state'] !== 'flee',
  );
  if (!wolves.length) return;
  const prey = people(world).filter((t) => t['status'] === 'alive' && t['z'] === 0);
  const memo = new Map<number, boolean>();
  for (const wolf of wolves) {
    const near = prey
      .filter((t) => reach(spotOf(t), spotOf(wolf)) <= folk.prowl)
      .sort(
        (a, b) => reach(spotOf(a), spotOf(wolf)) - reach(spotOf(b), spotOf(wolf)) || a.id - b.id,
      );
    for (const t of near) {
      if (!memo.has(t.id)) memo.set(t.id, exposed(ctx, t));
      if (!memo.get(t.id)) continue;
      if (reach(spotOf(t), spotOf(wolf)) <= 1) return fight(ctx, wolf, t);
      if (world.tick % content.wild.move.trot === 0)
        approach(ctx, wolf, t['x'] as number, t['y'] as number);
      break;
    }
  }
}

interface Bite {
  part: string;
  severity: string;
  mortal: boolean;
}

/** The fight: blows by turns until a hit, a miss of every blow, or the rounds are out. */
function fight(ctx: SystemContext, wolf: EntityRow, target: EntityRow): void {
  const { world, content, state } = ctx;
  const folk = content.wild.folk;
  const rng = streamFor(world, 'wild');
  const defenders = people(world).filter(
    (q) =>
      q.id !== target.id &&
      upAndAbout(ctx, q) &&
      q['doing'] === 'stand' &&
      !!armedWith(ctx, q) &&
      reach(spotOf(q), spotOf(target)) <= folk.beside,
  );
  const jobSkill = content.jobs.find((j) => j.id === content.work.hunt.job)?.skill ?? '';
  const bites: Bite[] = [];
  let hit: { by: EntityRow; weapon: string } | undefined;
  for (let round = 0; round < folk.rounds && !hit; round += 1) {
    for (const d of defenders) {
      const weapon = armedWith(ctx, d)!;
      const base = Math.min(
        folk.strike.most,
        folk.strike.base + folk.strike.perLevel * skillOf(world, d, jobSkill),
      );
      if (rng.int(100) < Math.floor((base * (heldSpeed(ctx, d.id, weapon) || 100)) / 100)) {
        hit = { by: d, weapon };
        break;
      }
    }
    if (hit || rng.int(100) >= folk.bite.chance) continue;
    const severity = rng.weighted(folk.bite.severities.map((s) => [s.id, s.weight] as const));
    const sev = content.health.severities.find((s) => s.id === severity)!;
    bites.push({
      part: rng.weighted(folk.bite.parts.map((s) => [s.id, s.weight] as const)),
      severity,
      mortal: !!sev.mortal && rng.int(100) < sev.mortal,
    });
  }
  const line = ctx.emit('wild.attacked', {
    causes: [state['sighted'] || (packOf(world)!['line'] as number)].filter((c) => c > 0),
    actors: [target.id, ...(hit ? [hit.by.id] : [])],
    data: describe(ctx, wolf, target, bites, hit),
  });
  markAttack(ctx, line);
  for (const b of bites)
    wound(
      ctx,
      target,
      {
        part: b.part,
        kind: 'bite',
        severity: b.severity,
        what: 'was bitten by a wolf',
        where: 'town',
        place: 'near',
      },
      [line],
      b.mortal,
    );
  if (hit) woundPredator(ctx, wolf, hit.by.id, line);
  for (const q of people(world))
    if (
      q.id !== target.id &&
      upAndAbout(ctx, q) &&
      reach(spotOf(q), spotOf(target)) <= folk.witness
    )
      addMemory(ctx, q.id, folk.memories.attack, line, target.id);
  drawOff(ctx, line);
}

/** The line's words: the species, who it went for and why, the blow struck and the bites. */
function describe(
  ctx: SystemContext,
  wolf: EntityRow,
  target: EntityRow,
  bites: readonly Bite[],
  hit: { by: EntityRow; weapon: string } | undefined,
) {
  const { content } = ctx;
  const words = content.wild.folk.words;
  const species = content.wild.predators.find((p) => p.kind === wolf['kind'])!.name;
  const shelter = target['doing'] === 'flee' ? shelterFor(ctx, target) : undefined;
  const why = shelter ? words.last.replace('{house}', shelter.house) : words.alone;
  const tool = (k: string) => content.tools.kinds.find((t) => t.id === k)?.name ?? k;
  const killed = hit && (wolf['hurt'] as number) + 1 >= content.wild.folk.hits;
  const fight = hit
    ? ` ${(killed ? words.slew : words.struck)
        .replace('{name}', hit.by['name'] as string)
        .replace('{their}', pronouns(hit.by).their)
        .replace('{weapon}', tool(hit.weapon))}`
    : '';
  const part = (b: Bite) =>
    words.bitePart
      .replace('{part}', content.health.parts.find((x) => x.id === b.part)?.name ?? b.part)
      .replace('{severity}', content.health.severities.find((s) => s.id === b.severity)!.name);
  const name = target['name'] as string;
  const bitten = bites.length
    ? ` ${words.bitten.replace('{name}', name).replace('{bites}', listOf(bites.map(part)))}`
    : ` ${words.unhurt.replace('{name}', name)}`;
  return { species, name, why, fight, bitten };
}
