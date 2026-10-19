// What the metal chain reads from content (metal.json, Phase 4 Bundle 3).

/** One recipe: `inputs` make `out` of `makes`; an `alloy` mixes ingots instead of smelting ore. */
export interface RecipeDef {
  id: string;
  makes: string;
  out: number;
  inputs: readonly { kind: string; count: number }[];
  minutes: number;
  alloy: boolean;
}

export interface MetalDef {
  /** The charcoal clamp: logs stacked, minutes to stack, burn and open, charcoal laid. */
  clamp: {
    job: string;
    item: string;
    /** The item stacked on the clamp. */
    wood: string;
    logs: number;
    yield: number;
    build: number;
    burn: number;
    open: number;
    skilled: number;
    size: number;
  };
  /** The smelter: built of `cost` `material` in `minutes`, sited within `reach` outside the ring. */
  smelter: {
    job: string;
    size: number;
    material: string;
    cost: number;
    minutes: number;
    skilled: number;
    reach: number;
  };
  recipes: readonly RecipeDef[];
  /** Most steps kept on an item's trail. */
  trail: { most: number };
}

export interface MetalDefs {
  metal: MetalDef;
}
