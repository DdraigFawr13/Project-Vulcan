// The lord's favour (6C Slice 2, V-222). One number, 0 to 100 from `favour.start`, made of causes
// that each count for `favour.days` (as standing is, V-173): the tithe paid in full, each tenth
// short, a Defiant valley, a fine unpaid, a stash the reeve finds, poaching told to him. Each cause
// is a line citing the deed. At each visit, once the causes are in, the ladder is climbed: a step
// reached is a line and takes hold once (the tithe raised while favour stays low, a fine or a free
// year owed at the next visit, the lord's men at once, the forest granted for good); a step left
// behind may be reached again.
import {
  clamp,
  list,
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, alive, removeEntity } from '../entity/index.ts';
import { weigh, settingOf } from '../law/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lordMen } from './men.ts';
import { lordName, lordRow } from './tables.ts';

/** The favour causes still counting (read-only, for the page too). */
export const favourCauses = (world: WorldState): EntityRow[] =>
  (world.entities['favour'] ?? []).filter((c) => (c['until'] as number) > world.tick);

/** The causes' sum, unclamped. */
const rawOf = (ctx: SystemContext): number =>
  ctx.content.lord.favour.start +
  favourCauses(ctx.world).reduce((n, c) => n + (c['by'] as number), 0);

/** The lord's favour now. */
export const favourOf = (ctx: SystemContext): number => clamp(rawOf(ctx), 0, 100);

/** The lord's favour in `world` now, for a read-only view. */
export const favourAt = (world: WorldState, content: EngineContent): number =>
  clamp(
    content.lord.favour.start + favourCauses(world).reduce((n, c) => n + (c['by'] as number), 0),
    0,
    100,
  );

const fill = (text: string, vars: Readonly<Record<string, string>>): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

/** Adds favour cause `kind` (`times` over), its line citing `causes`; returns the line. */
export function addFavour(
  ctx: SystemContext,
  kind: string,
  causes: readonly number[],
  vars: Readonly<Record<string, string>> = {},
  times = 1,
): number {
  const { world, content } = ctx;
  const def = content.lord.favour.causes[kind];
  const lord = lordRow(world);
  if (!def || !lord) return 0;
  const by = def.by * times;
  const text = fill(def.text, vars);
  const now = clamp(rawOf(ctx) + by, 0, 100);
  const line = ctx.emit('lord.favour', {
    causes: causes.filter((c) => c > 0),
    data: {
      text: text.charAt(0).toUpperCase() + text.slice(1),
      lord: lordName(lord),
      way: by > 0 ? 'rises' : 'falls',
      favour: now,
      cause: kind,
    },
  });
  const until = world.tick + content.lord.favour.days * TICKS_PER_DAY;
  addEntity(world, 'favour', { cause: kind, by, text, line, until });
  for (const c of [...(world.entities['favour'] ?? [])])
    if ((c['until'] as number) <= world.tick) removeEntity(world, 'favour', c.id);
  return line;
}

/** The share the ladder makes of the plain tithe, in 100: raised while that step holds, a fine
 * or a free year owed now. */
export const shareOf = (ctx: SystemContext): number => shareIn(ctx.world, ctx.content);

/** `shareOf` for a read-only view. */
export function shareIn(world: WorldState, content: EngineContent): number {
  const lord = lordRow(world);
  if (!lord) return 100;
  const steps = (lord['steps'] as number[] | undefined) ?? [];
  let n = 100;
  content.lord.favour.ladder.forEach((s, k) => {
    if (s.id === 'raised' && steps.includes(k)) n += s.by;
    if ((s.id === 'fine' || s.id === 'free') && lord[s.id]) n += s.by;
  });
  return Math.max(0, n);
}

/** The visit's take, as favour sees it. */
export interface Take {
  line: number;
  owedN: number;
  shortN: number;
  words: Readonly<Record<string, string>>;
  owed: [string, number][];
}

/** The causes of a visit's take: a Defiant valley, else paid in full or each tenth short; a fine
 * owed and not paid. The fine and the free year are then settled. */
export function favourFor(ctx: SystemContext, t: Take): void {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const fined = !!lord['fine'];
  if (settingOf(world, content, content.lord.tithe.law).id === 'defiant')
    addFavour(ctx, 'defiant', [t.line]);
  else if (t.shortN > 0)
    addFavour(ctx, 'tenth', [t.line], t.words, Math.ceil((10 * t.shortN) / t.owedN));
  else if (t.owedN > 0) addFavour(ctx, 'full', [t.line]);
  if (fined && t.shortN > 0) addFavour(ctx, 'fine', [t.line]);
  Object.assign(lord, { fine: 0, free: 0 });
}

/** At a visit, someone Loyal who saw a poacher since the last tells the reeve: one line and one
 * cause a poacher, naming their deeds; every deed is then let go. */
export function poachTold(ctx: SystemContext, cause: number): void {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const def = content.laws.laws.find((l) => l.id === content.lord.tithe.law)!;
  const loyal = def.settings.find((s) => s.id === 'loyal')!;
  const told = new Map<number, { seer: EntityRow; deeds: string[]; lines: number[] }>();
  for (const d of [...(world.entities['poach'] ?? [])]) {
    removeEntity(world, 'poach', d.id);
    const p = alive(world).find((q) => q.id === d['person']);
    const seer = alive(world).find(
      (q) =>
        (d['saw'] as number[]).includes(q.id) &&
        weigh(world, content, q.id, loyal).will >= content.laws.answer.obey,
    );
    if (!p || !seer) continue;
    const t = told.get(p.id) ?? { seer, deeds: [], lines: [] };
    if (!t.deeds.includes(d['deed'] as string)) t.deeds.push(d['deed'] as string);
    t.lines.push(d['line'] as number);
    told.set(p.id, t);
  }
  for (const [id, t] of told) {
    const p = alive(world).find((q) => q.id === id)!;
    const line = ctx.emit('lord.told', {
      causes: [cause, ...t.lines.slice(-8)].filter((c) => c > 0),
      actors: [t.seer.id, id],
      data: {
        ...{ seer: t.seer['name'] as string, reeve: lord['reeve'] as string },
        ...{ lord: lordName(lord), name: p['name'] as string, deed: list(t.deeds) },
      },
    });
    addFavour(ctx, 'told', [line]);
  }
}

/** Once a visit's causes are in: each step favour has reached and had not is a line and takes
 * hold; a step favour has left is let go (the forest stays granted). */
export function climb(ctx: SystemContext, cause: number, owed: [string, number][]): void {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const f = favourOf(ctx);
  const steps = [...((lord['steps'] as number[] | undefined) ?? [])];
  content.lord.favour.ladder.forEach((s, k) => {
    const at = s.below !== undefined ? f <= s.below : s.above !== undefined && f >= s.above;
    const had = steps.includes(k);
    if (!at && had && s.id !== 'forest') steps.splice(steps.indexOf(k), 1);
    if (!at || had) return;
    steps.push(k);
    const line = ctx.emit('lord.step', {
      causes: [cause],
      data: {
        lord: lordName(lord),
        favour: f,
        reeve: lord['reeve'] as string,
        text: s.text,
        step: s.id,
      },
    });
    if (s.id === 'fine' || s.id === 'free') lord[s.id] = 1;
    if (s.id === 'forest') lord['granted'] = 1;
    if (s.id === 'men') lordMen(ctx, line, owed, s.by);
  });
  lord['steps'] = steps;
}
