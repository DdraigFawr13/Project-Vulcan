---
name: map-check
description: Run the map generator's statistics over the seed list and render its layers after a world or map change. Use after each Phase 1 milestone or any edit under src/engine/world or the terrain, water, vein and weather content. Adapted from the Story Generator's worldgen-check.
---

# Map check

1. Run the map stats command from `AGENTS.md` over the seed list and copy its table and mean line.
2. Render the surface and each underground level for two seeds into `tmp/maps/` (not committed) and make one contact sheet.
3. Report: any seed failing a Phase 1 done-when (start area land, wood, stone, water, copper and tin reachable), generation time over its budget, a biome above about 35% of land, and any vein missing from most seeds.
4. Publish the contact sheet as an artifact when it goes to Morgan. Do not edit files.
