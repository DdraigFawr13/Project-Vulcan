// Checks forked content: each file's shape, unique ids, every cross-reference, and that
// each spell stays inside the caps of its power tier. Returns one line per problem.
import { check, type RefTarget, type RefUse } from './schema';
import { SCHEMAS } from './schemas';

type Files = Readonly<Record<string, unknown>>;

const idsOf = (list: unknown): string[] =>
  Array.isArray(list)
    ? list.flatMap((e: unknown) =>
        e && typeof e === 'object' && typeof (e as { id?: unknown }).id === 'string'
          ? [(e as { id: string }).id]
          : [],
      )
    : [];

export function validateContent(files: Files): string[] {
  const errors: string[] = [];
  const refs: RefUse[] = [];
  for (const [name, spec] of Object.entries(SCHEMAS)) {
    if (!Object.hasOwn(files, name)) errors.push(`${name}: file missing`);
    else check(spec, files[name], name, errors, refs);
  }
  for (const name of Object.keys(files))
    if (!Object.hasOwn(SCHEMAS, name)) errors.push(`${name}: no schema for this file`);

  const known = new Map<RefTarget, Set<string>>();
  const unique = (file: string, list: unknown): Set<string> => {
    const seen = new Set<string>();
    for (const id of idsOf(list)) {
      if (seen.has(id)) errors.push(`${file}[${id}]: duplicate id`);
      seen.add(id);
    }
    return seen;
  };
  const index = (target: RefTarget, file: string, list: unknown): void => {
    known.set(target, unique(file, list));
  };
  for (const target of [
    'races',
    'cultures',
    'schools',
    'abilities',
    'creatures',
    'items',
    'needs',
    'traits',
    'memories',
    'jobs',
    'conditions',
    'tiers',
    'weather',
  ] as const)
    index(target, target, files[target]);
  const part = (file: string, key: string): unknown =>
    (files[file] as Record<string, unknown> | undefined)?.[key];
  index('biomes', 'biomes.biomes', part('biomes', 'biomes'));
  index('faiths', 'faiths.defs', part('faiths', 'defs'));
  index('terrain', 'terrain.kinds', part('terrain', 'kinds'));
  // Lists nothing refers to yet still need unique ids.
  for (const file of ['features', 'resources', 'awakenings', 'ailments', 'diseases', 'events'])
    unique(file, files[file]);
  unique('great-works.kinds', part('great-works', 'kinds'));
  unique('dragons.tempers', part('dragons', 'tempers'));

  for (const use of refs) {
    const ids = known.get(use.target) ?? new Set<string>();
    if (!ids.has(use.value)) {
      const some = [...ids].slice(0, 4).join(', ');
      errors.push(`${use.path}: "${use.value}" is not in ${use.target} (known: ${some}, …)`);
    }
  }
  // Tier caps read the files as typed, so they run only once every shape is valid.
  if (errors.length === 0)
    errors.push(
      ...checkTierCaps(files),
      ...checkTerrain(files),
      ...checkCalendar(files),
      ...checkHouse(files),
      ...checkCrops(files),
    );
  errors.push(...checkBand(files));
  return errors;
}

interface Tier {
  id: string;
  minPower: number;
  maxPower: number;
  caps: { maxDamage: number; maxAreaRadius: number; maxUsesPerDay: number };
}
interface Ability {
  id: string;
  family: string;
  requirements: Record<string, number>;
  effect: { damage?: number; areaRadius?: number; usesPerDay?: number };
}

// Only called on files that already passed their schemas, so the casts hold.
function checkTierCaps(files: Files): string[] {
  const tiers = files['tiers'] as Tier[];
  const errors: string[] = [];
  for (const a of files['abilities'] as Ability[]) {
    if (a.family !== 'magic') continue;
    const power = a.requirements['power'] ?? 0;
    const tier = tiers.find((t) => power >= t.minPower && power <= t.maxPower);
    const at = `abilities[${a.id}]`;
    if (!tier) {
      errors.push(`${at}: power ${power} is in no tier`);
      continue;
    }
    const over = (value: number | undefined, cap: number, what: string): void => {
      if (value !== undefined && value > cap)
        errors.push(`${at}.effect.${what}: ${value} is over the ${tier.id} cap of ${cap}`);
    };
    over(a.effect.damage, tier.caps.maxDamage, 'damage');
    over(a.effect.areaRadius, tier.caps.maxAreaRadius, 'areaRadius');
    over(a.effect.usesPerDay, tier.caps.maxUsesPerDay, 'usesPerDay');
  }
  return errors;
}

