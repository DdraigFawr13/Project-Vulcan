// Lying snow (V-122): each midnight a wet day lays snow on every dry tile at or below 0 degrees C,
// and a day at `seasons.snowMelt` or above takes it off. The layer is `map.snowLie`; the system
// keeps only the count of snowy tiles and whether the valley counts as snowed.
import { CHUNK, chunksAcross, raiseChunk } from '../map/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { tileTemperature } from './temperature.ts';

/** One day of snow over the surface; writes the count and the one line a change of state earns. */
export function settleSnow(ctx: SystemContext): void {
  const { content, world, state } = ctx;
  const map = world.map;
  const { snowMelt, snowShare } = content.seasons;
  const wet = state['wet'] === 1;
  // Nothing lies and nothing falls: nothing to do.
  if (!wet && !state['snowTiles']) return;
  const kinds = content.terrain.kinds;
  const across = chunksAcross(map);
  const changed = new Set<number>();
  let open = 0;
  let snowed = 0;
  for (let i = 0; i < map.tiles.length; i += 1) {
    const kind = kinds[map.tiles[i]!]!;
    if (kind.water) continue;
    const ground = !kind.stone && !kind.solid;
    if (ground) open += 1;
    const t = tileTemperature(content, map, state['temp']!, i);
    const lies = map.snowLie[i]!;
    let now = lies;
    if (lies && t >= snowMelt) now = 0;
    else if (!lies && wet && t <= 0) now = 1;
    if (now !== lies) {
      map.snowLie[i] = now;
      const x = i % map.width;
      const y = (i - x) / map.width;
      changed.add(Math.floor(y / CHUNK) * across + Math.floor(x / CHUNK));
    }
    if (now && ground) snowed += 1;
  }
  for (const c of changed) raiseChunk(map, (c % across) * CHUNK, Math.floor(c / across) * CHUNK);
  state['snowTiles'] = snowed;
  const settled = open > 0 && snowed >= open * snowShare;
  if (settled && !state['snowing']) {
    state['snowLine'] = ctx.emit('weather.snowSettled', {
      causes: [state['spell']!],
      data: { share: Math.floor((snowed * 100) / open) },
    });
  } else if (!settled && state['snowing']) {
    state['snowLine'] = ctx.emit('weather.snowMelted', { causes: [state['spell']!] });
  }
  state['snowing'] = settled ? 1 : 0;
}
