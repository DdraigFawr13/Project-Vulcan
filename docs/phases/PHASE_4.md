# Phase 4: Mining, smithy, food and a first law (first playable)

Goal: the first playable loop, from bronze to iron, food from fields, and colonists who weigh a law (V-022, V-023). Entry: Phase 3 done and live (2026-10-19). Plan source: the project file `vulcan/plan/phases/PHASE_4.md`. Design workshop: https://claude.ai/artifact/HtG6DgVYV11UNZSzWvroNz; taste board: https://claude.ai/artifact/D2YH7a9rHqcZ4hV3pAtdAj (decisions V-085 to V-096). Control stays indirect (V-041): the player sets ingot and seed stock, Work and Build rows, and the law; colonists choose the vein, the shaft, the field, the crop and who uses which tool.

## Status

- [x] Spec approved by Morgan, 2026-10-19 (PR #53)
- [x] Bundle 1, food and winter: P4.7, seed grain, harvest home, cloaks, quiet winter
- [x] Bundle 2, mining: P4.1
- [x] Bundle 3, metal: P4.2, P4.3, P4.4, P4.6, craft firsts
- [x] Bundle 4, people: P4.8 (mock-up https://claude.ai/artifact/Xcur1yF6RpqqgRidtShQta)
- [ ] P4.9 balance pass, then the phase review

P4.5 (waterwheel) moved to P5.11 beside the mill; the smithy uses hand bellows (V-085).

Taste board picks (binding every Phase 4 mock-up): unknown ground below is black and veins glint through it; ore shows on the surface as a coloured stain on the ground (green copper, rust iron, grey tin), named in words on the tile sheet; fields are furrows shaped to the good soil with no edge; a law's page lists every answer with its reason, refusals first. Colonists are drawn a quarter larger, a human filling the tile with the head allowed over the tile above (V-095).

## Design questions (VR-62)

- **Metal chain (V-086).** Smelting owns nothing but the work in hand: ore and charcoal become an ingot of that ore's metal; alloying mixes ingots (copper and tin make bronze) as a content recipe. Reads the ingot Stock plates (copper, tin, iron, bronze). Gives ingots and a line per batch citing the plate it fills. Pull chain: a plate under its level makes the smelter or alloyer want inputs, and miners and burners work to fill that want, each line citing the want. Reuses Stock plates and Work rows. Fails: no charcoal or ore leaves the want open with an alert naming the missing input. Test: with only the bronze plate raised, copper and tin are both mined and smelted, and bronze is mixed from their ingots.
- **Mining and fog (P4.1).** The map owns which underground tiles are known (V-030); every ore vein marks the surface above it with a stain of its metal (copper and tin lie on level -2, iron on -3, P1.3). Miners read wants and known veins; a want no open vein can feed sites a shaft as a plan by the matching stain, with a reason line and one send-back (V-087). Gives ore, rubble (stone) and reveal lines when a cave or water opens. Fails: no reachable vein means an alert naming the metal. Test: a raised iron plate gets iron ore to the store with no command to a tile or person.
- **Tools (V-088).** A tool is an item with maker, material, quality and wear; its holder lives on the tool, as a bed's owner does. Reads who does each job most. Gives work speed by tier and quality, wear per hour worked, and a line when one breaks. Reuses the furniture want pattern (V-062): a worker without a tool, or with a worse one than the store holds, is a want the smith fills. Test: a fine pick mines measurably faster than a poor one.
- **Fields and seed (P4.7, V-089).** A field owns its tiles, crop and growth stage; size comes from mouths to feed and the soil, the crop from the season (content). The Seed plate keeps seed back at harvest; a hungry band may eat seed, with a line naming who and why. Fails: no seed, no sowing, with an alert; frost before harvest loses the crop with a line. Test: a spring sowing plus foraging feeds five through the first winter on most seeds.
- **Cooking (V-090).** Owns nothing new: cooks use any lit hearth (V-044), turning raw food and firewood into meals for the next day. Fails: no lit fire or firewood means raw food and the "ate-well" memory is missed. Test: a band with a cook eats meals on most days.
- **Memory and the law (P4.8, V-091).** A memory is a content entry with mood and decay (`memories.json`); a person stores their memories and their answer to each law. The law owns its setting and the day it changed. Answers are worked out once per change, and again when a memory that weighs on it is added: obeys, grumbles (obeys and remembers it) or refuses (keeps the customary hours), each with a reason that cites memories, mood and traits. Seeing a refusal adds a memory that leans the same way. Fails: a cold, hungry, tired band refuses long days. Test: two colonists answer the same law differently, each reason linking to their memories.
- **Winter (V-092).** A cold line is notable once per person per day; each settler arrives with a wool cloak (a worn item that adds warmth outdoors and wears out over a few winters, content); Short days in winter keep people indoors. Test: notable cold lines a year on anvil fall well under the 450 the Phase 3 review counted.

Lever list (V-041): normal levers add `setLaw` (a law's setting) and Stock plates for copper, tin, iron and bronze ingots and seed; the Build sheet gains Fields; the Work sheet gains Mining, Charcoal, Smelting, Smithing, Farming and Cooking rows under trade headings (V-071). The existing `cutStairs` and `sinkShaft` orders stay test-mode tools. Go down and Go up become normal view buttons once a shaft exists.

## Milestones

Order: bundles 1 to 4, then P4.9. A bundle estimated over 1,200 lines splits into an engine PR and a screen PR (VR-58).

### Bundle 1: P4.7 Fields and cooking, with seed grain, harvest home, cloaks and a quiet winter

Fields row on the Build sheet; colonists site fields on good soil near water and size them; barley in spring, turnips into autumn; sow, grow, harvest; Seed plate and seed in the cart; Cook row; meals at any lit hearth; the "brought the harvest home together" memory; cloaks from the cart; the once-a-day cold line; colonists redrawn a quarter larger (V-095); walls of the most plentiful material (V-097); fields past the ring (V-098). Mock-up: UI. Done when: a field sown in spring plus foraging feeds five through the first winter on most seeds.

- Reading list: `docs/DECISIONS.md`; `docs/UI_STYLE.md`; `src/engine/build/MODULE.md`; `src/engine/goods/MODULE.md`; `src/engine/fire/MODULE.md`; `src/engine/needs/MODULE.md`; `src/ui/MODULE.md`

### Bundle 2: P4.1 Mining across levels and underground fog

Surface stains above ore veins; the shaft sited from the want; tunnelling, rubble to stone, haulage up the stairs; darkness over unknown ground, caves and water revealed when mining opens next to them; Go down and Go up as view buttons; Work sheet trade headings (V-071); clay dug from level -1 makes wattle and daub walls (logs and clay, content, V-096). Mock-up: UI. Done when: with iron wanted in Stock, an iron vein below is mined and its ore reaches the surface store, with no order to a tile or a person.

- Reading list: `docs/ART.md`; `src/engine/map/MODULE.md`; `src/engine/paths/MODULE.md`; `src/engine/build/MODULE.md`; `src/render/MODULE.md`; `src/ui/MODULE.md`

### Bundle 3: P4.2 charcoal, P4.3 smelter and alloys, P4.4 smithy and tools, P4.6 item inspector, craft firsts

Charcoal clamp and smelter sited at the edge, the smithy by the river and the smith's house (V-053); ingots of copper, tin and iron, bronze mixed from ingots; tools with quality from smithing skill and wear; stone tools at the start; the item page walks an axe back to its ore tile; a notable line for a maker's first fine piece. Mock-up: UI (charcoal output per log goes in its engine table). Done when: bronze needs copper and tin ingots in the store, a fine pick mines measurably faster than a poor one, and an axe's page walks back to the ore tile it came from.

- Reading list: `docs/ART.md`; `src/engine/goods/MODULE.md`; `src/engine/build/MODULE.md`; `src/engine/people/MODULE.md`; `src/engine/log/MODULE.md`; `src/ui/MODULE.md`

### Bundle 4: P4.8 People slice

Memories that touch a person from the ledger; the Laws page under ⋯ with the work-hours law (Short, Customary, Long); answers with reasons on the law page, refusals first; refusals spread through a memory; temperament and memories shift the warmth warning line (V-046). Mock-up: UI. Done when: two colonists react differently to the same law, each with a reason that links to its memories.

- Reading list: `docs/DECISIONS.md`; `docs/UI_STYLE.md`; `src/engine/people/MODULE.md`; `src/engine/needs/MODULE.md`; `src/engine/log/MODULE.md`; `src/ui/MODULE.md`

### P4.9 One-year balance pass

The `balance-check` skill over the seed list. Mock-up: engine. Done when: a numbers table shows most seeds reach spring with five alive.

- Reading list: `src/engine/sim/MODULE.md`; `src/engine/needs/MODULE.md`

## Phase done (playtest)

Start with stone tools, make a bronze pick, mine iron, forge a fine iron axe by a named smith, bring in a harvest, pass long days and watch someone refuse with a reason, and reach spring.
