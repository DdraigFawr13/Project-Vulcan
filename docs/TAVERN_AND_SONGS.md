# The tavern, songs and bynames (spec)

6B Bundle 5 (P6.12; V-041, V-128, V-140, V-155, V-169 amended, V-183, V-188). Morgan's mock-up form, 2026-11-20: every recommendation, two notes (form https://claude.ai/artifact/47iEEFpRCuYa9ogJD7Tn2o, db `answers`, docs t1 to t9). This is the build spec; engine part 1 is built (see Built). Numbers marked (est) are starting values to tune in the build.

## Measured before the tavern

Today's build, two years, default levers (script `/mnt/project-files/vulcan/p6b-tavern/tellings.mjs`; copy it into `tools/` to run). Tellings in year 2: anvil meal 31, stroll 19, work 20, fire 11 (81); smoke 0, 22, 12, 15 (49); tallow 10, 34, 16, 32 (92). Colonies hold 4 to 6 people and the top four tales each year were held by everyone alive on all three seeds.

## 1. The tavern (t1)

- A Tavern row on the Build sheet (`setBuild {kind: 'tavern'}`, start level 3). At levels 1 to 3 the colony sites it once the first harvest home is past and nobody sleeps outside (level 1: the harvest home alone); at 4 ("last") it waits. Sited like the sick-house (`build/sickhouse.ts`): `chooseHouse` with one size, a free place facing the green, away from noisy trades; walls by the house wall rule. A house row flagged `inn` (est: longhouse, 8 by 6). One `sendBack {tavern}` as for houses.
- The tavern is not a home: every check that skips `sick` houses also skips `inn` (beds, claim, homes, strangers, grow, `bedsOf`).
- Furnished from need (rooms `wants` role for the inn): a hearth (builders, `hearths.ts`), a counter, 2 casks, a brewing tub, 2 tables, 6 chairs (est). Casks are the carpenter's (logs), not the cooper's.
- Named from a content list of names (est: "The Barley Sheaf", "The Plough"...), with a `tavern.built` line.

## 2. Ale and the brewer (t2)

- New Priorities row Brewing (job `brew`, cooking skill, workplace the brewing tub). The brewer brews 4 grain (barley or oats) into one cask of 20 cups, ready after 7 days; mead from honey the same way when there is honey (est 4 honey).
- A new Ale row on the Stock screen (no / some / plenty; start some); the brewer brews toward it, counting cups in casks and brewing. They take grain only while the store's food is above the Food row; else one `tavern.noGrain` line ("the grain is kept for eating").
- No new law.

## 3. Evenings and the innkeeper (t3)

