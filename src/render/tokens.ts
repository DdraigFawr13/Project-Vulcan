// The page's style tokens (docs/UI_STYLE.md), read from CSS so the canvas matches the panels.
import Phaser from 'phaser';

/** A CSS custom property's value, or `fallback` before the stylesheet has loaded. */
export const cssToken = (name: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** A colour token as a Phaser colour number. */
export const tokenColour = (name: string, fallback: string): number =>
  Phaser.Display.Color.HexStringToColor(cssToken(name, fallback)).color;
