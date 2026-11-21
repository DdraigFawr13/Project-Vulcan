// What stops play (Phase 6T, V-191): each notable line's stop kind from content (`events` `stop`),
// what the player set it to (Pause, Slow or Note, defaults from `stops`), and where each jump would
// land. Words and settings only; the clock itself is pace.ts.
import { content } from '../content/index.ts';
import { clockAt, ticksPerMonth, type SimEvent } from '../engine/index.ts';
import type { JumpSpan, LandingsView, StopAct, StopSettings } from './protocol-time.ts';

const kindOf = new Map<string, string>(
  content.events.flatMap((e) => (e.stop ? [[e.id, e.stop] as const] : [])),
);
const defaults: StopSettings = Object.fromEntries(content.stops.map((s) => [s.id, s.default]));
const strength: Record<StopAct, number> = { note: 0, slow: 1, pause: 2 };

/** The settings in force: the content defaults, overridden by the player's for known kinds. */
export function stopSettings(player: StopSettings = {}): StopSettings {
  const known = Object.entries(player).filter(([k, v]) => k in defaults && v in strength);
  return { ...defaults, ...Object.fromEntries(known) };
}

/** The strongest act asked by `lines`, the notable ones of a tick (`notable` is `sim.notable`). */
export const actOf = (
  lines: readonly SimEvent[],
  notable: (e: SimEvent) => boolean,
  stops: StopSettings,
): StopAct | undefined => stopOf(lines, notable, stops)?.act;

/** The strongest act asked by `lines` and the first line that asked it, for the card that says why
 * a jump stopped early. */
export function stopOf(
  lines: readonly SimEvent[],
  notable: (e: SimEvent) => boolean,
  stops: StopSettings,
): { act: StopAct; line: SimEvent } | undefined {
  let found: { act: StopAct; line: SimEvent } | undefined;
  for (const line of lines) {
    if (!notable(line)) continue;
    const act = stops[kindOf.get(line.type) ?? ''] ?? 'note';
    if (found === undefined || strength[act] > strength[found.act]) found = { act, line };
  }
  return found;
}

/** The first tick of the next month, season or year after `tick` (00:00 on its first day). */
export function landing(tick: number, span: Exclude<JumpSpan, 'next'>): number {
  const { calendar } = content;
  const perMonth = ticksPerMonth(calendar);
  const months =
    span === 'month'
      ? 1
      : span === 'season'
        ? calendar.monthsPerYear / calendar.seasons.length
        : calendar.monthsPerYear;
  return (Math.floor(Math.floor(tick / perMonth) / months) + 1) * months * perMonth;
}

/** Where a jump of `span` from `tick` lands, in words. */
export function landingWords(tick: number, span: Exclude<JumpSpan, 'next'>): string {
  const { calendar } = content;
  const c = clockAt(landing(tick, span), calendar);
  const day = `1 ${calendar.monthNames[c.month]!}`;
  if (span === 'month') return day;
  return span === 'season' ? `${day}, ${calendar.seasons[c.season]!}` : `${day}, Year ${c.year}`;
}

export const landingsOf = (tick: number): LandingsView => ({
  month: landingWords(tick, 'month'),
  season: landingWords(tick, 'season'),
  year: landingWords(tick, 'year'),
});
