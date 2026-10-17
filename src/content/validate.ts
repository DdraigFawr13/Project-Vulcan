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
    if (!(name in files)) errors.push(`${name}: file missing`);
    else check(spec, files[name], name, errors, refs);
  }
  for (const name of Object.keys(files))
    if (!(name in SCHEMAS)) errors.push(`${name}: no schema for this file`);

  const known = new Map<RefTarget, Set<string>>();
  const index = (target: RefTarget, file: string, list: unknown): void => {
    const ids = idsOf(list);
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${file}[${id}]: duplicate id`);
      seen.add(id);
    }
    known.set(target, seen);
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
  index('biomes', 'biomes', (files['biomes'] as { biomes?: unknown } | undefined)?.biomes);

  for (const use of refs) {
    const ids = known.get(use.target) ?? new Set<string>();
    if (!ids.has(use.value)) {
      const some = [...ids].slice(0, 4).join(', ');
      errors.push(`${use.path}: "${use.value}" is not in ${use.target} (known: ${some}, …)`);
    }
  }
  if (errors.length === 0) errors.push(...checkTierCaps(files));
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
