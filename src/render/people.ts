// The people on the map (P2.1): each a body from the `sprites-people` sheet with their clothes and
// hair laid over it, tinted to the colours drawn for them. They stand where their rows say; facing
// south, standing, until P2.3 gives them paths.
import Phaser from 'phaser';
import type { PersonView } from '../worker/index.ts';

export const PEOPLE = 'sprites-people';
const TILE = 32;

const colour = (hex: string): number => Number.parseInt(hex.slice(1), 16);

export class PeopleSprites {
  private people: readonly PersonView[] = [];
  private shown: Phaser.GameObjects.Container[] = [];
  private z = 0;
  private live = false;

  private readonly scene: Phaser.Scene;

  constructor(game: Phaser.Game, scene: Phaser.Scene) {
    this.scene = scene;
    // The scene has no events until the game boots; ones set before it has made its layers are
    // drawn once it has.
    game.events.once(Phaser.Core.Events.READY, () =>
      scene.events.once(Phaser.Scenes.Events.CREATE, () => {
        this.live = true;
        this.draw();
      }),
    );
  }

  set(people: readonly PersonView[]): void {
    this.people = people;
    this.draw();
  }

  setLevel(z: number): void {
    this.z = z;
    this.draw();
  }

  /** The person standing on a tile of the level on screen, if any. */
  at(x: number, y: number): PersonView | undefined {
    return this.people.find((p) => p.x === x && p.y === y && p.z === this.z);
  }

  private draw(): void {
    if (!this.live || !this.scene.textures.exists(PEOPLE)) return;
    for (const c of this.shown) c.destroy();
    this.shown = this.people
      .filter((p) => p.z === this.z)
      .map((p) => {
        const facing = 's';
        const parts = [this.scene.add.image(0, 0, PEOPLE, `person.${p.race}.${facing}.0`)];
        parts.push(
          this.scene.add
            .image(0, 0, PEOPLE, `clothes.${p.race}.${facing}.0`)
            .setTint(colour(p.look.clothes)),
        );
        if (p.look.hair)
          parts.push(
            this.scene.add
              .image(0, 0, PEOPLE, `hair.${p.look.hair}.${p.race}.${facing}`)
              .setTint(colour(p.look.hairColour)),
          );
        for (const part of parts) part.setOrigin(0);
        // Over the features and the aura glow, under the selection marks.
        return this.scene.add.container(p.x * TILE, p.y * TILE, parts).setDepth(8);
      });
  }
}
