// Factions and petitions (P6.6, proposal P2, V-159). Daily, for each law that asks something,
// whoever is `strong` points short of keeping it (weighed alone: no elder, no faction) holds a
// grievance; when at least `least` people and `share` per cent of the colony hold one, they form a
// faction named from the setting's `faction` names and bring a petition for the setting one step
// back towards the custom. Members lean `lean` more against the law (law `weigh.ts`), and stay
// while they would not keep it alone. The petition is answered only through the law: changed to
// what it asks (or milder) it is heard; let stand (`letStand`), or left `days` unanswered, it is
// not. A faction breaks up when fewer than `least` still hold the grievance, or the law changes.
import {
  list,
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type LawDef,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { lawDef, settingOf, weigh } from '../law/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addCause } from './standing.ts';
import { factionsOf } from './tables.ts';

const alive = (world: WorldState): EntityRow[] =>
  (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** Laws everyone answers while they stand away from the custom. */
const asking = (world: WorldState, content: EngineContent): LawDef[] =>
  content.laws.laws.filter((d) => !d.split && settingOf(world, content, d.id).id !== d.start);

/** How far short of keeping `law` each person is, weighed alone. */
function grudges(world: WorldState, content: EngineContent, law: string): Map<number, number> {
  const s = settingOf(world, content, law);
  const obey = content.laws.answer.obey;
  const out = new Map<number, number>();
  for (const p of alive(world))
    out.set(p.id, obey - weigh(world, content, p.id, s, { alone: true }).will);
  return out;
}

/** The setting one step back towards the custom. */
function stepBack(def: LawDef, setting: string): string {
  const at = def.settings.findIndex((s) => s.id === setting);
  const start = def.settings.findIndex((s) => s.id === def.start);
  return def.settings[at + Math.sign(start - at)]!.id;
}

const answerLine = (world: WorldState, law: string, person: number): number =>
  ((world.entities['answer'] ?? []).find((a) => a['law'] === law && a['person'] === person)?.[
    'line'
  ] as number | undefined) ?? 0;

function form(ctx: SystemContext, def: LawDef, members: number[]): void {
  const { world, content } = ctx;
  const s = settingOf(world, content, def.id);
  const taken = new Set(factionsOf(world).map((f) => f['name'] as string));
  const names = (s.faction ?? []).filter((n) => !taken.has(n));
  const day = Math.floor(world.tick / TICKS_PER_DAY);
  const name = names[day % Math.max(1, names.length)] ?? `Those against ${s.days}`;
  const people = alive(world).filter((p) => members.includes(p.id));
  const line = ctx.emit('colony.faction', {
    causes: members.map((m) => answerLine(world, def.id, m)).filter((l) => l > 0),
    actors: members,
    data: { names: list(people.map((p) => p['name'] as string)), days: s.days, faction: name },
  });
  const asks = stepBack(def, s.id);
  const askDef = def.settings.find((x) => x.id === asks)!;
  const petition = ctx.emit('colony.petition', {
    causes: [line],
    actors: members,
    data: { faction: name, asks: askDef.name, law: def.law, setting: s.name },
  });
  addEntity(world, 'faction', {
    ...{ law: def.id, setting: s.id, name, members, line, since: world.tick },
    ...{
      asks,
      petition,
      due: world.tick + content.colony.petition.days * TICKS_PER_DAY,
      state: 'open',
    },
  });
}

function breakUp(ctx: SystemContext, f: EntityRow, why: string, causes: number[]): void {
  ctx.emit('colony.disbanded', {
    causes: [f['line'] as number, ...causes],
    actors: f['members'] as number[],
    data: { faction: f['name'] as string, why },
  });
  removeEntity(ctx.world, 'faction', f.id);
}

/** A law changed under a faction: its petition is heard if the law moved as far as it asked (or
 * further back); either way the faction's grievance with that setting is over. */
export function lawsMoved(ctx: SystemContext): void {
  const { world, content } = ctx;
  const st = content.colony.standing;
  for (const f of [...factionsOf(world)]) {
    const def = lawDef(content, f['law'] as string)!;
    const now = settingOf(world, content, def.id);
    if (now.id === f['setting']) continue;
    const set = (world.entities['law'] ?? []).find((r) => r['law'] === def.id)?.['line'] as number;
    const idx = (id: string) => def.settings.findIndex((s) => s.id === id);
    const start = idx(def.start);
    const back = Math.abs(idx(now.id) - start) <= Math.abs(idx(f['asks'] as string) - start);
    const name = f['name'] as string;
    if (f['state'] === 'open' && back)
      addCause(ctx, 'answered', st.answered, st.answered.text.replace('{faction}', name), [set]);
    else if (f['state'] === 'open')
      addCause(ctx, 'ignored', st.ignored, st.ignored.text.replace('{faction}', name), [set]);
    breakUp(ctx, f, `the ${def.law} is now ${now.name}`, [set]);
  }
}

/** The `letStand` lever: the faction's open petition is turned down; the law stands. */
export function letStand(ctx: SystemContext, faction: number, cause: number): void {
  const f = factionsOf(ctx.world).find((x) => x.id === faction);
  if (!f || f['state'] !== 'open') {
    ctx.emit('command.refused', {
      causes: [cause],
      data: { kind: 'letStand', reason: 'no open petition' },
    });
    return;
  }
  const st = ctx.content.colony.standing.stood;
  f['state'] = 'stood';
  addCause(ctx, 'stood', st, st.text.replace('{faction}', f['name'] as string), [
    cause,
    f['petition'] as number,
  ]);
}

/** Daily: petitions left unanswered past their day; members come and go; new factions form. */
export function factionsDay(ctx: SystemContext): void {
  const { world, content } = ctx;
  const fd = content.colony.faction;
  const st = content.colony.standing;
  const band = alive(world);
  for (const f of [...factionsOf(world)]) {
    if (f['state'] === 'open' && world.tick >= (f['due'] as number)) {
      f['state'] = 'ignored';
      addCause(
        ctx,
        'ignored',
        st.ignored,
        st.ignored.text.replace('{faction}', f['name'] as string),
        [f['petition'] as number],
      );
    }
    const g = grudges(world, content, f['law'] as string);
    const held = (f['members'] as number[]).filter((m) => (g.get(m) ?? 0) > 0);
    const joining = [...g]
      .filter(([p, by]) => by >= fd.strong && !held.includes(p))
      .map(([p]) => p);
    if (held.length + joining.length < fd.least) {
      breakUp(ctx, f, 'the grievance has faded', []);
      continue;
    }
    for (const p of joining) {
      const q = band.find((x) => x.id === p)!;
      ctx.emit('colony.joined', {
        causes: [f['line'] as number, answerLine(world, f['law'] as string, p)].filter(
          (l) => l > 0,
        ),
        actors: [p],
        data: { name: q['name'] as string, faction: f['name'] as string },
      });
    }
    f['members'] = [...held, ...joining].sort((a, b) => a - b);
  }
  for (const def of asking(world, content)) {
    if (factionsOf(world).some((f) => f['law'] === def.id)) continue;
    const g = grudges(world, content, def.id);
    const strong = [...g].filter(([, by]) => by >= fd.strong).map(([p]) => p);
    if (strong.length >= fd.least && strong.length * 100 >= fd.share * band.length)
      form(
        ctx,
        def,
        strong.sort((a, b) => a - b),
      );
  }
}
