// A field tile's soil, rotation, blight and water rows (5B Bundle 2, V-130): the engine's soil,
// course, blight and dry-day counts put into words. Pure reads (GAME-02); nothing here picks a
// tile, a crop or a person (V-041): the colonists choose the crop from the rotation.
import { content } from '../content/index.ts';
import {
  cropOf,
  farFromWater,
  fieldTiles,
  meanSoil,
  wetDays,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { FieldView } from './protocol-build.ts';

const def = content.buildings.field;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const ints = (f: EntityRow, key: string): number[] => (f[key] as number[] | undefined) ?? [];
const nameOf = (id: string): string => cropOf(content, id)?.name ?? id;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "fair, 47 of 100. Barley takes 12 a harvest; beans give back 10, winter fallow 6, a load of muck 8". */
function soilWords(world: WorldState, f: EntityRow): string {
  const { soil } = def;
  const mean = meanSoil(world, f);
  const word =
    mean < soil.rest ? 'worn out' : mean < soil.base ? 'fair' : mean < 70 ? 'good' : 'rich';
  const crop = cropOf(content, f['crop'] as string);
  const gives = def.crops.filter((c) => c.draw < 0).map((c) => `${c.name} give back ${-c.draw}`);
  const verb = crop?.name.endsWith('s') ? 'take' : 'takes';
  const takes = crop && crop.draw > 0 ? `${cap(crop.name)} ${verb} ${crop.draw} a harvest; ` : '';
  const rest = mean < soil.rest ? `; under ${soil.rest} a field rests a season` : '';
  return (
    `${cap(word)}, ${mean} of 100. ${takes}${[...gives, `winter fallow ${soil.winter.gain}`, `a load of muck ${soil.muck.gain}`].join(', ')}` +
    rest
  );
}

/** "turnips (sown in Highsun or Goldmonth), then beans, then cabbages". */
function nextWords(f: EntityRow): string {
  const { rotation } = def;
  const at = f['course'] as number;
  const ids = [0, 1, 2].map((k) => rotation[(at + k) % rotation.length]!);
  const first = cropOf(content, ids[0]!);
  const sow = first?.sow ?? [];
  const when = sow.length > 2 ? `${sow[0]} to ${sow.at(-1)}` : sow.join(' or ');
  const months = first ? ` (sown ${when})` : '';
  return `${nameOf(ids[0]!)}${months}, then ${ids.slice(1).map(nameOf).join(', then ')}`;
}

/** "4 tiles brown, nothing from them; it spreads while the wet lasts", or the wet days so far. */
function blightWords(world: WorldState, f: EntityRow): string {
  const sick = ints(f, 'blight').length;
  const { span, start } = def.blight;
  const wet = `${plural(wetDays(world), 'wet day')} in the last ${span}`;
  if (!sick) return `none; ${wet} (blight can start at ${start})`;
  const cut = (f['cut'] as number) ? `; cut early at ${f['cut'] as number} per cent grown` : '';
  return `${plural(sick, 'tile')} brown, nothing from them; it spreads tile to tile while the wet lasts (${wet})${cut}`;
}

/** "by water", or how many rows lie far from it and the dry days they went unwatered. */
function waterWords(world: WorldState, f: EntityRow): string {
  const tiles = fieldTiles(f);
  const far = tiles.filter((i) => farFromWater(world, content, i)).length;
  const near = plural(def.dry.near, 'tile');
  if (!far) return `every row within ${near} of water: a dry spell costs it nothing`;
  const dry = Math.max(0, ...ints(f, 'dry'));
  const lost = dry
    ? `; the far rows have gone ${plural(dry, 'dry day')} unwatered this crop`
    : '; farmers carry water to them in a dry spell';
  return `${far} of ${plural(tiles.length, 'tile')} more than ${near} from water${lost}`;
}

/** The soil, next, blight and water rows of a field tile's page. */
export const fieldCare = (
  world: WorldState,
  f: EntityRow,
): Pick<FieldView, 'soil' | 'next' | 'blight' | 'water'> => ({
  soil: soilWords(world, f),
  next: nextWords(f),
  blight: blightWords(world, f),
  water: waterWords(world, f),
});
