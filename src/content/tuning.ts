import type { MapGenDef, Tuning } from '../engine/core/types.ts';

// Time: one tick is 6 game minutes, so 10 ticks an hour and 240 a day.
export const tuning: Tuning = {
  ticksPerDay: 240,
  ticksPerHour: 10,
  needMax: 1000,
  // Food empties in about 1.4 days, rest over a long waking day, company over about 2 days.
  decayPerTick: { food: 3, rest: 4, company: 2 },
  lowAt: { food: 450, rest: 300, company: 350 },
  criticalAt: { food: 120, rest: 60, company: 0 },
  // One meal covers about half a day of hunger.
  mealValue: 450,
  eatTicks: 3,
  // A night by a lit hearth (80 ticks) refills rest; a cold night only about 60%.
  restPerTickWarm: 12,
  restPerTickCold: 7,
  wakeAt: 950,
  nightStartHour: 22,
  nightEndHour: 6,
  chatTicks: 5,
  chatValue: 300,
  chatRange: 6,
  // One wood keeps the hearth lit for 3 hours.
  fuelPerWood: 30,
  stokeBelow: 60,
  warmRadius: 4,
  bushMax: 3,
  // A picked bush regrows one berry-meal every 1.5 days.
  bushRegrowTicks: 360,
  treeWood: 3,
  likedJobBonus: 0.25,
  startingStock: { food: 20, wood: 6 },
};

export const mapGen: MapGenDef = {
  width: 64,
  height: 48,
  noiseCell: 8,
  waterBelow: 280,
  rockAbove: 780,
  forestAbove: 560,
  treeChance: 0.55,
  bushChance: 0.07,
  clearRadius: 3,
};
