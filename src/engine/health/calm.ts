// Content with no accidents of work (P5.6), for tests of other systems over fixed seeds, whose
// claims (a week fed, a wall built) were made of a world where nobody is hurt.
import type { EngineContent } from '../core/index.ts';

export const withoutAccidents = <C extends EngineContent>(content: C): C => ({
  ...content,
  health: { ...content.health, accidents: [] },
});
