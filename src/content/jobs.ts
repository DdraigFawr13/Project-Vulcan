import { Feature, type GatherJobDef } from '../engine/core/types.ts';

// Gather jobs. Priority is the default labour priority until the law book sets it (milestone 2).
export const jobs: readonly GatherJobDef[] = [
  {
    id: 'forage',
    label: 'foraging',
    feature: Feature.Bush,
    resource: 'food',
    workTicks: 4,
    // Ten colonists eat about 17 meals a day; keep about two days in store.
    stockTarget: 30,
    priority: 1,
  },
  {
    id: 'chop',
    label: 'woodcutting',
    feature: Feature.Tree,
    resource: 'wood',
    workTicks: 10,
    // The hearth burns 8 wood a day.
    stockTarget: 12,
    priority: 0.8,
  },
];
