// The people as the page shows them (P2.1): each person's row with its skill and trait rows,
// put into words from content. A pure read of the world, like views.ts.
import { content } from '../content/index.ts';
import { clockAt, type WorldState } from '../engine/index.ts';
import type { PersonView, WalkerView } from './protocol.ts';

const nameOf = (list: readonly { id: string; name: string }[], id: string): string =>
  list.find((x) => x.id === id)?.name ?? id;

/** Every person in the world, in id order; `place` names the valley for the arrival screen. */
export function peopleOf(world: WorldState): PersonView[] {
  const year = clockAt(world.tick, content.calendar).year;
  const skills = world.entities['skill'] ?? [];
  const traits = world.entities['trait'] ?? [];
  const { band } = content;
  return (world.entities['person'] ?? []).map((p) => {
    const own = band.skills.flatMap((id) => {
      const row = skills.find((s) => s['person'] === p.id && s['skill'] === id);
      if (!row) return [];
      const [level, potential] = [row['level'] as number, row['potential'] as number];
      return [{ id, name: nameOf(content.abilities, id), level, potential }];
    });
    return {
      id: p.id,
      name: p['name'] as string,
      race: p['race'] as string,
      raceName: nameOf(content.races, p['race'] as string),
      cultureName: nameOf(content.cultures, p['culture'] as string),
      age: year - (p['born'] as number),
      home: p['home'] as string,
      homeDays: p['homeDays'] as number,
      homeDir: p['homeDir'] as string,
      trade: nameOf(content.abilities, p['trade'] as string),
      skills: own,
      // Best first: by level, then potential; the list order breaks ties (the trade's rule).
      best: [...own].sort((a, b) => b.level - a.level || b.potential - a.potential).slice(0, 3),
      able: band.must.filter((m) => own.some((s) => s.id === m && s.level >= band.able)),
      traits: traits
        .filter((t) => t['person'] === p.id)
        .map((t) => {
          const def = content.traits.find((d) => d.id === t['trait']);
          return { name: def?.name ?? String(t['trait']), description: def?.description ?? '' };
        }),
      look: {
        hair: p['hair'] as string,
        hairColour: p['hairColour'] as string,
        clothes: p['clothes'] as string,
      },
      x: p['x'] as number,
      y: p['y'] as number,
      z: p['z'] as number,
      arrived: p['arrived'] as number,
    };
  });
}

/** Where everyone stands this tick (P2.3), for every snapshot. */
export const walkersOf = (world: WorldState): WalkerView[] =>
  (world.entities['person'] ?? []).map((p) => ({
    id: p.id,
    x: p['x'] as number,
    y: p['y'] as number,
    z: p['z'] as number,
  }));
