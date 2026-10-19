// Shape of Vulcan's metal file (src/content/data/metal.json, Phase 4 Bundle 3): the charcoal
// clamp, the smelter and the recipes that turn ore and charcoal into ingots and ingots into
// bronze. Minutes are game minutes at skill 0 (worked as `minutes × 2 × skilled ÷ (skilled + level)`).
import { bool, list, num, obj, ref } from './schema';
import { count, id } from './schema-fields';

export const METAL_SCHEMAS = {
  metal: obj({
    // The charcoal clamp: a `size` by `size` spot beside the smelter. A burner stacks `logs` logs
    // on it (`build` minutes), lights it, it burns `burn` minutes untended, then opening it takes
    // `open` minutes and lays `yield` charcoal. Worked at skill `skilled` of the job's skill.
    clamp: obj({
      job: ref('jobs'),
      item: ref('items'),
      logs: num({ min: 1 }),
      yield: num({ min: 1 }),
      build: num({ min: 1 }),
      burn: num({ min: 1 }),
      open: num({ min: 1 }),
      skilled: num({ min: 1 }),
      size: num({ min: 1 }),
    }),
    // The smelter: a `size` by `size` piece built of `cost` of `material` in `minutes` by builders,
    // sited within `reach` tiles outside the town ring. Smelting is the `job` (its skill).
    smelter: obj({
      job: ref('jobs'),
      size: num({ min: 1 }),
      material: ref('items'),
      cost: num({ min: 1 }),
      minutes: num({ min: 1 }),
      skilled: num({ min: 1 }),
      reach: count,
    }),
    // One recipe: `inputs` make `out` of `makes` in `minutes` at smithing 0; an `alloy` mixes
    // ingots instead of smelting ore.
    recipes: list(
      obj({
        id,
        makes: ref('items'),
        out: num({ min: 1 }),
        inputs: list(obj({ kind: ref('items'), count: num({ min: 1 }) })),
        minutes: num({ min: 1 }),
        alloy: bool(),
      }),
    ),
    // Item trails: at most `most` steps are kept on an item.
    trail: obj({ most: num({ min: 2 }) }),
  }),
};
