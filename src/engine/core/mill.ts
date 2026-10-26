// The mill and the bakery (5B Bundle 4, P5.11, V-133): buildings.json `mill`.

/** Grinding grain to flour, the quern, the water mill and baking (build/mill.ts, people/mill.ts). */
export interface MillDef {
  /** The jobs.json job of the Miller row; the grains ground (`from`, in order), one flour each. */
  job: string;
  from: readonly string[];
  flour: string;
  /** The hand quern, a furniture kind: `rate` grain an hour, `batch` a time, at most `most`
   * minutes a day for each quern. */
  quern: { kind: string; rate: number; batch: number; most: number };
  /** The water mill's wheel: `rate` grain an hour, `batch` a time. */
  wheel: { rate: number; batch: number };
  /** A mill is wanted when grinding at the quern passes `want` minutes a day over `days` days; it
   * is a `w` by `h` building (walls by the house wall rule, a `door`, a `floor`) on running water
   * within `near` tiles of the green, its millstones the furniture kind `stones`; the best `tries`
   * sites are looked at. */
  want: number;
  days: number;
  w: number;
  h: number;
  near: number;
  tries: number;
  door: string;
  floor: string;
  stones: string;
  /** Baking (the Baker row): bread for `perPerson` a person from flour, a loaf for each flour,
   * burning a `fuel` a batch, at a hearth or the oven (a furniture kind, wanted beside the mill
   * when flour has been over its plate `days` days running); minutes at cooking skill `skilled`. */
  bake: {
    job: string;
    bread: string;
    fuel: string;
    perPerson: number;
    skilled: number;
    hearth: { batch: number; minutes: number };
    oven: { kind: string; batch: number; minutes: number; days: number };
  };
}
