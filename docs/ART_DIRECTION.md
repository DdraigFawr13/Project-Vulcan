# Final art direction

Morgan chose this look on 2026-11-18 in two PixelLab rounds (V-166): [round 1, four directions](https://claude.ai/artifact/QsaKukr674YPimLgTHtwGL) and [round 2, the Pro test sheet](https://claude.ai/artifact/KMoKyZj4kThJWWxxBUHSXu). The final art is made in Phase 10 (V-034). Until then, any new placeholder sprite follows the rules below where a script can, so the swap stays a file swap (ART.md).

## The look

- **Hearthlight by day:** a muted earthy valley of olive greens, warm browns and greys, soft light from the top left, and a dark selective outline (dark only where a shape meets the ground). It is drawn at the grain of the oak and iron controls (UI_STYLE.md).
- **Ember and Frost at night and in winter:** cold slate blue and grey, with ember orange as the only warm colour, coming from fires, lit windows and the forge.
- **One shared palette:** every asset is drawn on, or cleaned to, `art/palette.gpl`. Grass goes one step more muted than PixelLab Pro's first pick, toward olive.
- **Hand-crafted pixel art:** careful clusters and readable silhouettes at 32 px, never a downscaled painting.

## Shapes

- Tiles stay 32 px (V-003). Colonists are one tile tall. The giant stands on one tile, but its art is about 40 px tall and overhangs the tile above.
- Each race must be readable from its silhouette alone (dwarf width and beard, orc bulk, halfling curls, goblin ears), helped by hair and clothes tints and by the tool or load in hand, which shows the job.
- Buildings are seen straight down with no roof and short raised walls that show their south face. Interiors always stay visible, because the player reads rooms without giving orders (V-041). PixelLab draws a whole building, furniture included; for the game, walls, floors, doors and furniture are cut into separate pieces under the existing art names.
- Painted portraits (64 px, lit by firelight) go in the person sheet. The strip under the clock keeps small face crops.

## Light and seasons

- At night the map darkens by about two-thirds away from a light. Fires, the forge and lit hearths cast warm pools, drawn by code.
- The target is PixelLab's winter repaint: snow settles on ground, trees and wall tops. That needs a winter version of each ground tile and outdoor sprite, about one generation per piece in Phase 10. Ground and trees also recolour by season.

## PixelLab recipe (measured 2026-11-18, Tier 1 plan, 2,000 generations a month)

| Asset | Endpoint and settings | Cost |
| --- | --- | --- |
| Colonist, south facing | `generate-image-v2`, 32 x 32, `target_palette` = `art/palette.gpl`, `style_options.color_palette` false, a chosen sprite as `style_image` | 10 for 64 variations |
| Eight facings | `create-character-v3` with the 32 px pick as `reference_image`, `n_directions` 8 | 1 |
| Ground edge set | `create-tileset`, `mode` pro, 32 px, chained to the grass terrain through `*_base_tile_id` | 15 |
| Building plan | `create-image-pro-flash`, 128 x 96, "orthographic floor plan seen straight down, no roof, short raised walls showing their south faces" | 6 |
| Prop | `create-image-pro-flash`, 32 to 64 px | 5 |
| Portrait | `generate-image-v2`, 64 x 64, the sprite as a reference image | 10 for 16 variations |
| Winter or night repaint | `edit-image-pro-flash`, up to 208 px, "keep every object in place" | 6 |

The style suffix used for every prompt was "muted earthy palette, soft warm light from the top left, selective dark outline, hand-crafted artistic pixel art with careful clusters and a readable silhouette". Avoid PixelLab's building kit (`create-tiles-pro`, `tile_feature` building), which draws chunky walls two tiles tall. Scripts, prompts, the generation log and the raw output are in the project files under `vulcan/art-round1/` and `vulcan/art-round2/`. Each batch's cost is approved before it runs (V-034).
