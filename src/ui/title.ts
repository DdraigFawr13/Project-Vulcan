// The title screen (P2.1, taste board pick 3A): over the last valley, dimmed, Continue names the
// valley and the date and is one tap; New game opens the region map. With no save, or one an older
// version made, only New game shows, over a plain dark screen.
import { el } from './dom.ts';

/** Why Continue is missing when the newest save is refused. */
export const OLD_SAVE =
  'Your last game was saved by an older version of the game, so it cannot be continued.';

export interface TitleActions {
  continue(): void;
  newGame(): void;
}

export class Title {
  private readonly root = el('div', { class: 'title', 'data-testid': 'title' });
  private readonly go = el('button', { type: 'button', class: 'big primary', disabled: '' });
  private readonly fresh = el('button', { type: 'button', class: 'big' }, 'New game');
  private readonly note = el('p', { class: 'tnote' });

  constructor(parent: HTMLElement, actions: TitleActions) {
    this.go.append('Continue', el('small', {}, 'Opening your last game'));
    this.go.addEventListener('click', () => actions.continue());
    this.fresh.addEventListener('click', () => actions.newGame());
    this.root.append(
      el('div', { class: 'logo' }, 'Ledger'),
      el('div', { class: 'wt' }, 'working title'),
      this.go,
      this.fresh,
      this.note,
    );
    parent.append(this.root);
  }

  /** A save is loading behind the title: Continue shows, waiting for it. */
  loading(): void {
    this.root.classList.remove('plain');
    this.go.hidden = false;
    this.fresh.classList.remove('primary');
  }

  /** The save is in: Continue names its valley and date. */
  ready(place: string, date: string): void {
    this.go.disabled = false;
    this.go.replaceChildren('Continue', el('small', {}, `${place} · ${date}`));
  }

  /** Nothing to continue: New game only; `reason` says why a save could not be. */
  empty(reason = ''): void {
    this.root.classList.add('plain');
    this.go.hidden = true;
    this.fresh.classList.add('primary');
    this.note.textContent = reason;
  }

  hide(): void {
    this.root.remove();
  }
}
