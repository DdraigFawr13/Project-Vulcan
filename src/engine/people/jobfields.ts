// The person fields the work in jobs.ts keeps (kept apart so jobs.ts stays under its line limit).
export const JOB_FIELDS = {
  /** A Work sheet job, `station` (a station being built), `hearth` (one being made) or ''. */
  job: 'text',
  /** The tile being felled or quarried, or the item going to be fetched; -1 for none. */
  target: 'int',
  /** Minutes of felling or quarrying left on the target. */
  work: 'int',
  /** Their line taking up the work, which each tree they fell (or part they build) cites. */
  took: 'event',
  /** The plan they are building (P3.1), the field they are sowing or reaping (P4.7), the shaft
   * they are sinking or tunnelling from (P4.1) or the wall waiting for their clay, or 0. */
  plan: 'int',
  /** Mining (P4.1): `sink`, `tunnel`, `mine` or `clay`, and the metal (or the part, for clay). */
  task: 'text',
  what: 'text',
  /** The tick before which they do not look for work again after finding none. */
  next: 'int',
  /** The recipe being smelted (metal.json) or the clamp's task, `stack` or `open`; '' for none. */
  make: 'text',
  /** Smithing (Bundle 3): the tool being made as `kind:material`, and the line of this person's
   * first fine-or-better piece (V-093), 0 until they make one. */
  making: 'text',
  fine: 'event',
  /** Cooking (P5.3): the line of their first fine meal, 0 until they cook one; `lit` the work
   * minutes left when they last worked at the fire, so a fire that went out mid-batch is seen. */
  fineMeal: 'event',
  lit: 'int',
  /** Herding: hay carried to the rick; the herd being tamed and the minutes sat near it. */
  hay: 'count',
  herdId: 'int',
  sat: 'count',
  /** Watering (Bundle 2): the tiles' worth of water carried, 0 while fetching. */
  pail: 'count',
} as const;
