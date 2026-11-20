// The inn system (6B Bundle 5, P6.12, V-188): the tavern's name and keeper, who goes of an
// evening, the innkeeper's pouring, brawls and hangovers. Hourly, on its own dice (`inn`). The
// tavern is sited and furnished by build (tavern.ts), brewed for by crafts (brew.ts), and walked
// to in free time by people (mind.ts).
import type { System } from '../sim/index.ts';
import { chooseEvenings, pour } from './evening.ts';
import { chooseKeeper, nameTavern } from './keeper.ts';
import { brawls, hangovers } from './rowdy.ts';
import { INN_TABLES } from './tables.ts';

export const innSystem: System = {
  id: 'inn',
  every: 'hour',
  emits: [
    'tavern.named',
    'tavern.keeper',
    'tavern.brawled',
    'tavern.tookUp',
    'tavern.brewed',
    'tavern.noGrain',
  ],
  stream: 'inn',
  tables: INN_TABLES,
  run(ctx) {
    nameTavern(ctx);
    chooseKeeper(ctx);
    hangovers(ctx);
    chooseEvenings(ctx);
    brawls(ctx, pour(ctx));
  },
};
