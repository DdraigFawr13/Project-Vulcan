// Draws the map, features and colonists on a 2D canvas.

import { Feature, Terrain, type Colony } from '../engine/index.ts';
import type { ColonistView } from '../platform/protocol.ts';

export const TILE = 12;

const TERRAIN_COLOUR: Record<number, string> = {
  [Terrain.Grass]: '#9fb56a',
  [Terrain.Water]: '#4f7fa8',
  [Terrain.Rock]: '#8a8378',
};
/** One colour per colonist id, distinct enough for ten founders. */
const COLONIST_COLOUR = [
  '#c0392b',
  '#2e86c1',
  '#d68910',
  '#7d3c98',
  '#17a589',
  '#cb4335',
  '#2874a6',
  '#b9770e',
  '#6c3483',
  '#148f77',
];

export interface MapImage {
  width: number;
  height: number;
  terrain: Uint8Array;
}

export interface Scene {
  map: MapImage;
  feature: Uint8Array;
  amount: Uint8Array;
  colonists: ColonistView[];
  colony: Colony;
  night: boolean;
  selected: number | null;
}

export function colonistColour(id: number): string {
  return COLONIST_COLOUR[id % COLONIST_COLOUR.length]!;
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { map } = scene;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      ctx.fillStyle = TERRAIN_COLOUR[map.terrain[i]!] ?? '#000';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      drawFeature(ctx, scene, x, y, scene.feature[i]!, scene.amount[i]!);
    }
  }
  if (scene.night) {
    ctx.fillStyle = 'rgba(10, 16, 40, 0.38)';
    ctx.fillRect(0, 0, map.width * TILE, map.height * TILE);
  }
  for (const c of scene.colonists) drawColonist(ctx, c, c.id === scene.selected);
}

function drawFeature(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  x: number,
  y: number,
  feature: number,
  amount: number,
): void {
  const cx = x * TILE + TILE / 2;
  const cy = y * TILE + TILE / 2;
  switch (feature) {
    case Feature.Tree:
      ctx.fillStyle = '#3d6b35';
      ctx.beginPath();
      ctx.arc(cx, cy, TILE * 0.45, 0, Math.PI * 2);
      ctx.fill();
      return;
    case Feature.Bush:
      ctx.fillStyle = '#5f8a3e';
      ctx.beginPath();
      ctx.arc(cx, cy, TILE * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8e1f4f';
      for (let k = 0; k < amount; k += 1) {
        ctx.fillRect(x * TILE + 3 + k * 3, y * TILE + 5, 2, 2);
      }
      return;
    case Feature.Hearth: {
      const lit = scene.colony.hearthFuel > 0;
      ctx.fillStyle = '#5a5047';
      ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
      if (lit) {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(cx, cy, TILE * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case Feature.Store:
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
      ctx.strokeStyle = '#4d3218';
      ctx.strokeRect(x * TILE + 1.5, y * TILE + 1.5, TILE - 3, TILE - 3);
      return;
  }
}

function drawColonist(ctx: CanvasRenderingContext2D, c: ColonistView, selected: boolean): void {
  const cx = c.x * TILE + TILE / 2;
  const cy = c.y * TILE + TILE / 2;
  if (selected) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.75, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = colonistColour(c.id);
  ctx.beginPath();
  ctx.arc(cx, cy, TILE * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${TILE - 4}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.name[0] ?? '?', cx, cy + 0.5);
  ctx.lineWidth = 1;
}
