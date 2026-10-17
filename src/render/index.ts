import Phaser from 'phaser';

const TILE = 32;
const MAP_TILES = 150;

class EmptyValley extends Phaser.Scene {
  constructor() {
    super('empty-valley');
  }

  create(): void {
    // P0.1 placeholder: the map size in muted ground colour until P0.4 draws real tiles.
    const side = TILE * MAP_TILES;
    this.add.rectangle(side / 2, side / 2, side, side, 0x5b5a3f);
    this.cameras.main.setBounds(0, 0, side, side).centerOn(side / 2, side / 2);
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Ledger: the valley is empty', {
        color: '#e9e2d4',
        fontFamily: 'sans-serif',
        fontSize: '18px',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }
}

export function startRenderer(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1c1a17',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    scene: [EmptyValley],
  });
}
