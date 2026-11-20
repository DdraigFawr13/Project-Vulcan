// Shape of Vulcan's stops file (src/content/data/stops.json, Phase 6T, V-191): the kinds of
// notable line a player can set to Pause, Slow or Note, each with its words and its default. Every
// notable event in events.json names one (`stop`, checked by validate-time.ts).
import { list, obj, oneOf } from './schema';
import { id, text } from './schema-fields';

export const TIME_SCHEMAS = {
  stops: list(obj({ id, name: text, hint: text, default: oneOf('pause', 'slow', 'note') })),
};
