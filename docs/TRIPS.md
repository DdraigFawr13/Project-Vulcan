# Scouting, trips, camps, the search and finds (6W Slices 4 and 5, V-205, V-206, V-209, V-210)

The rules of engine land's scouting and trips. Trips in engine `land` (`camp.ts`, `trouble.ts`, `search.ts`) and people `afield.ts`. Dials: `work.json` `scout` (`pack`, `camp`, `fall`, `lost`, `late`, `places`, `curio`, `beyond`, `word`; types in core `trip.ts`). Nobody is sent by name, to a tile or on a trip (V-041): the levers stay the stock levels and the Scouting row.

## Setting out and the news (`scout.ts`, V-205)

`scout.ts`, the Scouting row (`work.scout`, jobs.json `scout`, `always`). `needOf` (kept for the tick): the first of `scout.goods` whose stock plus its known sources within `scout.reach` of the store and round finds is under its stock level. A free able surface person takes it up while no trip is under way or failed within `wait` days, unless outranked or a free restless or hardy person (`traits`) who puts it no lower could go: on 16 whole-step ways out, the first unseen tile within `far`, nearest less 3 for each known source of the need within 6 of it, then a standable spot 6 on. `work.tookUpScouting` cites the stock level and any priority; the trip goes in `map.finds` (count -1). Out to the spot (or `leg` days, or no way on), then home within `home` tiles of the green: `tellSeen`, and the place within 20 of the turn holding most sources not already in reach is the news: `land.toldOf` (a find) at `least` or more, else `land.noWord`, citing the setting-out. A trip not home within `leg` days of turning, or whose scout is dead, is lost with what they saw (`land.lost`). Fields `task` (`out`, `home`), `what`, `work` (leg's end).

## The pack

- On setting out, `kitFor` times the way found (steps x the mean of a straight and a diagonal step, there and back) and sets the trip's `due` tick at `pack.due` per cent of it. A trip not back by the scout's bedtime (law `hoursOf`) has a night out: due the morning after.
- Every trip packs food (`packUp`): the most filling food lying within `reach` of the green, nearest first, never seed (`life.lastResort`). A short trip takes a day's; one over `pack.over` minutes, or with a night out, takes a day's for each day it may take plus `pack.spare`, at most `pack.most`, and the scout's bedroll (their own laid one, its tile kept in `rollAt`, else a spare from the store). The set-out line says so (`kit`).
- Packed things are items owned by the scout with state `pack`, off the map (x -1): the colony still counts them (`haveOf`), loads ignore them. Person field `packed` is 1.
- Home (`comeHome`), `unpack` lays their own bedroll back where it was and hands the rest to them as loads to carry in; a dead scout's pack lies where they are, nobody's.

## Out there (people `afield.ts`)

A packed person on the Scouting row keeps their own round each minute, after danger: asleep, they wake by day once rested (the bedroll back in the pack, `breakCamp`); hungry, they eat from the pack (`eatPack`; with it empty on the way out, `land.packEmpty` and they turn for home); thirsty, they drink at the nearest water; cold under their line, they sit by a small fire of the wood about for `camp.warm` minutes (`campWarm`, a tree or log within `camp.wood`), then walk on at least twice as long; at night or tired, they camp where they are (`makeCamp`): the bedroll laid, below `camp.fire` °C with wood about a fire (person field `fire`, the tick it burns until; needs adds `camp.heat` degrees to their warmth), one `land.camped` line at night. Otherwise the trip goes on at any hour. Nobody walks home for meals or bed.

## Troubles (`trouble.ts`, stream `trips`)

Each quarter hour walking on the surface more than `reach` tiles from the green, at a quarter of the hour's odds:

- **A fall** on `fall.ground` kinds or lying snow, `fall.perHour` in `fall.per`: a wound (health `wound`, kind `fall.wound`, parts `fall.parts`, severity by the accident shares, a grave one maybe mortal) citing the set-out line. On their feet, they limp on home with the trip. Down with a slow bleed, they bind it roughly themselves and wait.
- **Losing the way**, once a trip (`strayed`), on land the colony does not know, in `lost.weather` (words `lost.words`), `lost.perHour` in `lost.per`: `land.lostWay`; for `lost.days` days they wander within `lost.wander` tiles of the spot (person fields `astray`, `target`), and the trip's days run on as long.
- **The cold** is the chill (health `sick.coldHours`), as for anyone; the camp fire is the cure.
- **Wolves**: a camp within `camp.pack` tiles of the den is a lure (wild `setLures`, `camp`, rank 0, words `a lone camp`) until they break camp; a hungry pack visits it and falls on the lone sleeper by the ordinary attack rules.

## Late, worried for, searched for (`search.ts`, hourly `tripHour`)

- `underWay` keeps the trip: under way while its scout lives and is on the trip or lying hurt; someone off the job but up and away takes it up again for home; someone home another way (carried in) tells what they saw. A dead scout's trip waits while a searcher is still looking, then is lost.
- `late.days` past `due`, with the scout not home: `land.late` names those close (housemates and colony `talkersOf`), each a `late.memory` memory.
- The next morning at work's start, the free able person who puts Scouting highest (then the lowest id), not the scout, within `reach` of the green, drops what they hold, packs for `pack.most` days and walks to where the scout was making for (`land.searching`, citing the worry). Once a trip.
- Within `late.sight` tiles of the scout they go to them (re-found every 10 minutes) and beside them write `land.foundScout`: lying hurt, they become the scout's finder (care `fetchHurt`: bound, carried to bed); lost but well, both set off home; dead, they come home. Found or not, they walk home; `land.notFound` if they never saw them. Memory `found-lost` for the finder.
- Care (`far.ts` `afar`): the scout of a trip under way is not looked for by care's after-work rule or fed unfound; passers-by within `care.hear` still hear them, a searcher does not (they find by sight).

## Finds (map `places.ts`, land `places.ts`, V-206)

- **Laid at worldgen** (`layPlaces`, stream `places`, after the known land): for each kind in `places.kinds`, the tiles its `rule` allows at least `from` tiles from the green, shuffled, best score first, `gap` apart and 6 from any other find, at most `most`. Rules: `spring` (spring water), `pool` (lake by a shore, every third tile), `grove` (a tree with `size` trees within 4; most first), `lookout` (open, highest within 4, `size` m above the green; highest first), `cliff` (open beside rock `size` m higher: cave mouths, then dens), `bank` (open bare ground beside a river; `size` of its tiles within 2 turn to clay). `map.places` {kind, x, y, by, line, tick}; save format 7.
- **Found** (`spotPlaces`, every 10 minutes): a find whose tile is known is found by the living person on the surface nearest it; a scout's sightings, when they come home (`comeHome`), by the scout, citing the setting-out. `land.found` {name, what, far, dir, magic (within `magic` of an aura spot), then, sort (`tale`)} starts tale `found-place`, `found-cave` or `found-den`.
- **What a find opens** (`use`): `work`, an old wood: a work area of `known.place` like a scout's find (`workAreas`); `clay`: its clay tiles are dug like level 1's (`clayWork`, build `digsFor` at z 0, `bankClay` for the kiln and house sizes), leaving `mine.floors.bank`; `fish`: anglers fish water within 3 of it however far off; `look`: whoever stands on or beside it sees twice as far (`see`). Caves and dens are tales for now.
- **Curios** (`curioHour`): each hour on the surface over `curio.far` tiles from the green, 1 in `curio.per`, once a person a season (system state `curio`): one of the least found of `curio.list`, `land.curio` (tale `curio`), and its `memory` if it has one.
- **The season's scout** (`beyond`): with no need and nothing found (a place, a scout's find or a trip beyond) for `beyond.days`, Scouting wants a trip to see what lies beyond: the nearest unknown edge, `beyond.on` tiles past it; `work.tookUpScoutingBeyond` cites the newest find, home `land.beyond` names what was found.
- **A newcomer's word** (`word.ts`, hourly): the first time someone who came as a stranger is with the colony, they tell of the scouted good with most unknown sources within 5 tiles of their road in (edge to green), `word.wrong` per cent of the time the wrong way round; `land.word` (tale `word`). The next scout for that good takes ways within an eighth turn of it `word.lean` tiles nearer, and the setting-out cites the word.

## Lines

`land.camped`, `land.packEmpty`, `land.lostWay`, `land.late`, `land.searching`, `land.foundScout`, `land.notFound`, `land.found`, `land.curio`, `land.word`, `work.tookUpScoutingBeyond`, `land.beyond` (events.json); `land.late` and `land.foundScout` are recap troubles (annals.json). Tests: land `scout.test.ts` "trips", `finds.test.ts`.
