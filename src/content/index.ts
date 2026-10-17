import type { Content } from '../engine/core/types.ts';
import { events } from './events.ts';
import { jobs } from './jobs.ts';
import { names } from './names.ts';
import { mapGen, tuning } from './tuning.ts';

export const defaultContent: Content = {
  tuning,
  needWords: {
    food: { low: 'hungry', critical: 'starving' },
    rest: { low: 'tired', critical: 'exhausted' },
    company: { low: 'lonely', critical: 'desolate' },
  },
  resourceWords: { food: 'food', wood: 'wood' },
  map: mapGen,
  colonistCount: 10,
  names,
  jobs,
  events,
};
