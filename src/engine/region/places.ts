// The Story Generator world's named places inside the region's window (P1.6): its rivers in the order
// they flow, its mountain ranges, and its live sites with their people, realm, faith and one line of
// their history in the package's own words. Pure; draws no randomness.
import type { EngineContent } from '../core/index.ts';
import { toGrid, type Window } from './ground.ts';
import type { RegionRange, RegionSite } from './region.ts';
import { D8_DX, D8_DY, narrator, raceOf, type SimEvent, type WorldState } from './story.ts';

type Point = readonly [number, number];

/** World cell index to region grid coordinates. */
function gridOf(world: WorldState, win: Window, content: EngineContent, cell: number): Point {
  const W = world.cells!.width;
  const { grid } = content.region;
  return [
    toGrid(grid.width, cell % W, win.width, win.x0),
    toGrid(grid.height, Math.floor(cell / W), win.height, win.y0),
  ];
}

const inWindow = (win: Window, W: number, cell: number): boolean => {
  const x = cell % W;
  const y = Math.floor(cell / W);
  return x >= win.x0 && y >= win.y0 && x < win.x0 + win.width && y < win.y0 + win.height;
};

/** The world's named rivers in the window, longest first, each as a path downstream in steps of at
 * most one grid cell, bent by the same warp as the biomes so a river keeps to its valley. */
export function riversIn(
  world: WorldState,
  win: Window,
  content: EngineContent,
  shift: (x: number, y: number) => readonly [number, number],
) {
  const cells = world.cells!;
  const W = cells.width;
  const { count, minLength } = content.region.rivers;
  const found = [...world.regions.values()]
    .filter((r) => r.kind === 'river')
    .map((r) => ({ name: r.name, cells: new Set(r.cells.filter((c) => inWindow(win, W, c))) }))
    .filter((r) => r.cells.size >= minLength);
  const next = (c: number): number => {
    const d = cells.flowDir[c]!;
    return d < 0 ? -1 : c + D8_DY[d]! * W + D8_DX[d]!;
  };
  return found
    .sort((a, b) => b.cells.size - a.cells.size || (a.name < b.name ? -1 : 1))
    .slice(0, count)
    .map(({ name, cells: on }) => {
      const fed = new Set([...on].map(next));
      // The source is a cell nothing in the river flows into; the lowest index breaks ties.
      let at = [...on].sort((a, b) => a - b).find((c) => !fed.has(c)) ?? Math.min(...on);
      const path: Point[] = [];
      for (let steps = 0; at >= 0 && on.has(at) && steps < on.size; steps += 1) {
        path.push(gridOf(world, win, content, at));
        at = next(at);
      }
      // One more step joins the river to the lake or the edge it runs into.
      if (at >= 0 && inWindow(win, W, at)) path.push(gridOf(world, win, content, at));
      return { name, path: dense(path, shift) };
    });
}

/** A path in unit steps: each leg split evenly, every point moved by the warp. */
function dense(path: readonly Point[], shift: (x: number, y: number) => Point): Point[] {
  const out: Point[] = [];
  const put = (x: number, y: number): void => {
    const [dx, dy] = shift(x, y);
    out.push([x + dx, y + dy]);
  };
  path.forEach(([x, y], k) => {
    if (k === 0) return put(x, y);
    const [px, py] = path[k - 1]!;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x - px), Math.abs(y - py))));
    for (let s = 1; s <= n; s += 1) put(px + ((x - px) * s) / n, py + ((y - py) * s) / n);
  });
  return out;
}

/** The world's named mountain ranges with cells in the window, at their highest cell there. */
export function rangesIn(world: WorldState, win: Window, content: EngineContent): RegionRange[] {
  const cells = world.cells!;
  const W = cells.width;
  return [...world.regions.values()]
    .filter((r) => r.kind === 'range')
    .flatMap((r) => {
      const on = r.cells.filter((c) => inWindow(win, W, c));
      if (!on.length) return [];
      const top = on.reduce((m, c) => (cells.elevation[c]! > cells.elevation[m]! ? c : m));
      const [x, y] = gridOf(world, win, content, top);
      return [{ name: r.name, x: Math.round(x), y: Math.round(y), size: on.length }];
    });
}

const indexed = new WeakMap<WorldState, Map<number, SimEvent[]>>();
/** The world's events of note by the cell they happened at, most important first, then latest. */
function eventsAt(world: WorldState, content: EngineContent): Map<number, SimEvent[]> {
  const known = indexed.get(world);
  if (known) return known;
  const at = new Map<number, SimEvent[]>();
  for (const e of world.events)
    if (e.place !== null && e.importance >= content.region.history.importance) {
      const list = at.get(e.place) ?? [];
      list.push(e);
      at.set(e.place, list);
    }
  for (const list of at.values())
    list.sort((a, b) => b.importance - a.importance || b.day - a.day || b.id - a.id);
  indexed.set(world, at);
  return at;
}

/** The window's sites as the region shows them: name, people, realm, faith and a history line. */
export function sitesIn(
  world: WorldState,
  win: Window,
  content: EngineContent,
  biomeAt: (x: number, y: number) => string,
): RegionSite[] {
  const at = eventsAt(world, content);
  const told = narrator(world, content);
  const used = new Set<string>();
  return win.sites.map((s) => {
    const [gx, gy] = gridOf(world, win, content, s.cell);
    const x = Math.round(gx);
    const y = Math.round(gy);
    const band = s.pop.reduce((m, p) => (p.count > m.count ? p : m));
    const race = raceOf(band.raceId, content);
    const culture = content.cultures.find((c) => c.id === band.cultureId);
    if (!culture)
      throw new Error(`The Story Generator's culture ${band.cultureId} is not in content.`);
    // The most telling event here: the most important, then the latest, of a kind not yet told of
    // another neighbour, so the region reads as several stories rather than one repeated; a line
    // longer than `history.length` is passed over while a shorter one is left.
    const { length } = content.region.history;
    let line: { type: string; text: string } | undefined;
    let shortest: { type: string; text: string } | undefined;
    for (const e of at.get(s.cell) ?? []) {
      const text = told.renderEvent(e);
      if (text.length <= length) {
        line ??= { type: e.type, text };
        if (!used.has(e.type)) {
          line = { type: e.type, text };
          break;
        }
      } else if (!shortest || text.length < shortest.text.length) shortest = { type: e.type, text };
    }
    line ??= shortest;
    if (line) used.add(line.type);
    // Who rules it: its realm, and that realm's people's way of rule, so both lines agree.
    const civ = s.civId === null ? undefined : world.civs.get(s.civId);
    const rulers = content.cultures.find((c) => c.id === civ?.cultureId) ?? culture;
    return {
      name: s.name,
      x,
      y,
      culture: culture.name,
      race: content.races.find((r) => r.id === race)?.name ?? race,
      kind: s.kind,
      glyph: content.region.kinds[race] ?? 'village',
      government: rulers.government,
      faith:
        (s.faithId !== undefined && world.faiths.get(s.faithId)?.name) || culture.religion.name,
      biome: biomeAt(x, y),
      people: s.pop.reduce((n, p) => n + p.count, 0),
      founded: s.founded,
      realm: civ?.name ?? '',
      history: line?.text ?? '',
    };
  });
}
