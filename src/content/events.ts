import type { EventTypeDef } from '../engine/core/types.ts';

// Every event type the engine may emit. The engine refuses types missing here.
// Slots: {actor0}, {actor1}, and any data key, e.g. {amount}.
export const events: Readonly<Record<string, EventTypeDef>> = {
  'colony.founded': { importance: 3, template: '{count} settlers made camp by the hearth.' },
  'need.low': { importance: 1, template: '{actor0} is {feeling}.' },
  'need.critical': { importance: 2, template: '{actor0} is {feeling}.' },
  'job.done': { importance: 1, template: '{actor0} brought {resource} to the store.' },
  ate: { importance: 1, template: '{actor0} ate a meal from the store.' },
  'ate.at.source': {
    importance: 2,
    template: '{actor0} found the store empty and ate berries straight from the bush.',
  },
  slept: { importance: 1, template: '{actor0} lay down to sleep by the hearth.' },
  'slept.cold': { importance: 1, template: '{actor0} lay down to sleep in the cold.' },
  collapsed: { importance: 2, template: '{actor0} collapsed from exhaustion.' },
  woke: { importance: 1, template: '{actor0} woke rested.' },
  'woke.tired': { importance: 1, template: '{actor0} woke, still tired.' },
  'woke.hungry': { importance: 2, template: '{actor0} woke, too hungry to sleep.' },
  chatted: { importance: 1, template: '{actor0} and {actor1} talked a while.' },
  'stock.low': {
    importance: 2,
    template: 'The store is running low on {resource}: {amount} left.',
  },
  'stock.recovered': { importance: 1, template: 'The store has enough {resource} again.' },
  'hearth.out': { importance: 2, template: 'The hearth went out.' },
  'hearth.stoked': { importance: 1, template: '{actor0} fed the hearth.' },
  'hearth.relit': { importance: 2, template: '{actor0} relit the hearth.' },
};
