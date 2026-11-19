// The colony as the page shows it (P6.6, V-146, V-158, V-159): standing with its causes, the
// elder, the factions and their petitions for the Laws sheet; the mood word for the clock. A pure
// read of the world; every word is content (colony.json, laws.json) or the engine's.
import { content } from '../content/index.ts';
import {
  causesOf,
  colonyMood,
  colonyRow,
  elderOf,
  factionsOf,
  lawDef,
  list,
  settingOf,
  standingOf,
  standingWord,
  TICKS_PER_DAY,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { ColonyView, FactionView, MoodView } from './protocol-colony.ts';

const nameOf = (world: WorldState, id: number): string =>
  ((world.entities['person'] ?? []).find((p) => p.id === id)?.['name'] as string) ?? '';

/** The causes, the same words summed ("−6 Hunger rations in hard times, twice"). */
function causes(world: WorldState): ColonyView['causes'] {
  const out = new Map<string, ColonyView['causes'][number]>();
  for (const c of causesOf(world)) {
    const text = (c['text'] as string).replace(/^./, (ch) => ch.toUpperCase());
    const had = out.get(text);
    const line = c['line'] as number;
    if (had)
      Object.assign(had, {
        by: had.by + (c['by'] as number),
        times: had.times + 1,
        why: Math.max(had.why, line),
      });
    else out.set(text, { by: c['by'] as number, text, times: 1, why: line });
  }
  return [...out.values()].sort((a, b) => Math.abs(b.by) - Math.abs(a.by));
}

function factionView(world: WorldState, f: EntityRow): FactionView {
  const def = lawDef(content, f['law'] as string)!;
  const from = def.settings.find((s) => s.id === f['setting'])!;
  const asks = def.settings.find((s) => s.id === f['asks'])!;
  const members = (f['members'] as number[]).map((m) => nameOf(world, m));
  const state = f['state'] as FactionView['state'];
  const left = Math.max(1, Math.ceil(((f['due'] as number) - world.tick) / TICKS_PER_DAY));
  const note =
    state === 'open'
      ? `Answer within ${left} day${left === 1 ? '' : 's'}: make it ${asks.name}, or let it stand.`
      : state === 'stood'
        ? 'You let the law stand. They still stand together.'
        : 'Nobody answered them. They still stand together.';
  return {
    id: f.id,
    name: f['name'] as string,
    law: def.id,
    members: list(members),
    count: members.length,
    ask: `They ask that the ${def.law} be ${asks.name}, not ${from.name}.`,
    asks: asks.id,
    asksName: asks.name,
    state,
    note,
    why: f['petition'] as number,
  };
}

/** The elder in words, with the engine's reasons from the vote. */
function elderView(world: WorldState): ColonyView['elder'] {
  const id = elderOf(world);
  const p = (world.entities['person'] ?? []).find((q) => q.id === id);
  const row = colonyRow(world);
  if (!p || !row) return undefined;
  const why = row['why'] as string | undefined;
  const n = (row['friends'] as number[]).length;
  const sway = n ? ` ${n} friend${n === 1 ? ' leans' : 's lean'} their way on every law.` : '';
  return {
    person: id,
    text: `${p['name'] as string} is the elder, the one the others listen to: ${why || 'trusted'}.${sway}`,
    why: row['line'] as number,
  };
}

export function colonyView(world: WorldState): ColonyView {
  const standing = standingOf(world, content);
  const c = content.colony.standing;
  const by = Math.trunc((standing - c.start) / c.per);
  const lean = by
    ? `It leans every answer ${Math.abs(by)} point${Math.abs(by) === 1 ? '' : 's'} ${by > 0 ? 'towards keeping the law' : 'towards refusing'}.`
    : '';
  const elder = elderView(world);
  return {
    standing,
    word: standingWord(content, standing),
    lean,
    causes: causes(world),
    ...(elder && { elder }),
    mood: moodView(world),
    factions: factionsOf(world)
      .filter((f) => settingOf(world, content, f['law'] as string).id === f['setting'])
      .map((f) => factionView(world, f)),
  };
}

export function moodView(world: WorldState): MoodView {
  const m = colonyMood(world, content);
  return {
    word: m.word,
    rank: m.rank,
    causes: m.causes.map((c) => ({
      name: c.name,
      people: c.people,
      by: Math.round(c.by / 100),
      why: c.line,
    })),
  };
}
