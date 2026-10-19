// The game's keys: Escape closes a sheet, space pauses and resumes, 1 to 3 set the speed, + and −
// zoom, > and < change level. Ignored while the title or arrival screen covers the game, while
// typing in a field, and with the browser's own modifier shortcuts.
import type { Speed } from '../worker/index.ts';

export interface KeyActions {
  close(): void;
  pause(): void;
  speed(speed: Speed): void;
  zoom(direction: 1 | -1): void;
  level(direction: 1 | -1): void;
}

export function gameKey(e: KeyboardEvent, hudRoot: HTMLElement, act: KeyActions): void {
  if (hudRoot.classList.contains('covered')) return; // the title or arrival screen is up
  // Leave the browser's own shortcuts (zoom, tab switching) alone.
  if (e.ctrlKey || e.metaKey || e.altKey || (e.repeat && e.key === ' ')) return;
  // Typing a seed in the save panel is not a game key.
  if ((e.target as HTMLElement).closest?.('input')) return;
  if (e.key === 'Escape') act.close();
  else if (e.key === ' ') act.pause();
  else if (e.key === '1' || e.key === '2' || e.key === '3') act.speed(Number(e.key) as Speed);
  else if (e.key === '+' || e.key === '=') act.zoom(1);
  else if (e.key === '-' || e.key === '_') act.zoom(-1);
  else if (e.key === '>' || e.key === 'PageDown') act.level(1);
  else if (e.key === '<' || e.key === 'PageUp') act.level(-1);
  else return;
  e.preventDefault();
}
