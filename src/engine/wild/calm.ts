// Content with the wild valley kept out of the people's way (P5.4a), for tests of other systems
// over fixed seeds whose claims were made before wolves: nobody takes up hunting or fishing, and
// the pack never comes to town or attacks. The herds and pack still exist; they only keep to
// themselves.
import type { EngineContent } from '../core/index.ts';

export const withoutWild = <C extends EngineContent>(content: C): C => ({
  ...content,
  work: {
    ...content.work,
    hunt: { ...content.work.hunt, crew: 0 },
    fish: { ...content.work.fish, crew: 0 },
  },
  wild: {
    ...content.wild,
    pack: { ...content.wild.pack, visit: 1_000_000 },
    folk: { ...content.wild.folk, attackAfter: 1_000_000 },
  },
});
