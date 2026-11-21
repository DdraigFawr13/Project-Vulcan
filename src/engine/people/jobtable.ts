// The job table (refactor proposal 7): one row per Work sheet kind (and the jobs they lead to),
// saying how it is taken up, how a minute of it goes and whether it keeps its load overnight.
// jobs.ts reads only this table, so a new kind of work is a row here, not a branch there.
import type { EntityRow } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { beekeeping, brewing, building, burning, chandling, coldHearth } from '../crafts/index.ts';
import { cooking, takeUpBrewing } from '../crafts/index.ts';
import { furnishing, LARDER_JOBS, MILL_JOBS, smelting, smithing } from '../crafts/index.ts';
import { stationing, takeUpBeekeeping, takeUpBuilding, takeUpCarpentry } from '../crafts/index.ts';
import { takeUpChandling, takeUpCharcoal, takeUpCooking, takeUpHearth } from '../crafts/index.ts';
import { takeUpSmelting, takeUpSmithing, takeUpStation, takeUpTending } from '../crafts/index.ts';
import { takeUpThatching, tending, thatching, TRADE_JOBS } from '../crafts/index.ts';
import { limeBurning, masonry, takeUpLime, takeUpMasonry } from '../crafts/index.ts';
import { burying, takeUpBurial, takeUpNursing } from '../care/index.ts';
import { farming, foraging, gatherMinute, mining, takeUpFarming } from '../land/index.ts';
import { takeUpForaging, takeUpGathering, takeUpMarked, takeUpMining } from '../land/index.ts';
import { haulMinute, knapping, takeUpHauling, takeUpKnapping } from '../band/index.ts';
import { helping } from '../teach/index.ts';
import { fishing, takeUpFishing, hunting, takeUpHunting, takeUpHerding } from '../herding/index.ts';

type Step = (ctx: SystemContext, p: EntityRow) => boolean;

/** One kind of work. `takeUp` starts it (false when there is none to do); `work` is a minute of
 * it in hand, run in the work hours by the light it needs, or at any hour and light when
 * `always`; `atTarget` is a minute at the tile or item it chose, once loads are delivered and
 * only by daylight; `holds` keeps what was fetched when the working day ends. */
export interface JobRow {
  takeUp?: Step;
  work?: Step;
  always?: true;
  atTarget?: Step;
  holds?: true;
}

export const JOBS: Readonly<Record<string, JobRow>> = {
  fell: { takeUp: (ctx, p) => takeUpGathering(ctx, p, 'fell'), atTarget: gatherMinute },
  quarry: { takeUp: (ctx, p) => takeUpGathering(ctx, p, 'quarry'), atTarget: gatherMinute },
  haul: { takeUp: takeUpHauling, atTarget: haulMinute },
  forage: { takeUp: takeUpForaging, atTarget: foraging },
  hunt: { takeUp: takeUpHunting, work: hunting },
  fish: { takeUp: takeUpFishing, work: fishing },
  farm: { takeUp: takeUpFarming, work: farming },
  herd: { takeUp: takeUpHerding },
  // The builder's row: a burial first (P5.6), a cold room's hearth, clearing a house's site, then
  // hearths, workstations and plans.
  build: {
    takeUp: (ctx, p) =>
      takeUpBurial(ctx, p) ||
      (coldHearth(ctx) && takeUpHearth(ctx, p)) ||
      takeUpMarked(ctx, p, true) ||
      takeUpHearth(ctx, p) ||
      takeUpStation(ctx, p) ||
      takeUpBuilding(ctx, p),
    work: building,
  },
  hearth: { work: furnishing },
  station: { work: stationing, holds: true },
  bury: { work: burying, always: true },
  tend: { takeUp: takeUpTending, work: tending, always: true },
  cook: { takeUp: takeUpCooking, work: cooking },
  carpentry: { takeUp: takeUpCarpentry, work: furnishing },
  thatch: { takeUp: takeUpThatching, work: thatching },
  mason: { takeUp: takeUpMasonry, work: masonry },
  limeburn: { takeUp: takeUpLime, work: limeBurning },
  mine: { takeUp: takeUpMining, work: mining },
  charcoal: { takeUp: takeUpCharcoal, work: burning, holds: true },
  smelt: { takeUp: takeUpSmelting, work: smelting, holds: true },
  smith: { takeUp: takeUpSmithing, work: smithing, holds: true },
  'craft-tools': { takeUp: takeUpKnapping, work: knapping, holds: true },
  heal: { takeUp: takeUpNursing },
  chandle: { takeUp: takeUpChandling, work: chandling },
  beekeep: { takeUp: takeUpBeekeeping, work: beekeeping },
  brew: { takeUp: takeUpBrewing, work: brewing, holds: true },
  // 6B Bundle 6 (V-189): an apprentice working beside their master (teach `help.ts`).
  help: { work: helping },
  ...LARDER_JOBS,
  ...MILL_JOBS,
  ...TRADE_JOBS,
};
