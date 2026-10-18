# UI style: Hearth and Page

Morgan chose this look on 2026-10-18 (V-037). Direction board, with the mock every rule below was measured on: https://claude.ai/artifact/MDzojC3P246evWWQsx8JFn. Every screen, and every screen mock-up from then on, follows this file.

## The idea

Two materials, split by what the player does with them:

- **What you press is made of the valley.** The top bar, buttons, portrait frames and the alert line are pixel art at the tiles' grain: oak planks and iron plates.
- **What you read is written on paper.** The tile sheet, person panel, ledger, saves list and every other reading surface is a paper page in an oak frame, set in a book face.

Hearth and Page merges the board's Smithy controls with its Ledger Book sheet. Frames stay thin and appear only on the edges of the chrome; ornament never costs readability.

## Tokens

Defined once in a token file that every screen reads; no screen writes its own hex values or font names.

| Token | Value | Use |
| --- | --- | --- |
| `oak` | `#4a3322` | plank bar, frames |
| `oak-dark` | `#1a110b` | outlines, the bar's lower edge |
| `iron` | `#5c5e5e` | buttons, portrait frames, alert plate |
| `ember` | `#c8743a` | the one "on" state (pressed speed, open tab) |
| `page` | `#ded0b0` | paper surfaces (with the paper texture) |
| `ink` | `#2b2016` | text on paper |
| `ink-soft` | `#5a4630` | labels, times and asides on paper |
| `rubric` | `#8e2f22` | entry numbers, "why?" headings, the alert badge |
| `bone` | `#efe2c2` | text on oak and iron |
| `mood-ok` / `mood-low` / `mood-bad` | `#6f8a3a` / `#d29a2e` / `#c0412c` | mood rings and need warnings only |

Ember means "on" and nothing else. Rubric marks the record (entry numbers, causes, alerts). Mood colours appear only on mood and needs.

## Type

| Role | Face | Sizes |
| --- | --- | --- |
| Reading text | Alegreya | 16 px body, 14 px asides |
| Names and headings | Alegreya SC, 700 | 22 px sheet title, 15 px section heading, 13 px portrait names |
| Button labels and the clock | Silkscreen | 12 px labels, 16 px clock |

- No text under 11 px anywhere; the mock's smallest is 12 px.
- Silkscreen only for short labels and numbers on oak or iron, never for sentences.
- Fonts come from Google Fonts, with Georgia and monospace fallbacks.

## Controls (the `ui` art sheet)

Drawn at 1 art pixel to 2 CSS pixels and scaled with `image-rendering: pixelated` as 9-slice borders. Sheet rows are in `docs/ART.md`.

- `ui.plank`: the top bar's plank strip, tiled.
- `ui.iron` and `ui.iron.on`: a riveted button plate, normal and ember.
- `ui.oak-frame`: the oak frame with iron corner brackets around a paper page.
- `ui.paper`: the paper texture, tiled under every page.

## Sizes and layout on a phone (390 px)

- **Tap targets are at least 40 px** in both directions, including a sheet's ✕ and the speed buttons.
- The top bar holds the clock line, the speed buttons (pause, 1×, 2×, 3×, Skip) and Ledger. Region, Saves and anything later go in the ⋯ menu, so the bar never overflows at 390 px.
- Under the bar: the portrait strip (iron frame, mood ring, name) and the one-line alert plate with its count badge.
- A sheet opens to at most 40% of the screen and scrolls inside itself. Chrome above the map takes at most about 27%, so at least a third of the map stays visible. Measured in the mock: chrome 27%, map 34%, sheet 39%.
- The selected tile gets a pale gold outline with a dark edge, visible on every ground.
- On desktop the same parts are used, with the sheet docked on the right.

## Ledger lines and "why?"

- A ledger line has the entry number in bold rubric small caps in a left column, the time in italic `ink-soft` above, and the sentence in `ink` below.
- An open "why?" chain steps each cause in one notch under the line it explains, joined by a thin ochre rule. It ends in an italic "older record" when the cause has been archived.
- "why?" is offered only where the chain says more than the world's beginning (LESSONS 2026-10-17). Players never see raw type ids.

## What a new screen must do

1. Read colours and faces from the tokens; no literal colours or fonts.
2. Put pressing on oak and iron, and reading on paper.
3. Keep every tap target at 40 px or more and every text at 11 px or more, and keep `ink-soft` or darker on paper.
4. Fit 390 px without horizontal overflow; move extra buttons into ⋯.
5. Keep sheets within 40% of the screen on a phone.
6. Offer no tool that orders one colonist or marks tiles (V-015): levers are priorities, standing orders and laws.
7. Show its mock-up at 390 px with a screenshot before it is built (VR-57).