// Map tiles are whole-number sizes and travel as bytes (src/engine/map), so at most 256 kinds.
function checkTerrain(files: Files): string[] {
  const { surface, kinds } = files['terrain'] as {
    surface: { width: number; height: number };
    kinds: { id: string; variants: number }[];
  };
  const errors: string[] = [];
  for (const side of ['width', 'height'] as const)
    if (!Number.isInteger(surface[side]) || surface[side] < 1)
      errors.push(`terrain.surface.${side}: ${surface[side]} is not a whole number of tiles`);
  if (kinds.length > 256) errors.push(`terrain.kinds: ${kinds.length} kinds, at most 256`);
  // The weather reads one seasons entry per weather kind and one month offset per month, and keeps
  // the ice count in 7 bits (src/engine/weather).
  const seasons = files['seasons'] as
    { months: unknown[]; kinds: { weather: string }[]; ice: { cap: number } } | undefined;
  const calendar = files['calendar'] as { monthsPerYear: number } | undefined;
  if (seasons && calendar && seasons.months.length !== calendar.monthsPerYear)
    errors.push(`seasons.months: ${seasons.months.length} entries, one per month needed`);
  for (const w of (files['weather'] as { id: string }[] | undefined) ?? [])
    if (seasons && !seasons.kinds.some((k) => k.weather === w.id))
      errors.push(`seasons.kinds: no entry for the weather "${w.id}"`);
  if (seasons && seasons.ice.cap > 127)
    errors.push(`seasons.ice.cap: ${seasons.ice.cap}, at most 127`);
  // Features travel as bytes too, with 0 for a bare tile.
  const features = files['features'] as unknown[];
  if (features.length > 255) errors.push(`features: ${features.length} kinds, at most 255`);
  for (const kind of kinds)
    if (!Number.isInteger(kind.variants))
      errors.push(`terrain.kinds[${kind.id}].variants: ${kind.variants} is not a whole number`);
  return errors;
}

// The clock divides by these and indexes the names with them (src/engine/core/clock.ts).
function checkCalendar(files: Files): string[] {
  const c = files['calendar'] as {
    daysPerWeek: number;
    daysPerMonth: number;
    monthsPerYear: number;
    seasons: string[];
    monthNames: string[];
  };
  const errors: string[] = [];
  for (const field of ['daysPerWeek', 'daysPerMonth', 'monthsPerYear'] as const)
    if (!Number.isInteger(c[field]) || c[field] < 1)
      errors.push(`calendar.${field}: ${c[field]} is not a whole number above 0`);
  if (c.monthNames.length !== c.monthsPerYear)
    errors.push(`calendar.monthNames: ${c.monthNames.length} names for ${c.monthsPerYear} months`);
  if (c.seasons.length < 1 || c.monthsPerYear % c.seasons.length !== 0)
    errors.push(
      `calendar.seasons: ${c.seasons.length} seasons don't split ${c.monthsPerYear} months evenly`,
    );
  return errors;
}

// The band (src/engine/people): every must-have is a skill they have, colours are #rrggbb, every
// race can be given hair, and the spots can hold the whole band.
function checkBand(files: Files): string[] {
  const b = files['band'] as {
    size: number;
    skills: string[];
    must: string[];
    spots: unknown[];
    hairStyles: Record<string, number>;
    hair: Record<string, string[]>;
    clothes: Record<string, string[]>;
    defaultClothes: string[];
  };
  const errors: string[] = [];
  for (const m of b.must)
    if (!b.skills.includes(m)) errors.push(`band.must: "${m}" is not one of band.skills`);
  if (b.spots.length < b.size) errors.push(`band.spots: ${b.spots.length}, fewer than band.size`);
  if (!Object.values(b.hairStyles).some((w) => w > 0)) errors.push('band.hairStyles: no weight');
  for (const race of files['races'] as { id: string }[])
    if (!b.hair[race.id]?.length) errors.push(`band.hair: no colours for "${race.id}"`);
  // A person's given name comes from the culture's whole names or its syllables (src/engine/people).
  for (const c of files['cultures'] as { id: string; names: Record<string, unknown> }[]) {
    const n = c.names as {
      givenStarts: string[];
      givenEnds: string[];
      givenNames?: Record<string, string[]>;
    };
    const whole = ['f', 'm'].every((sex) => n.givenNames?.[sex]?.length);
    if (!whole && (n.givenStarts.length === 0 || n.givenEnds.length === 0))
      errors.push(`cultures[${c.id}].names: no given names or syllables to make them`);
  }
  const colours = [...Object.values(b.hair), ...Object.values(b.clothes), b.defaultClothes].flat();
  if (b.defaultClothes.length === 0) errors.push('band.defaultClothes: empty');
  for (const c of colours)
    if (!/^#[0-9a-f]{6}$/.test(c)) errors.push(`band: colour "${c}" is not #rrggbb`);
  return errors;
}

// A house names parts of the right kind (src/engine/build), and room floors are floor parts.
function checkHouse(files: Files): string[] {
  const b = files['buildings'] as {
    parts: { id: string; kind: string }[];
    house: { walls: string[]; door: string; floor: string };
    rooms: { floors: Record<string, number> };
  };
  const kindOf = (id: string) => b.parts.find((p) => p.id === id)?.kind;
  const errors: string[] = [];
  const want = (id: string, kind: string, at: string) => {
    if (kindOf(id) !== kind) errors.push(`buildings.${at}: "${id}" is not a ${kind} part`);
  };
  b.house.walls.forEach((w, k) => want(w, 'wall', `house.walls[${k}]`));
  want(b.house.door, 'door', 'house.door');
  want(b.house.floor, 'floor', 'house.floor');
  for (const f of Object.keys(b.rooms.floors)) want(f, 'floor', `rooms.floors.${f}`);
  return errors;
}

// A crop's sowing months are calendar months, and every crop has one (P4.7).
function checkCrops(files: Files): string[] {
  const b = files['buildings'] as { field: { crops: { id: string; sow: string[] }[] } };
  const months = (files['calendar'] as { monthNames: string[] }).monthNames;
  const errors: string[] = [];
  for (const crop of b.field.crops) {
    if (!crop.sow.length) errors.push(`buildings.field.crops[${crop.id}]: no sowing month`);
    for (const m of crop.sow)
      if (!months.includes(m)) errors.push(`buildings.field.crops[${crop.id}]: "${m}" is no month`);
  }
  return errors;
}
