// Smithing skill for the band (Bundle 3). It is not one of `band.skills`: the band's draw
// (band.ts) is left exactly as it was, so names and the other skills of a seed do not change.
// After the band is drawn, each person's smithing potential and level come from the `smithing`
// stream by the same formula as another skill, in the band's order.
import type { EngineContent, RngStream } from '../core/index.ts';
import type { Person } from './band.ts';
import { clamp, dice } from '../core/index.ts';

export const SMITHING = 'smithing';

/** Each person's smithing potential and level, in band order. The share of adult life lived is
 * worked back from their age. */
export function drawSmithing(
  rng: RngStream,
  content: EngineContent,
  band: readonly Person[],
): { level: number; potential: number }[] {
  const def = content.band;
  const learn = content.abilities.find((a) => a.id === SMITHING)!.learnAttributes;
  return band.map((p) => {
    const race = content.races.find((r) => r.id === p.race)!;
    const span = Math.max(
      1,
      Math.floor((race.lifespanYears * def.ageShare) / 100) - race.maturityYears,
    );
    const adult = Math.min(100, Math.floor(((p.age - race.maturityYears) * 100) / span));
    const aptitude = Math.round(learn.reduce((t, k) => t + p.attributes[k]!, 0) / learn.length);
    const potential = clamp(
      aptitude + def.potentialOffset + dice(rng, 2),
      def.potential[0]!,
      def.potential[1]!,
    );
    const share = def.levelBase + Math.floor((def.levelAdult * adult) / 100);
    const jitter = rng.between(def.levelJitter[0]!, def.levelJitter[1]!);
    return { level: Math.round((potential * share * jitter) / 10_000), potential };
  });
}
