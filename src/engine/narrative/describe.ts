// One-line description of what a colonist is doing, for the inspector.

import type { Colonist, Content } from '../core/types.ts';

export function describeTask(
  c: Colonist,
  colonists: readonly Pick<Colonist, 'id' | 'name'>[],
  content: Content,
): string {
  const task = c.task;
  switch (task.kind) {
    case 'idle':
      return 'idle';
    case 'wander':
      return 'wandering';
    case 'gather': {
      const job = content.jobs.find((entry) => entry.id === task.job);
      return task.phase === 'go' ? `walking out for ${job?.label}` : `${job?.label}`;
    }
    case 'deliver':
      return `carrying ${c.carrying ? content.resourceWords[c.carrying.resource] : 'goods'} to the store`;
    case 'eat':
      return task.phase === 'go'
        ? task.fromBush
          ? 'heading to a bush to eat'
          : 'going to the store to eat'
        : 'eating';
    case 'sleep':
      return task.phase === 'go' ? 'going to bed' : 'asleep';
    case 'stoke':
      return task.phase === 'fetch'
        ? 'fetching wood for the hearth'
        : 'carrying wood to the hearth';
    case 'chat': {
      const partner = colonists.find((other) => other.id === task.partner);
      return `talking with ${partner?.name ?? 'someone'}`;
    }
  }
}
