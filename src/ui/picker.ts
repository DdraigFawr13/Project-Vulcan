// The site picker (P1.5): before a world begins, the region of a plain seed with its named
// neighbours and the three valleys on offer, each with the real map its seed makes. Tapping a
// number or a card chooses; "Settle here" begins that valley. Shows what the worker sends.
import { content } from '../content/index.ts';
import type { FromWorker, ValleyPreview } from '../worker/index.ts';
import { el } from './dom.ts';
import { raceLegend, regionMap, siteWords } from './regionmap.ts';

type Offer = Extract<FromWorker, { type: 'picker' }>;
type Rgb = readonly [number, number, number];

export interface PickerActions {
  settle(site: number): void;
  /** Rolls another region from a seed the player typed or drew. */
  roll(seed: string): void;
}

/** Ground colours for the thumbnails, by terrain kind id; other ground shows its biome. */
const KIND: Readonly<Record<string, Rgb>> = {
  'rock-wall': [104, 98, 96],
  slate: [62, 68, 80],
  limestone: [176, 170, 152],
  sandstone: [150, 98, 70],
  gravel: [140, 134, 124],
  sand: [214, 196, 140],
  marsh: [96, 112, 74],
  'water-shallow': [86, 140, 190],
  'water-deep': [38, 78, 140],
  spring: [170, 230, 255],
};
const BIOME: Readonly<Record<string, Rgb>> = {
  tundra: [170, 176, 166],
  taiga: [74, 98, 78],
  'temperate-forest': [78, 108, 64],
  grassland: [128, 146, 86],
  steppe: [168, 156, 104],
  desert: [196, 176, 126],
  swamp: [88, 96, 70],
  alpine: [206, 206, 206],
};

function thumbnail(v: ValleyPreview): HTMLCanvasElement {
  const { width, height, tiles, biomes, trees, snow } = v.thumb;
  const canvas = el('canvas', { class: 'vthumb', 'aria-hidden': 'true' });
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  for (let i = 0; i < width * height; i += 1) {
    const kind = content.terrain.kinds[tiles[i]!]!.id;
    const biome = content.biomes.biomes[biomes[i]!]!.id;
    let c = snow[i] ? ([225, 228, 232] as Rgb) : (KIND[kind] ?? BIOME[biome] ?? [120, 120, 100]);
    if (trees[i]) c = c.map((x) => x * 0.6) as unknown as Rgb;
    image.data.set([c[0], c[1], c[2], 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export class Picker {
  private readonly root = el('div', { class: 'picker', 'data-testid': 'picker', hidden: '' });
  private readonly actions: PickerActions;
  private offer: Offer | undefined;
  private selected = 1;
  private readonly note = el('div', { class: 'note', 'aria-live': 'polite' });

  constructor(parent: HTMLElement, actions: PickerActions) {
    this.actions = actions;
    parent.append(this.root);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(offer: Offer): void {
    this.offer = offer;
    this.selected = 1;
    this.note.textContent = 'Tap a settlement to see who lives there.';
    this.draw();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private select(id: number): void {
    this.selected = id;
    this.draw();
    this.root
      .querySelector(`[data-card="${id}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  private draw(): void {
    const offer = this.offer!;
    const head = el('div', { class: 'top' });
    const title = el('div');
    title.append(
      el('b', {}, 'Choose where to settle'),
      el('small', {}, `Seed ${offer.seed} · three valleys`),
    );
    const fresh = el('button', { type: 'button' }, 'New seed');
    fresh.addEventListener('click', () =>
      this.actions.roll(Math.random().toString(36).slice(2, 8)),
    );
    head.append(title, fresh);
    const map = regionMap(offer.region, {
      selected: this.selected,
      onValley: (id) => this.select(id),
      onSite: (site) => (this.note.textContent = siteWords(site)),
    });
    const cards = el('div', { class: 'cards' });
    for (const v of offer.region.valleys) cards.append(this.card(v.id));
    const foot = el('form', { class: 'foot' });
    const input = el('input', {
      id: 'picker-seed',
      'aria-label': 'Seed',
      value: offer.seed,
      autocomplete: 'off',
    });
    foot.append(input, el('button', { type: 'submit' }, 'Roll'));
    foot.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value.trim()) this.actions.roll(input.value.trim());
    });
    const side = el('div', { class: 'side' });
    side.append(cards, foot);
    const main = el('div', { class: 'main' });
    main.append(map, raceLegend(), this.note);
    const body = el('div', { class: 'body' });
    body.append(main, side);
    this.root.replaceChildren(head, body);
  }

  private card(id: number): HTMLElement {
    const offer = this.offer!;
    const v = offer.region.valleys[id - 1]!;
    const p = offer.valleys[id - 1]!;
    const on = id === this.selected;
    const climate =
      content.terrain.generator.climates.find((c) => c.id === v.climate)?.name ?? v.climate;
    const card = el('article', { class: `vcard${on ? ' on' : ''}`, 'data-card': String(id) });
    const head = el('div', { class: 'vhead' });
    head.append(el('span', { class: 'badge' }, String(id)), el('b', {}, v.name));
    const near = el('ul');
    for (const n of v.near)
      near.append(el('li', {}, `${n.name}, ${n.culture} ${n.kind}, ${n.days} days ${n.dir}`));
    const button = el(
      'button',
      { type: 'button', class: on ? 'settle' : 'ghost' },
      on ? 'Settle here' : 'Look',
    );
    button.addEventListener('click', () => (on ? this.actions.settle(id) : this.select(id)));
    card.append(
      thumbnail(p),
      head,
      el('div', { class: 'mut' }, `${v.range ? `Under ${v.range} · ` : ''}${climate}`),
      el(
        'div',
        { class: 'mut' },
        `${p.temperature} °C · ${p.rainfall} mm${v.river ? ` · ${v.river} nearby` : ''}`,
      ),
      el('div', {}, p.biomes.join(', ')),
      el(
        'div',
        { class: 'mut' },
        `${p.lakes} lakes · ${p.springs} springs${p.aura.length ? ` · aura: ${p.aura.join(', ')}` : ''}`,
      ),
      near,
      button,
    );
    return card;
  }
}
