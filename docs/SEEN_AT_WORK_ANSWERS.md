# Seen at work: Morgan's mock-up answers

Moved out of `docs/phases/SEEN_AT_WORK.md` word for word to keep that spec within two pages. The spec's parts link here.

## Part 1

Morgan's answers (form 2026-11-20):

- **Swing** as mocked (Q1 A): the tool turns about the hand and passes behind the head on the lift, the body leans back then forward and dips a pixel on the strike; the hand rises about 5 px as the tool goes up.
- **What flies** (Q2 B, with a note): 3 by 3 art px with a dark edge, about 10 per strike, about 0.85 s. Morgan: colours must match the task, and not every job throws specks; some get their own effect. So each motion's effect is a content entry per job (colours, kind, count), for example wood chips for felling, grey grit and a spark for quarrying, earth clods for farming, flour dust for milling, steam for cooking, sparks for smithing, a drifting thread for weaving, nothing for healing. The build proposes the table in its PR; no new form.
- **Tool size** 18 art px, the longest side, against a villager about 30 tall (Q3 C).
- **Loads** in the arms, lower, at the stomach (Q4 A, Morgan: "a little lower near the stomach"); behind the body when walking away.
- **Pace** steady: about one strike a second at every game speed (Q5 A).
- **Every job's motion** as in the form's table (Q6 A): swing (fell, quarry, mine, build, smith, mason, cooper), dig (farm, graves), crouch (forage, fish, tan, heal, beekeep, thatch), stir (cook, bake, cure, chandle, limeburn, charcoal, smelt, mill, tend), bench (carpentry, craft-tools, craft-wares, weave, tailor, potter), carry (haul), none (hunt, herd: they walk, the hunter's spear shows).
- **PixelLab** (Q7 B, with a note): keep the game-drawn work motions now and plan PixelLab work animations for the final art pass. Add PixelLab walk animations now: each whole villager (15, plus the giant) in 4 directions with `animate-with-text-v3`, replacing the two walk frames. Estimate about 160 generations (16 × 4 at the trial's 2 to 3 each); 321 left on 2026-11-20. Shown to Morgan as a before and after before it lands (ART.md).
- **Side frames.** Some whole villagers' east and west frames face the same way (several halflings and elves, from a quick look). The build checks each and mirrors the wrong ones so a swing strikes towards its work.

## Part 2

Numbers form answered 2026-11-20 (https://claude.ai/artifact/HJaWXaSVTfGZ4ATbD8sgRi, every recommendation, no notes; V-195). Numbers from five years on each test seed with today's code (scripts and results in the project files under `vulcan/seen-at-work-p2/`): picks and spears never ran out; with today's tool life Anvil's last axe broke on day 108 and it made no metal tool in five years, while at half life its first metal tool came on day 116 (Smoke 20, Tallow 52, Ledger-1 25); axe work was taken up while every axe was held by others 10 to 111 times per seed. The build's output mock-up re-runs these with the rule in place.

- **Busy tools (Q1).** Someone who would take up a needed kind's work while every tool of it is held by others knaps their own if they can, else does other work.
- **Half life (Q2).** All stone tools, the cart's included: stone `life` 3600 to 1800 work minutes in `tools.json`.
- **Hammer (Q3).** Gains smithing in its `serves` and is needed only there; building keeps the 75% speed without one.
- **New tools (Q4 to Q8).** Needed: the bone needle for tailoring, and the chisel for dressed stone only (rough stone walls go up without one). Speed only: the sickle (reaping, cutting thatch), the fishing line, and the saw, which takes carpentry over from the hammer.
- **Cart (Q9).** One of each new tool, beside its three stone tools of each old kind.
- **Hunting bow (Q10).** Stays with Phase 8 (P8.1).

## Part 3

Mock-up answered 2026-11-20 (https://claude.ai/artifact/FSWME24XACU6aYDSz66UX8, every recommendation; sources and raw art in the project files under `vulcan/saw-clothes/`):

- **Drawing (Q1 A).** PixelLab `edit-image-pixen` (1 generation) puts one coat on one villager's four facings at once (a 128 by 32 strip, frame 0). A sheet of all 15 villagers in one edit loses the races, so one villager a call. The edit redraws the face and hair slightly, so each edited strip is a whole drawing per coat (`person.<race>.v<n>.<coat>.<facing>.<frame>` or similar, the build picks the name): frame 1 is frame 0 moved up 1 pixel and frame 2 equals frame 0, as today. Cleaned to `art/palette.gpl` by nearest colour. 7 villagers (each race's v1) are made; 8 remain, about 24 generations plus redos. A new villager design later costs 3.
- **Ragged (Q2 A).** A garment in its last `clothes.ragged` per cent of life: the coat's pixels dulled and darkened, a torn, uneven hem and a few small holes showing the tunic, drawn by code over the coat's pixels (those the edit changed below the head).
- **Fine (Q3 A).** Worth `fine`: richer colour, a one-pixel brass trim along the hem and a clasp at the throat, by code. Good and plain look the same.
- **When.** Outdoors below the warmth comfort line; indoors or warm, the villager as today. The render reads the worn outer item and its life and worth from the worker's people view and never works out a rule (GAME-02).
