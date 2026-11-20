// What tools read from content (tools.json, Bundle 3, V-088; needed tools and knapping, V-195).

/** Tools (tools.json, Bundle 3, V-088): kinds and what each serves, materials with speed (per cent)
 * and life (work minutes), the quality bonus and how a tool is made. */
export interface ToolsDef {
  week: number;
  cart: number;
  /** The material of the cart's tools, and the Work sheet kind (jobs.json) that smiths them. */
  cartMaterial: string;
  job: string;
  none: number;
  step: number;
  stream: string;
  roll: number;
  skilled: number;
  charcoal: string;
  /** Per cent of life left under which a held tool is worn and asks for a better one (P4.9). */
  worn: number;
  /** Knapping a stone tool (V-195): the Work sheet kind, its minutes, what it uses, and the Work
   * row of a needed use that is not a jobs.json id (`split` is the Tend row). */
  knap: {
    job: string;
    stream: string;
    minutes: number;
    from: Readonly<Record<string, number>>;
    rows: Readonly<Record<string, string>>;
    /** Inputs picked up loose where they work when none can be fetched. */
    loose: readonly string[];
  };
  kinds: readonly {
    id: string;
    name: string;
    serves: readonly string[];
    /** Uses nobody takes up without one (V-195), and what stops when the last one breaks. */
    needed?: readonly string[];
    stops?: string;
    /** What a stone one is knapped from, when not `knap.from`. */
    knap?: Readonly<Record<string, number>>;
    ingots: number;
    charcoal: number;
    minutes: number;
    /** How many the cart brings, when not `cart`. */
    cart?: number;
    /** At most this many people want one at once, those who do its work most. */
    holders?: number;
  }[];
  materials: readonly { id: string; name: string; speed: number; life: number; ingot?: string }[];
  quality: Readonly<Record<string, number>>;
}