- New Priorities row Inn-keeping. The innkeeper is the living grown-up who puts it highest (ties: sociable first, then id). At the end of work they go to the tavern, light its fire and pour.
- Anyone at leisure in the evening may go, decided once an evening (est: 40 per cent, sociable +50, solitary -25). A cup gives `drank-ale` (+3, 1 day), at most 2 a night. No ale, or no innkeeper there: they still come but leave after an hour.
- In winter the tavern fire takes the place of the evening gathering by a lit hearth; mending still happens there (people `evening.ts`).
- The innkeeper hears 4 new tales a day; everyone else 3 (amends V-169's 2).

## 4. Tales at the tavern (t4)

- New telling place `tavern` (tales.json `places`, " at the tavern"): both relaxing inside it, pass 40 per cent an hour. `perDay` becomes 3 for every place.
- After a cup, a telling bends 10 per cent more often (most bends grow, as now).
- Done when: most tellings happen at the tavern once it stands (test), and the before/after table above measured on the same seeds.

## 5. The dark side of ale (t5)

- After a second cup a hot-tempered drinker may quarrel (est 15 per cent an evening) with someone at the tavern: a new `tavern.brawled` line with light wounds (reuse defy `brawl` kinds and parts, health `wound`), and its own tale entry (copying `tavern.brawled`) with byname words.
- Someone in a low mood may drink up to 4 cups and wakes **Hung over** (Morgan's word, t5 note): memory `hung-over` (-3, 1 day) and slower work until noon (idles 1 minute in 4, beside `slacking` in mind.ts).

## 6. The bard and songs (t6)

- New Priorities row Bard; a new `singing` ability, added to a person as a skill row the first time they sing (not drawn with the band, so no seed's history moves).
- The bard (who puts Bard highest) holding a tale of a big event (death, beast, feast, brawl, hungry winter, someone leaving) spends two free evenings making a song of it, named from content ("The Lay of …", "…'s Lament"); at most one new song a season. A song starts one level bigger than the bard's version.
- Sung of an evening at the tavern, or at a lit fire before there is one. Everyone in earshot hears it at once, holds the song's version, and gets `heard-song` (+2 to +5 by the bard's singing level, 3 days). A tale in a song still sung is never forgotten. Lines `song.made`, `song.sung`.

## 7. Bynames (t7, t8)

- A byname comes when a tale about a living person is held by more than half the living grown-ups and has been told at least 8 times, and the version most hold has a byname word: tales.json gives each tale's levels an optional byname ("" for none; mild levels none, the true level of a big event some, grown levels the harsh ones: "Oat-thief", "Wolfbait", "Brawler").
- One for life, the first only; a song can give one to someone with none. Stored on the person; shown after the name on their sheet and in ledger lines from then on, not on the portrait strip. Line `tale.byname` cites the tale's latest telling; the sheet shows the tale beside what happened.
- The named get `byname-proud` (+4) or `byname-stung` (-6) by the byname's content flag, felt again when they hear the tale told.

## 8. Art (t9)

PixelLab, about 8 generations: ale cask on a stand, brewing tub with a paddle, a counter, and a hanging sign. Morgan's note: "Make sure it looks and feels like a tavern. None of the houses or rooms have enough character or personality." Check the result beside the walls, tables and hearth at game zoom before it goes in.

## Built

Engine part 1 (V-196): `build/tavern.ts` sites the tavern (a house with `inn` 1; Build row `tavern`), plans its hearth and wants `tavern.build.wants` (wants.ts); `crafts/brew.ts` is the Brewing row; engine `inn` names it, picks the innkeeper, decides evenings, pours, brawls and hangovers (`src/engine/inn/MODULE.md`); tales tell at the tavern. Departures, all est values or small defaults: evening odds 60 per cent (measured below, Morgan's standing rule on routine cards); on a winter evening everyone at leisure goes, in place of the lit-hearth gathering, and still mends by its fire; the tavern fire is lit by tenders (its room is in use), not by the innkeeper; a brew is 120 minutes at skill 10 and the brewer keeps the grain overnight; counter, casks and tub use placeholder art until the art step; brawl wounds are `cut` or `crush` (defy's brawl `break`s bones, too heavy for a tavern scuffle), so `tavern.brawl` keeps its own lists; the spec's `tavern.built` line is `tavern.named`, which cites the house built.

Measured, year 2, default levers (tellings at the tavern of all tellings; before had no tavern): anvil 2 of 77 (before 0 of 81; its folk work far out and spend evenings on chores), smoke 50 of 68 (0 of 49), tallow 53 of 118 (0 of 92). At 40 per cent: anvil 6 of 72, smoke 15 of 36, tallow 38 of 97.

Engine part 2 (V-197): `tales/songs.ts` and `tales/bynames.ts` (`src/engine/tales/MODULE.md`). Departures: a song counts as a telling to each hearer (eight tellings are out of reach in a colony of five otherwise); a bard makes or sings once a free evening. Measured over two years: anvil 1 song and 24 singings, smoke 2 and 190, tallow 2 and 330 with two bynames ("Scar"); every song so far is of a harvest home, since bards rarely hold another big event in its season.

## Build order

1. Engine part 1: tavern siting and furnishing, brewing, the Ale row, evenings, innkeeper, tavern tellings, brawls, hung over. Done when: the tavern-tellings test and the before/after table.
2. Engine part 2: songs and bynames. Done when: a byname's line cites its tale (test); a song's version spreads.
3. Screens: Tavern row, tavern sheet (innkeeper, ale, tonight, tales and songs this week), byname on the person sheet and ledger, the new Work rows, Ale on the Stock screen (have = cups in casks). Mock-up pictures: the form above.
4. Art.
