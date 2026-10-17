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
  ] as const)
    index(target, target, files[target]);
  const part = (file: string, key: string): unknown =>
    (files[file] as Record<string, unknown> | undefined)?.[key];
  index('biomes', 'biomes.biomes', part('biomes', 'biomes'));
  index('faiths', 'faiths.defs', part('faiths', 'defs'));
  index('terrain', 'terrain.kinds', part('terrain', 'kinds'));
  // Lists nothing refers to yet still need unique ids.
  for (const file of [
    'features',
    'resources',
    'weather',
    'awakenings',
    'ailments',
    'diseases',
    'events',
  ])
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
    errors.push(...checkTierCaps(files), ...checkTerrain(files), ...checkCalendar(files));
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
