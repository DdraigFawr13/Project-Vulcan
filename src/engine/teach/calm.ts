// Content with no masters (6B Bundle 6), for tests of other systems over fixed seeds whose claims
// (a home built in 20 days, a week's mood in a barracks) were made of a world where nobody
// stopped their own work to stand beside a master. Like health's `withoutAccidents`.
import type { EngineContent } from '../core/index.ts';

const NEVER = 99;

export const withoutApprentices = <C extends EngineContent>(content: C): C => ({
  ...content,
  teach: { ...content.teach, master: NEVER },
});
