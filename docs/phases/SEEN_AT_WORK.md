# Seen at work

A side track built beside 6B and 6C: colonists who are interesting to watch. Morgan's message of 2026-11-20 ("clothes that show on people, tools and weapons they carry, certain things not possible without tools, small animations when doing work") and their answers on the design form https://claude.ai/artifact/Buu8aQ7NZo9mpEFdik4AK1 (V-190). Speed, jump buttons and recaps are a separate thread.

## Status

- [x] Design form answered, 2026-11-20 (V-190)
- [ ] Part 1, tools in hand, carried loads and work motions (screens); mock-up approved 2026-11-20 (V-194)
  - [x] Motions, tools in hand, loads and per-job effects from jobs.json, side frames mirrored, 2026-11-20
  - [ ] PixelLab walk animations (before and after shown to Morgan first)
- [x] Part 2 numbers answered, 2026-11-20 (V-195)
- [ ] Part 2, required tools, knapping and five new tools (engine)
- [x] Part 3 mock-up answered, 2026-11-20 (https://claude.ai/artifact/FSWME24XACU6aYDSz66UX8, every recommendation)
- [ ] Part 3, outer clothes that show (screens)

## Design (VR-62)

- **What the map shows (Parts 1 and 3).** The worker's people view gains, per walker, what the engine already decided: the motion of the job being worked (or none), the held tool's item art for that job while working or walking to it, the item carried, and the outer garment worn while outdoors below the warmth comfort line. The render draws from those fields only and never works out a rule (GAME-02). Nothing is a lever; nothing is targeted (V-041).
- **Motions (Part 1).** Each `jobs.json` row names a `motion` from a short content list: `swing` (fell, split, mine, quarry, build, smith), `dig` (farm, graves), `crouch` (forage, sow, reap, herbs), `stir` (cook, bake, brew), `bench` (weave, tailor, carpentry, toolmaking) and `carry` (hauling). A motion is drawn by code: the held tool's sprite turns about the hand, the body leans and bobs a pixel, and bits fly from the strike (chips, sparks, clods, flour dust, steam) in `src/render`. Morgan's note: the bits must be clearly visible at 1x on a phone, so they are 2 by 2 art pixels, bright against the ground, and last long enough to see (sized at the mock-up). A new job only picks a motion. Plus one PixelLab trial: about 6 generations animating one villager's swing, shown beside the code motion at the mock-up, for the Phase 10 final art choice.
- **Tools and loads in hand (Part 1).** The held tool shows while the person works its job and walks to it, else not (form Q3 A). Loads use the item's own art, smaller, at the shoulder or chest, never over the face. Held-tool art: one per tool kind, in each material, from the item icons (about 8 PixelLab generations if the icons do not read when held).
- **Required tools (Part 2).** A `tools.json` kind may say `needed: true` for some of the jobs it serves: pick for mining and quarrying, axe for felling and splitting, spear for hunting large game (hares are snared by hand), hammer for smithing. Without one, nobody takes up that work, and the job's row says what it waits on ("no pick in the valley"); other kinds keep the 75% speed. A last tool breaking writes one notable line naming what stopped.
- **Knapping (Part 2).** Anyone with some crafting skill knaps a stone tool at a chopping block (a stone and a log, about 2 hours, no forge) when a needed kind has no free tool and a person who works that kind has none; a `toolmaking` row on the Work sheet. Stone tools wear out in half today's life (form Q6 C), so metal stays wanted (V-100).
- **Five new tools (Part 2, form Q7 B).** Data entries in `tools.json` and `items.json`, each with its jobs and drawing: bone needle (tailoring, from hunters' bones), sickle (reaping and cutting thatch), chisel (the mason's dressed stone), fishing line (fishing) and saw (carpentry). Which are needed: see Part 2's answers (V-195).
- **Clothes (Part 3).** The outer garment each person wears (cloak, leather coat, hide coat) is drawn on their villager, shown outdoors when cold (form Q9 A); worn-out ones look ragged and dull, fine ones get a trim (details under Part 3). The everyday garment stays drawn into each villager (form Q8 A).
- **Later.** Defences grow from fear in Phase 8, P8.2 (form Q10 A): a fence after wolves take stock, a palisade after a raid, a stone wall and gatehouse after a breach, sited by the builders with a line saying why, under a Defences law (Open, Watchful, Walled). Bows and armour come with the Phase 8 combat core (P8.1); the hunting bow comes with them (V-195).

## Parts

Each part is built in a fresh thread with a mock-up first: Parts 1 and 3 send a screen mock-up (390 px renders) to Morgan's approval; Part 2 sends an output mock-up (four seeds, five years: work stopped for lack of a tool, knapped tools, tools by material). Merge on green once the mock-up is approved (Morgan, 2026-11-20).

### Part 1: tools in hand, carried loads and work motions

Mock-up: UI, approved 2026-11-20 (V-194): https://claude.ai/artifact/QD7htqM6kKxKHNiDKtukx1 (sources `vulcan/seen-at-work-p1/` in the project files: `template.html` holds the drawing code to port). Done when: a person felling shows an axe swinging with chips at 1x and 2x speed, a hauler shows their load, the motion of every job comes from `jobs.json`, each side frame strikes towards its work, villagers walk with the PixelLab walk animations, and `npm run test:browser` passes.

Morgan's answers: [SEEN_AT_WORK_ANSWERS.md](../SEEN_AT_WORK_ANSWERS.md#part-1).

- Reading list: `docs/DECISIONS.md` V-041 V-088 V-095 V-168 V-190; `src/render/MODULE.md`; `src/worker/MODULE.md`; `docs/UI_STYLE.md`; `docs/ART.md`

### Part 2: required tools, knapping and five new tools

Mock-up: Engine. Done when: the four-seed table above, a test that a valley with no pick takes up no mining and writes the waiting line, a test that a knapped pick restarts it, and the new tools as data entries only.

Morgan's answers to the numbers form (they settle the open rules above): [SEEN_AT_WORK_ANSWERS.md](../SEEN_AT_WORK_ANSWERS.md#part-2).

- Reading list: `docs/DECISIONS.md` V-088 V-100 V-134 V-185 V-190 V-195; `docs/SEEN_AT_WORK_ANSWERS.md` Part 2; `docs/TOOLS_AND_SMITHY.md`; `src/engine/goods/MODULE.md`; `src/engine/people/MODULE.md`; `src/engine/crafts/MODULE.md`

### Part 3: outer clothes that show

Mock-up: UI. Done when: each race shows the three outer garments at 390 px, outdoors in the cold only, with ragged and fine looks, and `npm run test:browser` passes.

Mock-up answered 2026-11-20: Morgan's answers are in [SEEN_AT_WORK_ANSWERS.md](../SEEN_AT_WORK_ANSWERS.md#part-3).

- Reading list: `docs/DECISIONS.md` V-134 V-168 V-184 V-190; `docs/CLOTHES_AND_LOOM.md`; `src/render/MODULE.md`; `src/engine/needs/MODULE.md`; `docs/ART.md`
