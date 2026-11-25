---
name: art-sheet
description: Make or extend a Vulcan sprite sheet - script-drawn stand-ins first through the art-maker agent, PixelLab or Gemini-based final art only through the PixelLab art pass with Morgan's approved credit cap - then check it beside its neighbours, pack it, record provenance and show Morgan. Use when a milestone or slice needs new frames (a building, item, animal, tile or UI part), when content names art no sheet has, or when an art pass replaces stand-ins. Not for UI layout (mockup-round) or for changing the look itself (ART_DIRECTION, ui-style).
---

# Art sheet

Every frame the game draws has a name, and content refers to art only by that name. A slice that adds a building, item or creature needs its frames packed before the browser can boot (LESSONS 2026-10-26: a vein named `vein.salt` that no sheet had stopped the page on its error screen, with every unit check green).

## 1. List the frames

- Read the slice's art row in `docs/ART.md` (add one in the same PR if the slice has none) and the content entries that name art.
- Write the full frame list with the naming pattern `<category>.<name>[.<variant>][.<facing>][.<frame>]`, for example `furn.well`, `animal.boar.e.1`, `build.wall-daub.5`. Copy names from content, never from memory (WS-06).
- Note each frame's size (32 px a tile; buildings and props as ART.md says) and which sheet it joins (`tiles-base`, `tiles-world`, `sprites-nature`, `sprites-people`, `sprites-wild`, `items`, `buildings`, `ui`).

## 2. Script-drawn stand-ins first

- Brief the `art-maker` agent, or write the draw script yourself for a few frames. One script per group: `tools/draw-<group>.mjs`, colours only from `art/palette.gpl`, a 1 px ink outline like its neighbours, top-down at the walls' three-quarter angle, light from the top left. It writes `art/src/<sheet>/<name>.png`.
- Pack: `node tools/pack-sheet.mjs <sheet>` writes `public/art/<sheet>.png` and `.json`. Never hand-edit packed output.
- A stand-in ships with the slice. Final art never blocks a build.

## 3. Final art goes through the art pass

- Final art (V-034) is PixelLab's, redrawn from Morgan's Gemini designs where one exists (`docs/ART_DIRECTION.md`, "Blending Morgan's Gemini pack"). Use the `pixellab-art-pass` skill when it is listed; otherwise follow ART_DIRECTION's "PixelLab recipe" table for endpoints, sizes and the style suffix.
- PixelLab spends paid generations. Before any batch: count the generations it needs from the recipe's cost column, say how many are left this month, and get Morgan's approval for that number (SAFE-01, V-034). Batch art at the start of the month where the work allows.
- Final frames go in `art/final/<sheet>/<name>.png` with the same name and size as their `art/src` twin. The packer prefers them, so draw scripts can keep running. A final frame with no `art/src` twin is an error, except the cases ART.md lists (whole villagers, their coats, tree crowns).
- Keep each batch's prompts, generation log and raw output under `/mnt/project-files/vulcan/<art-pass>/`, not in git.

## 4. Check it beside its neighbours

- Make a contact sheet: the new frames at 1x and 3x, next to two or three frames already in the game that they stand beside (a new wall next to the old walls, a new animal beside the wolf). Check: it reads at 32 px, palette only, same outline and light, same scale as its neighbours, names exactly as content uses them (VER-06).
- Run the game (`npm run build` and the `run` skill) and screenshot the frames in place at 390 px: on grass, on a floor, at night if it is outdoors.
- Run `npm run test:browser` after any content entry that names art, since only the browser loads the sheets. If the content names a new kind of art, add it to the frame check in `src/content/content.test.ts` (it checks vein frames against the packed sheet today).

## 5. Record and show

- Add one line per group to `art/PROVENANCE.md`: path, how it was made (script name, or PixelLab endpoint and batch, or Morgan's Gemini design), date, and the licence of any input (SAFE-05). Morgan's Gemini pack is Morgan's own art (cleared 2026-11-20).
- Publish the contact sheet and the in-game screenshot as one Artifact page that reads on a phone, and keep the PNGs under `/mnt/project-files/vulcan/<milestone>/` (VR-19). If Morgan must choose between versions, make it a form from the `planning-interview` template, one `single` question per choice with a notes box.
- The packed sheet, the draw script, the provenance line and any `docs/ART.md` row land in the slice's PR. Packed art doesn't count toward the 1,200-line split (VR-58).
