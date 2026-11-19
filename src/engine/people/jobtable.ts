// The job table (refactor proposal 7): one row per Work sheet kind (and the jobs they lead to),
// saying how it is taken up, how a minute of it goes and whether it keeps its load overnight.
// jobs.ts reads only this table, so a new kind of work is a row here, not a branch there.
import type { EntityRow } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { building, takeUpBuilding } from './build.ts';
import { burying, takeUpBurial } from './burial.ts';
import { TRADE_JOBS } from './trades.ts';
import { takeUpNursing } from './nurse.ts';
import { burning, takeUpCharcoal } from './charcoal.ts';
import { mining, takeUpMining } from './mine.ts';
import { cooking, takeUpCooking } from './cook.ts';
import { chandling, takeUpChandling } from './chandle.ts';
import { LARDER_JOBS } from './larder.ts';
import { MILL_JOBS } from './mill.ts';
import { haulMinute, takeUpHauling } from './haul.ts';
import { coldHearth, takeUpHearth } from './hearth.ts';
import { takeUpTending, tending } from './tend.ts';
import { furnishing, takeUpCarpentry } from './carpentry.ts';
import { farming, takeUpFarming } from './farm.ts';
import { fishing, takeUpFishing } from './fish.ts';
import { hunting, takeUpHunting } from './hunt.ts';
import { takeUpHerding } from './herd.ts';
import { foraging, takeUpForaging } from './forage.ts';
import { beekeeping, takeUpBeekeeping } from './beekeep.ts';
import { gatherMinute, takeUpGathering, takeUpMarked } from './gather.ts';
import { smelting, takeUpSmelting } from './smelt.ts';
import { stationing, takeUpStation } from './station.ts';
import { smithing, takeUpSmithing } from './smith.ts';

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
  mine: { takeUp: takeUpMining, work: mining },
  charcoal: { takeUp: takeUpCharcoal, work: burning, holds: true },
  smelt: { takeUp: takeUpSmelting, work: smelting, holds: true },
  smith: { takeUp: takeUpSmithing, work: smithing, holds: true },
  heal: { takeUp: takeUpNursing },
  chandle: { takeUp: takeUpChandling, work: chandling },
  beekeep: { takeUp: takeUpBeekeeping, work: beekeeping },
  ...LARDER_JOBS,
  ...MILL_JOBS,
  ...TRADE_JOBS,
};
