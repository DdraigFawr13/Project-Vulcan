# Strangers, homes and the hall (Phase 5 Bundle 4: P5.9, P5.14)

Detail kept out of the module contracts, which are on milestone reading lists with a size budget. The contracts link here. Decisions: V-028, V-041, V-117 to V-121. Content: `strangers.json` (schema `schemas-strangers.ts`) and the Strangers law in `laws.json`.

## Strangers (people)

- **Strangers (P5.9, V-028, V-117, V-118, V-041):** `strangers.ts` (the monthly draw at `strangers.draw.hour` on day 1: `base` % times the food-days step, `noBed` % with no free bed or floor in the band's houses, + `name` % per stranger who stayed, `winter` % in winter; the first always on `draw.first`), `edge.ts` (they walk in from the map edge on their home's side), `welcome.ts` (each colonist's stance, named reasons, content `strangers.weigh`), `verdict.ts` (agreement stands; a split goes by the Strangers law's `lets` and everyone answers it with law `answerNow`, `dissent` less willing where it overrode them; refusers get `memories.refused`, and one who spoke for someone turned away gives `road.count` food; who spoke for them get `memories.turned`). A stranger is a `person` row with status `stranger` (`waits` the tick of the band's word, -1 walking away), then `alive` (needs seeded, a bedroll laid, `wantsFrom` now) or `gone`. Drawn like the band (`drawStranger`, `row.ts` `addPerson`); `couple` % come as two (`partner`), `animal` % lead a flock animal (flock `bringIn`, else its meat is laid at the green). Lines: `region.record`, `people.drawn`, `people.strangerCame` (cites the record's line, else the draw's), `people.strangerStays`, `people.strangerTurnedAway`, `people.strangerFed`, `people.broughtAnimal`, `law.answered`.

## The Strangers law (law)

- **The Strangers law (P5.9, V-117):** Open door, Those in need (start), Closed. Its settings have no hours, so the hourly run skips it; each setting's `lets` lists the reason kinds a split band lets in. It is answered only when it settles a split, through `answerNow(ctx, law, setting, person, {by, word}, causes)` (people `verdict.ts`).

## Homes and the hall (build, people)

- **Homes and the hall (P5.14, V-119, V-121):** `homes.ts` hourly: a person whose `wantsFrom` has come says `people.wantsHome` (one line a household); one home plan at a time (`build.homeSited`, citing the wants and the Houses row) for whoever waited longest, a couple first that day, sited by `chooseHouse(..., toward)` leaning toward the first row of the table their trade works at (`strangers.home.work`, `toward`); the house row's `owner`. A home does not grow. Once every founder sleeps in a home the first house becomes the hall (`hall`, `build.hall`); `feastInHall` after `farm.harvestHome` (`hall.feast`, the `feasted` memory), `mournInHall` after a burial (`hall.mourned`). `beds.ts` holds `houseAt`, `mainOf`, `rowsOf`, `homeFor`, `householdOf`, `builtHome`, `othersHome`, `sleepsIn` and `bedSpot`.

- **Homes (P5.14):** `claim.ts` and `home.ts`: once a household's home stands its people take a free bed there (`people.movedHome`), else carry a bedroll there (one from the store if they slept in a bed, which is left free); nobody claims a bed or lays a bedroll in someone else's home (build `bedSpot(..., who)`).

## Tests

`src/engine/people/strangers.test.ts` (slow tier): a welcome couple stays, its arrival citing the draw, and every household ends in its own home with the hall open; an agreeing band turns a stranger away whatever the law; a split goes by Closed and Open door, everyone answering it.
