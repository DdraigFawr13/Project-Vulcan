# care

Caring for the hurt, the sick and the dead (P5.6 to P5.8, P6.5, V-172): binding and nursing, herbs and draughts, surgery, foul water, keeping the sick apart, accidents at work, feeding those who cannot, and burial. The wounds and sickness themselves are `health`. Uses `band` and `herding` (fleeing).

- **Public API:** `index.ts`: `apartHour`, `burying`, `careMinute`, `danger`, `drankAt`, `draughtFirst`, `nursing`, `risk`, `takeUpBurial`, `takeUpNursing`.
- **Herbs, sickness:** herbs from `land` `forage.ts`; `nurse.ts` `herbDress`; `foul.ts`, `draught.ts`, `surgery.ts` (see health).
- **The Sickness law (`apart.ts`, P6.5, V-172):** each hour, a catching bout newly showing under a `sick` setting is weighed once: if the sick person or a housemate (health `homeHouse`) refuses the law, `people.keptHome` (citing their answers) and the bout's `kept`; else under `house` `people.sentToHouse` (the bout's `sent`) and `care.ts` `bedFor` lays them only in sick-house beds (others never are), a bed elsewhere left once one there is free; under `away` `people.sentAway`, status `away` at the road's edge (`edge.ts`, else the green), not drawn, unnursed, their needs still; over it, `people.cameBack`. Test `apart.test.ts`.
- **Care and burial (P5.6, P5.8):** `care.ts` (binding, beds, `careMinute`), `feed.ts` (feeding the bedridden), `accident.ts` (`risk`: accidents at work), `burial.ts` (a builder sees a burial through once begun): health `MODULE.md` holds the rules.
- **Tests:** `apart.test.ts`.
