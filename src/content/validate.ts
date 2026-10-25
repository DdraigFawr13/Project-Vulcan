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
  index('wild-prints', 'wild.prints', part('wild', 'prints'));
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
      ...checkHaul(files),
      ...checkWild(files),
      ...checkFlock(files),
      ...checkStrangers(files),
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

// A house names parts of the right kind (src/engine/build), room floors are floor parts and the
// Roads row lays a road part (P5.10).
function checkHouse(files: Files): string[] {
  const b = files['buildings'] as {
    parts: { id: string; kind: string }[];
    house: { walls: string[]; door: string; floor: string };
    rooms: { floors: Record<string, number> };
    roads: { part: string };
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
  want(b.roads.part, 'road', 'roads.part');
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

// Whatever a vein yields can lie on the ground for haulers to carry up (P4.1), so it is a haul kind.
function checkHaul(files: Files): string[] {
  const kinds = (files['work'] as { haul: { kinds: string[] } }).haul.kinds;
  return (files['features'] as { id: string; kind: string; yields?: string }[]).flatMap((f) =>
    f.kind === 'vein' && f.yields && !kinds.includes(f.yields)
      ? [
          `features[${f.id}].yields: "${f.yields}" is not in work.haul.kinds, so nobody would carry it`,
        ]
      : [],
  );
}

// The wild valley (src/engine/wild): every month it names is a calendar month, a species has art
// kinds and a habitat, there is a predator to fall back on and a default word for any ground.
function checkWild(files: Files): string[] {
  const w = files['wild'] as {
    species: { id: string; kinds: string[]; habitat: unknown[]; breed: { months: string[] } }[];
    predators: unknown[];
    winter: string[];
    pack: { returns: { month: string } };
    where: Record<string, string>;
  };
  const months = (files['calendar'] as { monthNames: string[] }).monthNames;
  const errors: string[] = [];
  const month = (m: string, at: string) => {
    if (!months.includes(m)) errors.push(`wild.${at}: "${m}" is no month`);
  };
  w.winter.forEach((m, k) => month(m, `winter[${k}]`));
  month(w.pack.returns.month, 'pack.returns.month');
  for (const s of w.species) {
    s.breed.months.forEach((m, k) => month(m, `species[${s.id}].breed.months[${k}]`));
    if (!s.kinds.length) errors.push(`wild.species[${s.id}].kinds: none`);
    if (!s.habitat.length) errors.push(`wild.species[${s.id}].habitat: none`);
  }
  if (!w.predators.length) errors.push('wild.predators: none');
  if (!w.where['default']) errors.push('wild.where: no default');
  return errors;
}

// The flock (src/engine/flock): every month it names is a calendar month, every species it tames
// is a wild species with its kind words, and the pasture's parts are built parts.
function checkFlock(files: Files): string[] {
  const f = files['flock'] as {
    pasture: { hurdle: string; gate: string };
    tame: { species: string[]; young: string[]; months: string[] };
    kinds: { species: string }[];
    lambing: { month: string; grown: string };
    shear: { month: string };
    hay: { months: string[]; thaw: string };
    cull: { month: string };
    memories: Record<string, string>;
    why: Record<string, string>;
  };
  const months = (files['calendar'] as { monthNames: string[] }).monthNames;
  const species = (files['wild'] as { species: { id: string }[] }).species.map((s) => s.id);
  const parts = (files['buildings'] as { parts: { id: string }[] }).parts.map((p) => p.id);
  const memories = (files['memories'] as { id: string }[]).map((m) => m.id);
  const errors: string[] = [];
  const month = (m: string, at: string) => {
    if (!months.includes(m)) errors.push(`flock.${at}: "${m}" is no month`);
  };
  f.tame.young.forEach((m, k) => month(m, `tame.young[${k}]`));
  f.tame.months.forEach((m, k) => month(m, `tame.months[${k}]`));
  f.hay.months.forEach((m, k) => month(m, `hay.months[${k}]`));
  month(f.lambing.month, 'lambing.month');
  month(f.lambing.grown, 'lambing.grown');
  month(f.shear.month, 'shear.month');
  month(f.hay.thaw, 'hay.thaw');
  month(f.cull.month, 'cull.month');
  for (const s of f.tame.species) {
    if (!species.includes(s)) errors.push(`flock.tame.species: "${s}" is no wild species`);
    if (!f.kinds.some((k) => k.species === s)) errors.push(`flock.kinds: none for "${s}"`);
  }
  for (const p of [f.pasture.hurdle, f.pasture.gate])
    if (!parts.includes(p)) errors.push(`flock.pasture: "${p}" is no part`);
  for (const [k, m] of Object.entries(f.memories))
    if (!memories.includes(m)) errors.push(`flock.memories.${k}: "${m}" is no memory`);
  // The reasons the people side gives for a flock left out (people herd.ts).
  for (const k of ['abed', 'warming', 'eating', 'toFold', 'busy', 'noWay', 'none'])
    if (!f.why[k]) errors.push(`flock.why: no "${k}"`);
  return errors;
}

// Strangers (src/engine/people/strangers.ts): every month named is a calendar month, every reason
// a kind, the animals flock species and the law a law.
function checkStrangers(files: Files): string[] {
  const f = files['strangers'] as {
    draw: { first: { month: string } };
    weigh: { harvest: string };
    reasons: Record<string, string>;
    kinds: { id: string }[];
    animals: string[];
    law: string;
  };
  const months = (files['calendar'] as { monthNames: string[] }).monthNames;
  const species = (files['flock'] as { kinds: { species: string }[] }).kinds.map((k) => k.species);
  const laws = (files['laws'] as { laws: { id: string }[] }).laws.map((l) => l.id);
  const errors: string[] = [];
  for (const [at, m] of [
    ['draw.first.month', f.draw.first.month],
    ['weigh.harvest', f.weigh.harvest],
  ])
    if (!months.includes(m!)) errors.push(`strangers.${at}: "${m}" is no month`);
  for (const [k, kind] of Object.entries(f.reasons))
    if (!f.kinds.some((d) => d.id === kind))
      errors.push(`strangers.reasons.${k}: no kind "${kind}"`);
  if (!f.kinds.some((d) => d.id === 'wander')) errors.push('strangers.kinds: no "wander"');
  for (const a of f.animals)
    if (!species.includes(a)) errors.push(`strangers.animals: "${a}" is no flock species`);
  if (!laws.includes(f.law)) errors.push(`strangers.law: "${f.law}" is no law`);
  return errors;
}
