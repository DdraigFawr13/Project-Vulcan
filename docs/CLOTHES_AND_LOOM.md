# Clothes and the loom

Phase 5B Bundle 5 (P5.5, V-134). Content: `src/content/data/clothes.json`. Nobody is ordered (V-041): the levers are the Clothes plate on the Stock sheet and the Weaver, Tanner and Tailor rows under the Loom heading on the Work sheet.

## Wearing (needs)

- Everyone wears one garment in each slot of `clothes.slots`: everyday and outer. `needs/clothes.ts` wears the everyday garment 1 an awake hour, the outer one 1 an hour outdoors, `clothes.cold` an hour outdoors under the warmth comfort line. At 0 it is gone (`goods.wornOut`, citing its made line) and the wearer gets `ragged`.
- Warmth outdoors adds each worn garment's `warmth` (`clothesWarmth`).
- The cart and each newcomer come dressed in `clothes.cart` / `clothes.newcomer` (goods `putOn`).

## Changing (people)

- `change.ts`: someone whose garment in a slot is gone or under `clothes.change` per cent changes into the warmest spare in a store that nobody else is going for (`people.changed`, with why). A fine one adds `well-dressed`.
- goods `shortOf(world, content, slot)`: the plate's share for the slot (everyday takes the odd one), plus people due to change it, less the unworn spares of it.

## The loom and flax (build)

- `loom.ts` `loomWant` (in `nextWant`, after beds): with no loom and fleece or flax enough for a weave recipe, a loom against a wall of a room with a hearth, else the hall, else the largest room. Carpentry makes it with the why "3 fleece wait to be woven".
- `flaxWanted`: the everyday clothes wanted are more than the wool, fleece, linen and flax (in hand and growing) can make. While it holds, `cropNow` sows `clothes.flax.crop` for a field's `instead` course (beans) in a month flax is sown in. Reaping keeps seed back only from food crops.

## Weaving and tailoring (people)

- `weave.ts`, the Weaver row (crafting skill): once a loom stands and the tailor is short of cloth (`clothShort`: everyday short + 2 for each outer short that leather cannot make, less wool and linen), one free able person fetches fleece, else flax, works beside the loom `minutes × 2 × skilled ÷ (skilled + level)` and lays the cloth (`work.tookUpWeaving` citing the loom, the plate and priority; `loom.wove`).
- `tailor.ts`, the Tailor row: while a slot is short, the warmest garment whose inputs can be reached, made at the nearest table, else the loom; one garment a slot at once. Worth is the crafting level ± `tailor.roll` from the `craft` stream, against `clothes.worth`; a garment's life is its `last` × the worth's per cent (`work.tookUpTailoring`, `clothes.made`).
- `trades.ts` holds the take-up and minute dispatch of these jobs for `jobs.ts`.

## Tests

- `needs/clothes.test.ts`: wear rates; changing into a spare.
- `people/loom.test.ts`: a loom made, fleece woven and a garment made, unordered; flax for a beans course while clothes are short.
