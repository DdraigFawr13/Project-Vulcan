// A master's masterwork (6B Bundle 6, V-189 q9): once someone holds a calling whose push names a
// `masterwork`, the next piece they make in their trade (a ledger line of one of its `events`,
// in the calling's skill, with them first among its actors) is their masterwork: it takes the
// `quality` (a furniture piece's score, a tool's word), a name, and a line the tales copy.
import { pronouns, type EngineContent, type EntityRow, type SimEvent } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { callingsOf } from './tables.ts';

/** What the line made, in words: its `what`, else the trade's `pieces` word, else "the {part}". */
function whatOf(
  content: EngineContent,
  e: SimEvent,
  skill: string,
  pieces: Readonly<Record<string, string>>,
): string {
  if (e.data['what']) return String(e.data['what']);
  if (pieces[skill]) return pieces[skill];
  const trade = (content.abilities.find((a) => a.id === skill)?.name ?? skill).toLowerCase();
  return e.data['part'] ? `the ${String(e.data['part'])}` : `a piece of ${trade}`;
}

/** The piece or tool `e` made takes the masterwork's quality. */
function raise(ctx: SystemContext, e: SimEvent, quality: string): void {
  const { world, content } = ctx;
  const at = content.buildings.furniture.quality.find((q) => q.id === quality)?.at ?? 0;
  for (const f of world.entities['furniture'] ?? [])
    if (f['made'] === e.id) f['quality'] = Math.max(f['quality'] as number, at);
  for (const i of world.entities['item'] ?? [])
    if (i['made'] === e.id && typeof i['quality'] === 'string') i['quality'] = quality;
}

function make(ctx: SystemContext, row: EntityRow, e: SimEvent): void {
  const { world, content } = ctx;
  const mw = content.callings.callings.find((c) => c.id === row['calling'])!.push.masterwork!;
  const p = (world.entities['person'] ?? []).find((x) => x.id === row['person'])!;
  const name = mw.names[((row['person'] as number) + e.id) % mw.names.length] ?? '';
  raise(ctx, e, mw.quality);
  row['named'] = `the ${name}`;
  row['work'] = ctx.emit('calling.masterwork', {
    causes: [e.id, row['line'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      their: pronouns(p).their,
      what: whatOf(content, e, row['skill'] as string, mw.pieces),
      title: row['named'] as string,
    },
  });
}

/** Each held calling with a masterwork to make looks at the fresh lines for it. */
export function masterworks(ctx: SystemContext, fresh: readonly SimEvent[]): void {
  const { content } = ctx;
  for (const row of callingsOf(ctx.world)) {
    if (row['ended'] || row['work']) continue;
    const mw = content.callings.callings.find((c) => c.id === row['calling'])?.push.masterwork;
    const e =
      mw &&
      fresh.find(
        (x) =>
          x.id > (row['line'] as number) &&
          mw.events[x.type] === row['skill'] &&
          x.actors[0] === row['person'],
      );
    if (e) make(ctx, row, e);
  }
}
