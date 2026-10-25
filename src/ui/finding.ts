// Finding people on the map (Morgan, 2026-10-25): a face on the strip moves the camera to that
// person, on their level, clear of the sheet; the person whose sheet is open wears a ring on the
// map; the strip's names button rings and names everyone. The view only: nothing here selects,
// orders or moves anyone (V-015, V-041).
import type { Renderer } from '../render/index.ts';
import type { Panel } from './panel.ts';
import type { SheetDeps } from './sheets.ts';

export function finding(
  renderer: Renderer,
  panel: Panel,
  level: (z: number) => void,
): Pick<SheetDeps, 'find' | 'follow' | 'names'> {
  return {
    find: (id) => {
      const at = renderer.placeOf(id);
      if (!at) return;
      level(at.z);
      renderer.focus(at.x, at.y, panel.below());
      renderer.follow(id, true);
    },
    follow: (id, pulse) => renderer.follow(id, pulse),
    names: (on) => renderer.showNames(on),
  };
}
