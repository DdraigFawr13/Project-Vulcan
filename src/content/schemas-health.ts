// Shape of Vulcan's health file (src/content/data/health.json, P5.6, P5.8, V-114 to V-116): blood,
// body parts, wound severities and kinds, the accidents of risky work, healing, festering, lasting
// marks, care, the sickroom, mourning and burial. Chances are per cent unless named `per`.
import { bool, list, map, num, obj, opt, ref } from './schema';
import { count, id, text, texts } from './schema-fields';

const pair = list(num({ min: 0, max: 100 }), 2);

export const HEALTH_SCHEMAS = {
  health: obj({
    // Blood runs 0 to `full`; under `faint` they cannot stand; a wound bleeding slow or fast drains
    // that much an hour; unwounded blood comes back `regain` an hour.
    blood: obj({ full: num({ min: 1 }), faint: count, slow: count, fast: count, regain: count }),
    parts: list(obj({ id, name: text, limb: opt(text) })),
    // `share` of accidents; `days` to heal in bed with daily dressing; `bleed` 0 none, 1 slow,
    // 2 fast; `down` means they cannot walk (any wound to a `downLimb` that bleeds does too);
    // `mortal` per cent bleed fast whatever is done; `fester` and `mark` [cared, uncared].
    severities: list(
      obj({
        id,
        name: text,
        share: count,
        days: num({ min: 1 }),
        bleed: num({ min: 0, max: 2 }),
        down: bool(),
        mortal: opt(count),
        fester: opt(pair),
        mark: opt(pair),
      }),
    ),
    // `name` ("broken {part}") and `a` ("a {severity} break to {their} {part}"); `minor` the
    // words for a wound that does not bleed (a light one: "a bruise to her arm").
    wounds: list(obj({ id, name: text, a: text, minor: opt(obj({ name: text, a: text })) })),
    // Each hour of `work` (a person's job, `mine:<task>` for mining) carries `perHour` in
    // `chance.per`, times skilled ÷ (skilled + level), times `worn` per cent with a worn tool.
    // `where` names the place in lines ("the shaft"), `at` its word ("in", "at").
    accidents: list(
      obj({
        id,
        work: texts,
        perHour: count,
        wound: text,
        parts: texts,
        what: text,
        where: text,
        at: text,
      }),
    ),
    chance: obj({ per: num({ min: 1 }), skilled: num({ min: 1 }), worn: num({ min: 1 }) }),
    downLimb: text,
    upAt: num({ min: 0, max: 100 }),
    // Per cent of a healing day an hour counts for: abed and dressed (`bed`), abed but not
    // dressed within `dressEvery` hours (`undressed`), up and about (`up`), roughly bound only
    // (`rough`, times the rest).
    heal: obj({
      bed: count,
      undressed: count,
      up: count,
      rough: count,
      dressEvery: num({ min: 1 }),
    }),
    // Festering can start in a wound's first `days`; fever lasts `fever` days and kills `dies`.
    fester: obj({ days: num({ min: 1 }), fever: num({ min: 1 }), dies: count }),
    marks: list(
      obj({
        id,
        name: text,
        limb: opt(text),
        part: opt(text),
        effect: text,
        by: num({ min: 1, max: 100 }),
        text,
      }),
    ),
    // Binding and dressing minutes (shorter with the job's skill, `skilled` dial); a call is heard
    // `hear` tiles away on the same level; someone not home `missing` hours after work is looked for.
    care: obj({
      job: ref('jobs'),
      bind: num({ min: 1 }),
      dress: num({ min: 1 }),
      skilled: num({ min: 1 }),
      hear: count,
      missing: count,
    }),
    sickroom: obj({ hurt: num({ min: 1 }), beds: num({ min: 1 }) }),
    mourn: obj({
      close: ref('memories'),
      band: ref('memories'),
      burial: ref('memories'),
      saw: ref('memories'),
      near: count,
      unburied: count,
    }),
    burial: obj({
      w: num({ min: 1 }),
      h: num({ min: 1 }),
      minutes: num({ min: 1 }),
      marker: ref('items'),
      job: ref('jobs'),
    }),
    // The words the Health tab, the Work sheet's footnote and the grave, burial-ground and
    // sickroom pages read (P5.6, P5.8): sentences with
    // `{slots}` filled by the worker, never worked out on the page.
    words: map(text),
  }),
};
