# Decisions

Locked decisions, all made by Morgan in the planning thread on 2026-10-17 unless dated otherwise. Don't reopen one without new evidence (WS-07); a change updates this table in the same PR. The pillars they serve are in the project plan, `PLAN.md` §1 (see AGENT_BRIEF).

| ID | Decision |
| --- | --- |
| V-001 | Browser game: Phaser 4 + TypeScript + Vite (Phaser 4 chosen over 3 on 2026-10-17, pinned at 4.2.1). Repo `DdraigFawr13/Project-Vulcan`, owned by Morgan. |
| V-002 | Deterministic seeded simulation in a Web Worker at a fixed tick; renderer and UI on the main thread. |
| V-003 | Top-down 2D pixel art, 32 px tiles, muted earthy palette. Claude makes placeholder art; Final art is AI-made images Morgan picks from (V-034). |
| V-004 | Local saves in IndexedDB; saves move between devices as files, not cloud saves (V-032). Event log exportable as NDJSON; optional sql.js export later. |
| V-005 | Process as AI-Master-Instructions and the Story Generator: phase spec of at most two pages approved by Morgan before code; mock-up round before a build; PRs of 300 to 1,500 lines, one milestone each; squash-merge on green CI; merged branches deleted. |
| V-006 | Engine purity: no DOM, `Date`, `Math.random`, transcendental `Math` (sin, pow, log and the like, which can differ between browsers), timers or I/O in `src/engine` or `src/content`; named RNG streams; every state change emits an event with cause links. A boundaries check in CI enforces it. |
| V-007 | Content over code. Locked decisions live in `docs/DECISIONS.md`. |
| V-008 | Content is a forked copy of the Story Generator raws (cultures, races, names, 336-day calendar of 12 months of 28 days, creatures, items, abilities, six schools, tiers None to Legendary, awakenings, lore, faiths, great works, dragons). Vulcan tunes its own copy. |
| V-009 | Default site is a Gwerin valley. |
| V-010 | The full feature list (World, Economy, Colonists, Threats, Meta, Magic) is in scope. Nothing is cut except the mod loader (V-035); the phases set the order. |
| V-011 | Optional local Ollama hook: asynchronous, text only, never changes game state. No API key or backend ever required. |
| V-012 | Budget: Morgan about 10 hours a week; Claude builds in threads. No deadline. |
| V-013 | Map: surface 150 by 150 tiles. Size is a world parameter, so a larger map can be added later without code changes. |
| V-014 | Four underground levels below the surface (five z-levels in all), each generated lazily when first reached. Depth is a parameter for later growth. |
| V-015 | Combat is real time with pause and fully indirect: colonists decide to fight, flee or hide from traits, skills, morale, laws and standing orders. There is no drafting and no unit command. |
| V-016 | Five starting colonists. |
| V-017 | SUPERSEDED by V-031 (2026-10-18): the lighter generator from P1.5 is replaced by the Story Generator's own world in P1.6. |
| V-018 | Hosting: Vercel, production from `main` only, branch previews off, as the Story Generator (default picked 2026-10-17). |
| V-019 | In a fight the player may still pull standing levers (alarm bell, guard posts, militia law, safe zone) but never moves, drafts or targets anyone (P8.2). |
| V-020 | Each phase end goes live on the site from `main` as a playable build; the game is called launched only once every phase is in. |
| V-021 | Project-Vulcan PR #1 is closed with a comment; its deterministic engine core, clock and event log are copied into the new layout in P0.3, reviewed against V-006. |
| V-022 | Game audit, 2026-10-18 (V-022 to V-035): a thin slice of the people pillar is in the first playable (P4.8): colonists remember events, one law (work hours), each obeys or refuses with a reason. |
| V-023 | Simple fields and a cooking fire are in Phase 4 (P4.7); Phase 5 deepens farming and cooking. |
| V-024 | Predators come with hunting in Phase 5, met by a simple fight-or-flee choice that the Phase 8 combat core grows. |
| V-025 | No win ending: optional ambitions from the great works content (P9.6); failure stays a story. |
| V-026 | A skip-ahead speed (run until a notable event, then pause) comes in Phase 2 (P2.7). A year is 80 real minutes at 3x. |
| V-027 | Target colony size: about 30 people by year 10; performance and memory budgets are set for that. |
| V-028 | Wanderers and refugees join from the world's sites, each with a reason from its record (P5.9). |
| V-029 | Phone first: every UI mock-up is designed at phone width (390 px), then desktop (RULES VR-57). |
| V-030 | Underground fog: caves and water stay hidden until mining opens next to them; veins stay visible once a level is reached (P4.1). |
| V-031 | The Story Generator's world and history engine is used as a package (approved as a dependency, SAFE-03), with an adapter from Vulcan's content. It replaces P1.5's lighter generator in P1.6, behind the region map screen merged in P1.5 (six to eight neighbours, three valleys to pick, game palette, Region button), which Morgan likes; later phases build on that screen. P9.3 keeps the world's history running during play. |
| V-032 | Saves move between devices as downloaded save files (P10.2); no cloud saves, so no backend (V-011). |
| V-033 | Sound: ambient valley sound and a few effects in Phase 10 (P10.7), each licensed. |
| V-034 | Final art: AI-made images Morgan picks from, each batch's credit cost approved first (SAFE-04), cleaned to the palette and art names (P10.5). |
| V-035 | No mod loader at launch (P9.6 now holds ambitions). |
| V-036 | Ledger policy (P2.0, 2026-10-18; narrows V-006's "every state change emits an event"): a ledger line is a change a player would read or trace (something made, found or decided, a threshold crossed, someone hurt, a law weighed); steps walked, needs falling each tick and work progress change state without a line. Older days are sealed; cited lines stay as stubs. |
| V-037 | UI look "Hearth and Page" (Morgan, 2026-10-18): controls are pixel oak and iron at the tiles' grain, reading surfaces are paper pages in a book face; tap targets at least 40 px, text at least 11 px, sheets at most 40% of a phone screen. Rules in `docs/UI_STYLE.md`. |
| V-038 | Food in Phase 2 (phase review, 2026-10-18): no stopgap. The cart's 240 preserved food lasts 27.8 days for five on every seed tested, so the phase's one-week playtest passes; after that the band is hungry until food work arrives, and the playtest page says so. Whether foraging joins Phase 3 is Morgan's call (asked on the review's card). |
| V-039 | Playtest fixes (Morgan, 2026-10-18): working title back to "Project Vulcan" (drops "Ledger"); levers apply at once while paused; test mode is a switch on the Saves page, off by default, with a TEST MODE badge. Supersedes V-038's open question: foraging, a "doing now" line and a dawn page join Phase 2 (Morgan picked all three), after a screen mock-up. |
| V-040 | Seasonal berries (Morgan, 2026-10-18, P2.9): a picked bush grows back after 28 days from Thawmonth to Leaffall and bears none Mistmonth to Lastsnow, so winter is the first food pressure; colonists forage while food is under the Food stock level (none, some 50, plenty 200; plenty at arrival). |
| V-041 | Levers nudge, never command (Morgan, design workshop, 2026-10-18; sharpens VR-28): "Levers instruct colonists to do certain things but never force or handle any single task directly; they are nudges or promoted priorities." A lever may set a colony-wide level, a law, a standing order, what the colony should build (V-049 replaced "a building's place") or a person's standing priorities; none hands one person one task or marks a tile to work. Every command is a listed lever or a test-mode tool (a test checks). |
| V-042 | A hearth or fire owns only whether it is lit, its fuel left and its fuel kind. It reads whether its tile is roofed, and the weather only when it is not. It gives heat to its own tile through the per-tile temperature (P1.4), a light radius, and ledger lines when lit or out, with the cause. It never knows people or rooms (Morgan, 2026-10-18). |
| V-043 | A room's warmth is worked out from its tiles' temperature when asked; rooms store no temperature of their own (Morgan, 2026-10-18; one home per fact, SRC-01). |
| V-044 | No hearth lever. Tending fires is a new Tend row on the Work sheet (beside Fell and Haul); colonists also tend a fire when they are cold or when cooking needs one. Inside Tend, a fire about to go out comes before topping up a full one (Morgan, 2026-10-18). |
| V-045 | Fuel is content: each fuel is a data entry with burn-hours, heat and a banked rate; firewood first, peat or coal later as new entries (Morgan, 2026-10-18; V-007). |
| V-046 | Below the warmth warning line, warmth beats work; from Phase 4 (P4.8) a colonist's temperament and memories shift that line (Morgan, 2026-10-18). |
| V-047 | Fire spreading is not in Phase 3; it is parked as an idea for a later phase (Morgan, 2026-10-18). |
| V-048 | Firewood has its own Stock plate (none, some, plenty) that builders cannot draw from; the last tend before bed banks a fire to burn slowly at lower heat until dawn; tenders let a fire burn down when nobody has used its room for half a day, with a ledger line saying why (Morgan, 2026-10-18). |
| V-049 | Colonists choose where buildings go (Morgan, town layouts, 2026-10-18; amends V-041). The player says what the colony needs on a Build sheet, one row per building kind with the Work sheet's 1 to 4 priority steppers; colonists pick the site and size, show it as a faint plan with a reason line, and the player may send a plan back once to have another site chosen. Placing a building on a chosen tile is a test-mode tool only. |
| V-050 | The village centre is the green, fixed where the cart first stops: the first hearth, later the well, meeting place and shrine (P6.8). Homes cluster around it and noisy or smelly trades sit at the edge (Morgan, 2026-10-18). |
| V-051 | Building sizes are content: each building kind lists a few sizes (lean-to, cottage, longhouse); colonists pick the largest that fits the need, flat dry ground and the materials in stock. Fields take the shape of the good soil (Morgan, 2026-10-18; V-007). |
| V-052 | Buildings grow in stages, each stage a content entry (another room, a workshop lean-to on a house, thatch to slate, a bigger forge). Colonists start a stage when a need shows and the materials are in stock, with a ledger line saying why; the player never orders an upgrade (Morgan, 2026-10-18). |
| V-053 | Town layout grows with the phases: Phase 3 has the Build sheet, the green, house siting, sizes and an added room as the first stage; Phase 4 adds siting for the smithy (by the river and the smith's house) and fields (good soil near water); Phase 6 ties homes to households and adds most stages (Morgan, 2026-10-18). |
| V-054 | Worn paths (Morgan, 2026-10-18): where colonists walk most, ground wears to a track and later a laid road that speeds walking, so paths join the green, well, fields and forge on their own. Phase 5 (P5.10). |
| V-055 | House size counts the material within reach (Morgan, "Approve, count reach", 2026-10-19): stone and wood in stock plus the trees, logs and boulders within 40 tiles of the store. Refines V-051. |
| V-056 | Each wall lays its share of a thatch roof at no cost, and the roof is not drawn (accepted with the P3.7 mock-up, 2026-10-19). Real roofs and their material come later. |
| V-057 | Cottage, then grow (Morgan, 2026-10-19): a house sleeps no more than the people who need beds, and a built house adds a room for the homeless before another house is sited. Refines V-051 and V-052. |
| V-058 | Clearing a house's site is building work: its trees, and those on the way in from the green, are marked for that house and felled at building's place on the Work sheet, so food and wood come first (2026-10-19, after the band went hungry clearing a forest site). |
| V-059 | Builders work from any of the 8 tiles round a part, corners included (2026-10-19: a corner wall no one could stand beside was never built). |
| V-060 | Doors are a narrow leaf about a third of a tile wide in the wall they stand in (Morgan's pick, option C of four, 2026-10-19); widened to half a tile by V-081. |
| V-061 | The bench comes first: when a built room lacks furniture and the colony has no bench, the best crafter sets one up against a wall of the largest house room, away from the door and the beds, with a line saying why; nobody can make furniture without one. A workshop lean-to is a later growth stage (V-052) (accepted with the P3.4 mock-up, Morgan's Approve, 2026-10-19). |
| V-062 | What a room lacks is content by its role: a bed for each sleeper, then a table, a chair per sleeper, a chest and a shelf; beds always come first, in the room with the most sleepers lacking one. The maker picks the spot by rule and the door's way in stays clear; placing by hand stays a test tool (accepted with the P3.4 mock-up, Morgan's Approve, 2026-10-19). |
| V-063 | Furniture is wood only: each piece costs logs (bed 4, table 3, chest 2, chair 1, shelf 1, bench 3; content), takes minutes that fall with crafting skill, and practises it. The only new lever is a Carpentry row on the Work sheet, after Building (accepted with the P3.4 mock-up, Morgan's Approve, 2026-10-19). |
| V-064 | Quality is the maker's crafting level plus a seeded roll of up to 2 either way, worded awful, poor, plain, fine, excellent, masterwork (score cuts at 0, 2, 6, 10, 13, tuned so a band of crafting 0 to 6 makes mostly plain and poor pieces), adding -2 to +3 beauty to its room (accepted with the P3.4 mock-up, Morgan's Approve, 2026-10-19). |
| V-065 | Beds replace bedrolls: a bed rests 1,600 an hour against a bedroll's 1,200, and a colonist who takes a bed has their bedroll carried back to the store (accepted with the P3.4 mock-up, Morgan's Approve, 2026-10-19). |
| V-066 | Colonists claim beds themselves at bedtime: the free bed nearest where they sleep now, their own house first; the owner lives on the bed and there is no assign lever (accepted with the P3.4 mock-up, Morgan's Approve, 2026-10-19). |
| V-067 | Beauty and privacy are needs with small mood weights. Awake indoors, beauty moves towards the room's beauty (outdoors it drifts to neutral). Privacy rises each night in a bedroom whose every bed is theirs alone and falls for each other sleeper in the room (accepted with the P3.4 mock-up, Morgan's Approve, 2026-10-19). |
| V-068 | Not every room gets a hearth: the colony plans one only in a room someone is using while it is below a comfortable temperature without a fire (content `rooms.hearthBelow`), with a line naming who was cold; the first hearth is still the campfire on the green (V-050). Tenders feed a fire only where its room is under that line (Morgan, 2026-10-19). |
| V-069 | One job per trade, a trade may own two or three stations; each trade is content (Morgan, trades workshop, 2026-10-19, https://claude.ai/artifact/EpJMik8X5Yf2zig1GFYvgX). |
| V-070 | Small stations appear from need, as the bench does (V-061); workshop buildings are Build sheet rows colonists site (V-049); both grow into a lean-to (V-052) (Morgan, 2026-10-19). |
| V-071 | Work sheet rows appear once their station exists, under folding trade headings whose stepper sets every row; from P4.1 (Morgan, 2026-10-19). |
| V-072 | Leftovers are content that another trade uses; unused ones go to a midden at the edge; from P5.4 (Morgan, 2026-10-19). |
| V-073 | Magic joins ordinary trades through Gifted workers; the only magic stations are enchanting, the still, the ward-carver and a stone circle (Morgan, 2026-10-19). |
| V-074 | Trades are learned much faster beside a master; practice alone still teaches, more slowly; children often take a parent's trade (Morgan, 2026-10-19). |
| V-075 | Indoor trades work after dark only with light; candles get a stock plate; the work-hours law sets how late (Morgan, 2026-10-19). |
| V-076 | New trades land beside the systems they need: P5.11 to P5.13, P6.11 to P6.13, P7.7, P9.7 and rows in P5.4, P7.1, P7.3, P8.1, P9.1; Phases 3 and 4 gain none (Morgan, 2026-10-19). |
| V-077 | Tap targets are at least 44 px, up from V-037's 40 px, to match the touch-target guideline the mock-up accessibility check uses (VR-65) (Morgan, skills review 2026-10-19). |
| V-078 | Privacy rooms: a crowded sleeper's low privacy makes a house add a room (up to `house.private` rows, 4) and a spare bed for it, and a crowded sleeper moves to a free bed in an empty room no colder than their own (Morgan, Phase 3 review 2026-10-19). |
| V-079 | Cold-room alert: a room cold in use with no free floor for a hearth writes one notable line naming the room, once per room (Morgan, Phase 3 review 2026-10-19). |
| V-080 | Warmth also beats sleep below the warning line (V-046 read at the Phase 3 review: a sleeper in an unheated room froze through the night); a room keeps its hearth's tile free of furniture; the worker refuses test-mode tools unless test mode is on (Phase 3 review defaults, 2026-10-19). |
| V-081 | Doors are a leaf half a tile wide, revising V-060's third (Morgan, Phase 3 playtest, 2026-10-19). |
| V-082 | Test mode can jump ahead a month or a season: the worker runs every tick on the way, as Skip does, and refuses the jump outside test mode (Morgan, Phase 3 playtest, 2026-10-19). |
| V-083 | The band chooses the green, revising V-050's "where the cart first stops": it scores spots for dry, level ground, fresh water a short walk off and wood and stone to spare, and a ledger line says why; on the arrival screen the player may send it back once (Look elsewhere) and the band takes the cart to its second choice, at least 30 tiles away. (Morgan's pick B, Phase 3 playtest, 2026-10-19). |
| V-084 | Somewhere warm, warmth rises its steady `rise` plus half the way back to the warning line each hour (`life.warmth.catchUp`), so a colonist who walks home half-frozen is above the line within two hours by a fire (Morgan, Phase 3 playtest, 2026-10-19). |
| V-085 | Phase 4 order and trims (Morgan, Phase 4 workshop https://claude.ai/artifact/HtG6DgVYV11UNZSzWvroNz, 2026-10-19): food first, then mining, the metal chain, the law and balance. The waterwheel moves to P5.11 beside the mill (hand bellows until then); gold waits for P9.7. |
| V-086 | Metal (Morgan's wording, 2026-10-19): ore is smelted into ingots; alloys are mixed from ingots (copper and tin make bronze); smiths and other metalworkers craft from ingots. Each ingot has a Stock plate, and a plate under its level pulls alloying, smelting, charcoal and mining, each line citing the want. |
| V-087 | A coloured stain on the ground marks the surface above each ore vein, named on the tile sheet. When metal is wanted and no open vein can feed it, miners site a shaft by the matching stain as a plan with a reason, sent back once at most; no Mine row. Go down and Go up become view buttons once a shaft exists (Morgan, 2026-10-19). |
| V-088 | A worker keeps a tool once taken, like a bed (V-066); a better tool goes to whoever does that work most. Tools wear and break with a line; the band starts with stone tools (Morgan, 2026-10-19). |
| V-089 | Fields are a Build sheet row; colonists size them to mouths and soil and pick the crop by season, with no crop lever. Harvests keep seed on a Seed plate; a hungry band may eat it, with a line naming who and why (Morgan, 2026-10-19). |
| V-090 | Cooking happens at any lit hearth: a Cook row, meals for the next day, no Meals plate (Morgan, 2026-10-19). |
| V-091 | The work-hours law: Short days, Customary or Long days. Each colonist obeys, grumbles or refuses, with a reason from memories, mood and traits; seeing a refusal leans others the same way. No rebuke lever (Morgan, 2026-10-19). |
| V-092 | Winter: a cold line is notable once per person per day; each settler arrives with a wool cloak that wears out over a few winters; Short days in winter (Morgan, 2026-10-19). |
| V-093 | A notable line for a maker's first fine piece, and a shared memory for bringing the harvest home (Morgan's proposals P2, P3, 2026-10-19). |
| V-094 | Phase 4 looks (taste board https://claude.ai/artifact/D2YH7a9rHqcZ4hV3pAtdAj, 2026-10-19): black unknown ground with veins glinting; ore stains on the ground; open fields shaped to the soil; a law's page lists every answer, refusals first. |
| V-095 | Colonists are redrawn a quarter larger in Phase 4: a human fills its tile, a head may overlap the tile above, races keep their size differences (Morgan, 2026-10-19). |
| V-096 | Wall materials (Morgan, 2026-10-19): colonists build a house of the wall material nearest to hand rather than stone first, so a forest village goes up in timber; Phase 4 adds wattle and daub (logs and clay from level -1); brick comes with the potter (P5.12) and dressed stone with the mason (P6.11); warmth by material belongs to the proposed heat system (P6.10). |
| V-097 | Wall material is the most plentiful one that can finish the job (Morgan, 2026-10-19, amends V-096's "nearest to hand"): colonists build a house of the material with the most in stock and within reach, among those with enough to finish the whole house, so most first houses go up in timber; rebuilding a timber house in stone is a growth stage (P6.9). |
| V-098 | Fields keep out of the town's way (Morgan's pick "ring and move out", Bundle 1 mock-up, 2026-10-19): a town ring round the green, sized for the colony's target, is kept for homes and fields are sited outside it; when no ground in the ring fits a house the ring widens, and a field now inside it is left to grass after its next harvest while a new one is laid out farther out, each with a line. |
| V-099 | Work-hours law (Bundle 4 mock-up, Morgan, 2026-10-19): it replaces the Work sheet's hour steppers; Customary is short in winter; a refuser keeps the customary hours and whoever sees it gains a memory leaning the same way. Hours and weights are content (`laws.json`). |
| V-100 | Worn tools want the next material's ingots (Morgan, P4.9). |
| V-101 | Fields: one compact block just past the town ring, 6 tiles a mouth, yield 100 a tile (Morgan, Phase 4 review; amends the taste-board field shape). |
| V-102 | Granary beside the field for food past the Food plate (Phase 4 review). |
| V-103 | Each ingot plate says what its metal waits on (Phase 4 review). |
| V-104 | Hand-me-down tools: the old tool goes to the worst holder (Phase 4 review). |
| V-105 | Walking at half speed, clock unchanged (Morgan's card, Phase 4 review). |
| V-106 | Every timed job shows the build progress bar (Phase 4 review). |
| V-107 | Phase 5 splits into 5A Wolves and strangers and 5B Larder, loom and lamp, each live with a playtest; 5B gets its own round while 5A builds (Morgan, workshop https://claude.ai/artifact/JaA6PDXSCXvbMXWKErK7wv, 2026-10-20). |
| V-108 | Irrigation channels parked, P5.2 is wells; P5.4 splits into wild (P5.4a) and kept animals (P5.4b). |
| V-109 | Priority ladder: danger beats warmth, which beats sleep and hunger, which beat work; traits move a person's line (grows V-046, V-080). |
| V-110 | Game herds and one named pack live in the valley; the pack's hunger rises as game falls, bringing it to flocks, then lone colonists. |
| V-111 | Fight or flee on sight: the brave, armed and not alone stand; a few blows by skill and weapon; wounds to health; witnesses remember. |
| V-112 | Hunt and Fish Work rows, pulled by the Food plate; hunters spare a herd's last few and want a predator that attacked; ice stops fishing. |
| V-113 | Pasture Build row: a fold and hay meadow sited by colonists, herders tame wild beasts to fill it, hay after the first snow, an autumn cull (with proposal P3). |
| V-114 | Six body parts; wounds bleed by severity and heal with rest and care; lasting marks are content with a plain effect. |
| V-115 | The finder carries the hurt to their bed; a Heal row; a sickroom from need once two lie hurt or ill. |
| V-116 | A burial ground sited at the first death; the grave names every cause; mourning by closeness; an unburied body unsettles. |
| V-117 | Strangers law (Open door, Those in need, Closed); colonists weigh each stranger and the law settles a split band, with a line. |
| V-118 | Newcomers come for spare food, beds and the colony's name: about two or three a year, fewer in winter, the first in the first autumn. |
| V-119 | A home for every adult or couple (P5.14), each plan citing whose want it meets; newcomers sleep in the first cottage meanwhile. |
| V-120 | Roads Build row: stone on the most worn stretch first, with a line naming the route. |
| V-121 | The first cottage becomes the hall once the band has moved out (proposal P1). |
| V-122 | Tracks on snow and mud fade over a day; a hunter crossing fresh ones follows them (proposal P2). |
| V-123 | 5A looks (taste board https://claude.ai/artifact/7QMHTRi5A9UFqYcWuk9xuF): worn grass, stone roads, unmarked predators, fading prints, wattle folds, wooden grave markers, a body figure. |
| V-124 | Worn paths and roads (Morgan, P5.10 mock-up https://claude.ai/artifact/WqKbNscnYuNaMXABMrXEbq, 2026-10-25): only people wear ground, a 64th fades daily; only roads walk faster (0.7); a road goes on the busiest way between two places, its most worn run of up to 10 tiles; no Send back for roads (differs from V-049). |
| V-125 | Watch fire (Bundle 6 mock-up, 2026-10-25): via the Herding row; 4 nights after a pack sign, 6 firewood a night, watcher sleeps to 13:00; pack keeps 8 tiles off. |
| V-126 | A pack 20+ days without a kill breaks into a dark shut fold. |
| V-127 | Newcomers bring their home's skill at 9-12. Herbs: a plate, 1 per 3 days on a fresh deep wound halves festering. |
| V-128 | 5B (workshop https://claude.ai/artifact/Nd7XxGcKqCBT47eStZJc4k, Morgan 2026-10-25, all recommended): bundles stores, larder (P5.1, P5.2), kitchen and keeping (P5.3, P5.12), mill (P5.11), loom (P5.5), lamp (P5.13), sickness (P5.7); brewing moves to P6.12. |
| V-129 | Stores by kind (Morgan, 2026-10-25): granary, larder, wood yard, stone and ore yard, later wool and hide; each sited from need between where its goods are gathered and used; home store keeps the rest; no Stores row; stacks double. |
| V-130 | Fields: tile fertility drawn by grain, restored by beans, fallow or muck; rotation from content; oats, beans, cabbages, flax; blight after wet weeks, worse on a repeated crop. |
| V-131 | Drinking is an errand (river, pond, well); a well from need on the green; well water for fields in dry spells. |
| V-132 | Food spoils by place, warmth and keeping; recipes, meals plain/good/fine by cook skill; curer (smoke; salt from a seam or trade), cooper, potter (pots, bricks). |
| V-133 | Quern, then a mill from need on the river, idle when frozen; its wheel only grinds; oven beside it. Harvest home is a meal in the hall (grows V-093). |
| V-134 | Clothes: everyday and outer, worth by maker's skill; weaver, tanner, tailor; Clothes plate. |
| V-135 | Day length by month; outdoor work stops at dusk; indoor trades need candles, a hearth lights dimly; chandler (tallow, wax, soap), beekeeper; Candles plate. |
| V-136 | Sickness from colony conditions (water, spoiled food, chill, wounds, shared rooms, strangers); soap cuts it; healer medicines and surgery by skill and tool; herb garden from need. |
| V-137 | check:full under 120 s; 5B spec in PHASE_5B.md; a reading list naming DECISIONS rows counts only those rows. |
| V-138 | 5B looks (taste board https://claude.ai/artifact/7uVoR2f6Sp6mbRdGAvaB9c, Morgan 2026-10-25): food stores walled, wood/stone/ore in open yards (hurdle, drystone); blight browns outward; stone well with windlass and roof; mill walls by V-096; a candlelit room glows. |
