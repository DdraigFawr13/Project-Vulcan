// The wire shapes of the lord on screen (6C Slice 4, V-237), split from protocol.ts: who he is and
// his favour for the Laws sheet, the tithe block for Stock, the reeve on the map and his page, and
// the lord and regards for the Region sheet. Every word is the worker's (GAME-02).
import type { LedgerLine } from './protocol.ts';

/** The Lord law's block on the Laws sheet, once the lord is named. */
export interface LordView {
  /** "The valley is held by Warlord Ogrgul of the Horde of Ashaglug, quick to ... His reeve ...". */
  who: string;
  /** The `lord.named` line, for "why?". */
  whoWhy: number;
  /** 0 to 100. */
  favour: number;
  /** The ladder's steps, from content: the number each is taken at. */
  steps: number[];
  /** What each step does, in one italic line, and how long a cause counts. */
  ladder: string;
  /** Each cause still counting, newest first: its worth, words and line. */
  causes: { by: number; text: string; why: number }[];
}

/** The Stock sheet's tithe block, once the lord is named. */
export interface TitheView {
  lord: string;
  /** His last take in words, and its line ("why?"); `why` 0 before his first. */
  took: string;
  why: number;
  /** What is owed from now. */
  owed: string;
  /** What lies in the barn for him, and what is set apart there for asks. */
  barn: string;
  apart: string;
  /** Who may take from the barn. */
  note: string;
}

/** The reeve on the map while he is in the valley: where he stands and the lord's people. */
export interface ReeveView {
  x: number;
  y: number;
  z: number;
  race: string;
}

/** The reeve's page (as a stranger's, view only): who, rows and his lines this visit. */
export interface ReevePage {
  title: string;
  who: string;
  rows: { name: string; text: string; why?: number }[];
  lines: LedgerLine[];
}

/** The settled valley's card on the Region sheet and each village's regard for the colony. */
export interface RegionLordView {
  text: string;
  why: number;
}
export interface RegardView {
  place: string;
  regard: number;
  text: string;
  why: number;
}

/** What the Region sheet adds: the lord once named, and each village's regard. */
export interface RegionDetail {
  lord?: RegionLordView;
  regard?: RegardView[];
}
