# NewRoundPage Design Spec
_Session 11-H — April 2026_
_Status: AUTHORITATIVE — required reading before any 11-I code or contracts are written_
_No code in this document. Prose and tables only._
_Amended in 13-E: §7 Wolf Extension Point updated to reflect the `GameConfig.jsx` dispatcher + Shared pattern (see `BUILD_PLAN.md` Architectural Decision #26). Adding Wolf now requires a new panel file `GameConfigWolf.jsx` plus a dispatcher branch in `GameConfig.jsx`, not just a new branch in a monolithic `GameConfig.jsx`. Item §8.11 (`InlineRow` shared export) remains accurate — `InlineRow` is still a named export of `GameConfig.jsx` (re-exported from the dispatcher; canonical home is the dispatcher itself in this case)._

---

## Purpose

This document is the authoritative UI/UX specification for the New Round setup page. It was produced in session 11-H through a structured design review of all current implementation files and a complete owner-confirmed decision process. Session 11-I must read this document before writing any contracts or code. Any layout, component, or labeling decision made in 11-I that conflicts with this spec must be resolved by amending this spec first — not by making ad-hoc implementation choices.

---

## 1. Page-Level Structure

### 1.1 Layout

The page is a single vertically scrolling column of `Card` components. From top to bottom:

1. Course card
2. Players card
3. Games & Bets card (contains all game config blocks)

The page renders inside the standard app shell with the nav bar at the bottom.

### 1.2 Pinned Start Round button

The "Start Scoring →" button is pinned as a fixed action bar at the bottom of the viewport, sitting above the nav bar. It uses the existing `ACTION_BAR_HEIGHT` constant from `layout.js`. Page content has `paddingBottom` equal to the action bar height so the last card is never hidden behind it.

The button is disabled (grey, `not-allowed` cursor) when fewer than 2 players are selected. Enabled state uses primary green (`G`).

### 1.3 Section headers — deferred visual decision

Two variants must be implemented in 11-I and tested on device before a final decision is made:

**Option 1 — All headers:** Every ConfigSection has a named label (Players, Options, Bets, etc.) as currently implemented.

**Option 4 — Separators + labels only where needed:** Hairline separator lines provide visual rhythm between sections. Labels appear only where the content genuinely needs a name — "Dots to Track" in Dots, "Points" in Stableford, "Teams" in Sixes and Match. Sections whose content is self-evident (scoring dropdown, bet fields) have no label.

Both variants are built. Owner selects after on-device review.

---

## 2. Shared Components

These components are built once in 11-I and used across all games that need them. No game may implement its own version of any of these.

### 2.1 `<BetRow>`

The universal betting row. Used by Stroke Play, Nines, Stableford, and Skins. Match uses a dedicated layout — see §3.1. Sixes and Dots use `<SimpleBetRow>` — see §2.2.

**Props:**
- `modes` — array of `{ value, label }` objects defining the mode dropdown options
- `mode` — current mode value (string)
- `onModeChange` — callback
- `values` — object `{ front, back, total, single }` — current bet field values
- `onValueChange` — callback `(field, value) => void`
- `pressable` — boolean — whether press dropdowns appear (always false for these games)
- `pressValues` — object (reserved for future use; not used by current consumers)
- `onPressChange` — callback (reserved for future use)

**Layout — F/B/T mode:**
```
[Mode▼]  [$Front  ][$Back   ][$Total  ]
```
- Mode dropdown: fixed width, left-justified
- Three equal bet fields fill remaining right width
- No press row for these games

**Layout — single-field modes (Per Point / Total / Per Skin / Pot):**
```
[Mode▼]  [$field                        ]
```
- Single bet field fills full remaining right width
- No press row

**Bet field internal labels:** `$Front`, `$Back`, `$Total`, `$per point`, `$per skin`, `$buy-in` — label lives inside the field as placeholder, no external column headers.

**Note:** F/B/T mode for these games does not show press dropdowns. Press is a Match-only feature handled in `<MatchCard>` directly.

### 2.2 `<SimpleBetRow>`

Used by Sixes and Dots — single bet field with optional press, no mode dropdown.

**Props:**
- `value` — bet amount
- `onChange` — callback
- `pressable` — boolean
- `pressValue` — current press value
- `onPressChange` — callback
- `label` — internal field label string (e.g. `'$per match'`, `'$per dot'`)

**Layout — with press (Sixes):**
```
[$per match                 ][Manual▼]
```
Horizontal — bet field and press dropdown share one row, equal-ish widths.

**Layout — without press (Dots):**
```
[$per dot                              ]
```
Single field, full row width.

### 2.3 `<ScoringPills>` — Match team format only

Segmented pill row for scoring mode selection. Used **only in Match team format** where the scoring row is already occupied by bet mode pills and tie-break, requiring a dedicated full-width scoring row below. All other games use a `StyledSel` scoring dropdown inline with their bet row.

**Props:**
- `value` — current scoring mode string: `'gross'` / `'net'` / `'netofflow'`
- `onChange` — callback

**Renders:**
```
[Gross]  [Net✓]  [Net Off Low]
```
Full-width pill row. Active option has green border and green tint background. All options always visible — one tap to change.

**All other games:** Use `StyledSel` scoring dropdown (`[Net▼]` / `[Gross▼]` / `[Net Off Low▼]`) positioned inline on the bet row. This replaces the earlier decision to use pill rows universally — on-device review confirmed the dropdown is more practical when scoring shares a row with other controls.

### 2.4 `<PlayerSubsetDropdown>`

Inline subset picker presented as a single `InlineRow`-style control. Used by Skins, Stableford, Stroke Play, Nines, Dots.

**Props:**
- `players` — full players array
- `selectedIdxs` — array of included player indices (empty = all in)
- `onChange` — callback
- `required` — number or null — exact count required (Nines passes 3)

**Visibility rule:** Only rendered when more players exist than the game requires. Exact rules:

| Game | Render when |
|---|---|
| Match (individual) | >2 players |
| Match (team) | Never |
| Stroke Play | >2 players |
| Skins | >2 players |
| Nines | >3 players |
| Stableford | >2 players |
| Sixes | Never |
| Dots | >2 players and not in team mode |

**Closed state — all players in:**
```
[All Players                           ▼]
```

**Closed state — subset active, unique first names:**
```
[Chris, Mike, Tom                      ▼]
```

**Closed state — duplicate first names in subset:**
```
[Chris H., Chris T., Mike              ▼]
```
Last initial added only for players with a duplicate first name in the current subset.

**Closed state — names overflow bubble width:**
```
[Chris, Mike, To…                      ▼]
```

**Closed state — Nines, no valid selection:**
```
[All Players                           ▼]   ← red border
```

**Closed state — Nines, valid selection:**
```
[Chris, Mike, Tom                      ▼]   ← green border
```

**Open state — dropdown panel:**
A panel drops below the bubble, right-aligned. Header text "Select Players" (or "Select 3 Players" for Nines). Player chips in a 2-per-row grid using the established chip style (green border/tint = included, grey = excluded). Full two-line name blocks in panel — first name larger/bolder over last name smaller/lighter. No truncation in panel. Tap chip to toggle. Tap outside to close.

For Nines: count shown at bottom of panel ("3 of 4 selected ✓" when valid). Panel may be closed at any time — invalid state shown on bubble if constraint not met.

### 2.5 `<ConfigSection>` — existing, no changes

Named export from `GameConfig.jsx`. Section divider with optional label. Used throughout. No changes in 11-I.

### 2.6 `<InlineRow>` — promote to shared export

Currently defined privately and identically in both `GameConfig.jsx` and `MatchCard.jsx`. Must be consolidated to a single named export from `GameConfig.jsx` in 11-I. No behavior change.

### 2.7 `<PlayerSubsetChips>` — existing, no changes

Named export from `GameConfig.jsx`. Used inside `<PlayerSubsetDropdown>` panel. No changes to the chip component itself.

---

## 3. Per-Game Layout Spec

All game config panels share a common container: `background: GB`, `borderRadius: 10`, `borderLeft: 3px solid G`, `marginTop: 5`, `padding: 12px 13px`.

Standard field order within every game block:
1. Player subset picker (if applicable per §2.4 visibility rules)
2. Bet row — mode dropdown left, field(s) center, scoring dropdown + any paired option right (all one row)
3. Game-specific controls (points table, dots list, teams section, etc.)

Note: Scoring mode is no longer a separate row for most games. It lives inline on the bet row as a `StyledSel` dropdown on the right side. Match is the exception — see §3.1.

### 3.1 Match / Nassau

Match renders one `<MatchCard>` per match instance. Multiple instances stack vertically. A dashed "+ Add another Match" button sits below the stack.

Match uses a dedicated layout — it does not use `<BetRow>`. The betting section is more complex than other games (three segments + press) and requires its own column-labeled layout. The mode toggle is full-width pill row, not a left-anchored dropdown, to give the F/B/T fields and press dropdowns full column width. This prevents press dropdown truncation.

**MatchCard internal layout:**

**Header row:**
```
Match 1 · [Individual][Team]          [✕]
```
Match number label left. Format toggle (Individual / Team pill row) center/right. Remove button (`✕`) far right — hidden when only one match exists.

**Players section:**

*Individual format:*
```
[Player 1 ▼]    vs    [Player 2 ▼]
```
Two `PlayerDropdown` bubbles with "vs" separator. Each excludes the other.

*Team format:*
```
TEAM A
[Player 1 ▼]    &    [Player 2 ▼]

TEAM B
[Name      ]    &    [Name      ]   ← ReadOnlyBubble, auto-derived
```
Team B only shown when Team A is fully selected.

**Scoring + Tie-break row:**
```
[Overall] [Nassau✓]    [Net Off Low▼]
```
Bet mode pills (Overall / Nassau) on the left. Scoring dropdown on the right — same row. This row serves double duty: bet structure choice and scoring mode choice are visually associated. Tie-break dropdown replaces scoring dropdown for team format when Team A is full:
```
[Overall] [Nassau✓]    [No Tie-break▼]
```
Scoring in team match is set separately — see note below.

**Rationale for same-row placement:** Scoring mode (Gross/Net/NOL) and bet structure (Overall/Nassau) are related decisions — how you play handicaps affects what the match means. Keeping them on one row reduces vertical space and makes the relationship explicit.

**Scoring in team match:** When Tie-break replaces the scoring dropdown on the main row, a second row appears below for scoring mode:
```
[Overall] [Nassau✓]    [No Tie-break▼]
[Gross] [Net✓] [Net Off Low]
```
Scoring pill row appears full-width beneath the bet/tiebreak row.

**Bets section — Nassau mode (default):**
```
  Front     Back     Total
[  $   ] [  $   ] [  $   ]
[Press▼] [Press▼] [Press▼]
```
Full-width column layout. External column labels ("Front", "Back", "Total") sit above the bet fields — retained because the fields are narrow and a typed value replaces the placeholder, leaving no column identity without external labels. Press dropdowns directly below, full column width — "Press" / "1 Down" / "2 Down" etc. never truncated.

**Bets section — Overall mode:**
```
                   Total
                [  $   ] [Press▼]
```
Single Total column, right-justified. Bet field and press dropdown share one horizontal row. F and B space absent.

**Add match button:**
```
[ + Add another Match                      ]
```
Dashed border, green tint background, full width, below last match card.

### 3.2 Skins

```
[PlayerSubsetDropdown — if >2 players]
[Per Skin▼]  [$per skin       ]  [Net▼]  [Carryover▼]
```

Bet mode dropdown left, single field center, scoring dropdown and Carryover dropdown right — all on one row.

**Note on four-element row:** Skins is the one game where four controls share a single row (mode, field, scoring, carryover). If this feels cramped on device, Carryover moves to its own row below as a full-width dropdown — evaluate at render time.

Bet row: `<BetRow>` with Per Skin / Pot modes. No press row.
Carryover options: Carryover (default) / No Carryover.
Bet mode options: Per Skin (default) / Pot.
Field labels: `$per skin` / `$buy-in` depending on mode.
Scoring options: Gross / Net / Net Off Low (via `StyledSel` dropdown).

### 3.3 Stableford

```
[PlayerSubsetDropdown — if >2 players]
[Per Point▼]  [$per point              ]  [Net▼]
[Points table — see below]
```

Bet mode dropdown left, single field center, scoring dropdown right — all on one row.
Bet row: `<BetRow>` with Per Point / F/B/T modes. No press row.
Scoring options: Gross / Net / Net Off Low (via `StyledSel` dropdown).
Bet mode options: Per Point (default) / F/B/T.

*Points table (always visible, in "Points" ConfigSection):*
7-column grid of number inputs:
```
+3  Eagle  Bird  Par  Bog  Dbl  Worse
[  ][    ][    ][   ][   ][   ][     ]
                              [Reset]
```
Small column labels above inputs. "Reset" text link below restores defaults.

### 3.4 Nines

```
[PlayerSubsetDropdown — if >3 players, required=3]
[Per Point▼]  [$per point    ]  [Net▼]  [No Niner▼]
```

Bet mode dropdown left, single field center, scoring dropdown and Niner dropdown right — all on one row.

**Note on four-element row:** Same consideration as Skins — if cramped on device, Niner moves to its own row below. Evaluate at render time.

Bet row: `<BetRow>` with Per Point / F/B/T modes. No press row.
Niner options: No Niner (default) / Niner.
Scoring options: Gross / Net / Net Off Low (via `StyledSel` dropdown).
Bet mode options: Per Point (default) / F/B/T.

Player count error: if fewer than 3 players in the round, red error banner shown above subset picker: "Nines requires at least 3 players."

Subset validation: red border on `<PlayerSubsetDropdown>` bubble until exactly 3 players selected (when >3 players in round).

### 3.5 Sixes

```
[Player count error if <4 players]
[Teams section — if ≥4 players]
[Net Off Low▼]    [No Tie-break▼]
[$per match                 ][Manual▼]
```

No mode dropdown, no player subset picker. All four player slots are explicitly assigned in the Teams section.

**Teams section:**

Two segments rendered: Front 6, Middle 6 (indices 0 and 1 of `sixesTeams`).

Per segment:
```
FRONT 6
Team A
[Player 1▼]   +   [Player 2▼]

Team B
[Name     ]   +   [Name     ]   ← ReadOnlyBubble, auto-derived
```
Team B only shown when Team A is fully selected. Complex exclusion logic (prior teammate prevention) unchanged from current implementation.

Bet row uses `<SimpleBetRow>` with `pressable=true`. Horizontal layout: bet field + press dropdown on same line.

Scoring dropdown + Tie-break on same line:
```
[Net Off Low▼]    [No Tie-break▼]
```
Two dropdowns sharing the row. Tie-break options: No Tie-break / 2nd Ball / Half Point. Scoring options: Gross / Net / Net Off Low.

### 3.6 Stroke Play

```
[PlayerSubsetDropdown — if >2 players]
[Total▼]  [$total                      ]  [Net▼]
```

Bet mode dropdown left, single field center, scoring dropdown right — all on one row.
Bet row: `<BetRow>` with Total / F/B/T modes. No press row.
Scoring options: Gross / Net / Net Off Low (via `StyledSel` dropdown).
Bet mode options: Total (default) / F/B/T.

### 3.7 Dots

```
[PlayerSubsetDropdown — if >2 players and not team mode]
[Spread▼]  [$per dot        ]  [Gross▼]  [Individual▼]
[Dots to Track section — see below]
```

Bet mode dropdown left, single field center, scoring dropdown and Teams dropdown right — all on one row.
Bet row uses `<SimpleBetRow>` with `pressable=false`. Single field, full width.
Scoring options: Gross / Net only — no NOL (via `StyledSel` dropdown). Default: Gross.

Bet mode options: Spread (default) / Total.
Teams options: Individual (default) / Sixes Teams / Match Teams (dynamic based on active games).

*Dots to Track section (always visible, in "Dots to Track" ConfigSection):*
Unchanged from current implementation. One `DotRow` per dot with toggle, name, value input. Swipe-to-edit/delete for custom dots. `CustomDotAdder` at bottom.

---

## 4. Players Card Spec

### 4.1 Empty state

```
┌─ PLAYERS ─────────────────────────────────┐
│  [ Select players…                      ] │
└───────────────────────────────────────────┘
```

Single full-width primary button. Tapping opens `PlayerPickerPopup`.

### 4.2 Populated state

```
┌─ PLAYERS ─────────────────────────────────┐
│  Chris H.   [HI: 8.2][CH: 9 ][White▼]    │
│  Mike T.    [HI:12.4][CH: 14][White▼]    │
│  Tom B.     [HI: 5.1][CH: 6 ][Blue ▼]    │
│  ─────────────────────────────────────── │
│  tap a name to change players             │
└───────────────────────────────────────────┘
```

Player rows replace the button. No summary tile above rows — rows are the only player list on the page.

### 4.3 Tap zones per row

| Zone | Behavior |
|---|---|
| Name area (left of HI field) | Opens `PlayerPickerPopup` |
| HI field | Opens keyboard for HI editing |
| CH display | No interaction — display only |
| Tee dropdown | Opens tee selector panel |

`stopPropagation` on HI input and tee dropdown prevents bubbling to the row's tap handler.

### 4.4 HI / CH behavior

**HI entered, no manual CH override:**
CH auto-calculates from HI using selected tee slope/rating and displays in the CH field. CH field is editable — user may tap and type to override the calculated value. HI saved to player library on round start.

**HI entered, CH manually overridden:**
Manual CH entry clears the HI field (shows "HI" placeholder only — no value). HI is cleared from the player library. The manual CH value is used for the round as-is. CH is not saved to the player library (it is course and tee specific).

**HI absent:**
CH field shows "CH" placeholder. User may tap and type a CH value directly. Used for the round as-is, not saved to library. HI field remains empty.

**Manual CH entry in either case:**
The act of typing in the CH field always clears the HI field and clears HI from the player library. CH is authoritative for the round. HI is no longer relevant once CH is manually entered.

**Both empty:**
Player plays gross — no handicap strokes applied.

**Rationale:** HI is the only persistent player attribute (future API hook). CH is course and tee specific — it is never stored in the player library. Manual CH entry invalidates HI, so HI is cleared from the library to prevent stale data from being used in future rounds.

### 4.5 Tap hint

"tap a name to change players" shown below a hairline separator, below the last player row. Shown until first interaction with the name tap zone, then hidden permanently (persisted in localStorage or component state — 11-I to decide).

### 4.6 Tee selector

Per-player tee dropdown (`TeeDropdown`) unchanged from current implementation. Only shown when the selected course has tees defined.

---

## 5. Course Card

No changes to the Course card in 11-I. Current implementation (date input, course picker button, nine selectors, default tee selector) is correct and out of scope.

---

## 6. `GAME_CONFIGS` Constant Shape

A static constant defined in `NewRoundPage.jsx` (or a co-located constants file). Never stored in `gameOpts` or any persisted state. Used only by the setup UI to determine which components and modes to render for each game.

```js
const GAME_CONFIGS = {
  'Match / Nassau': {
    betType: 'segment',           // primary betting structure
    modes: [                      // mode dropdown options for <BetRow>
      { value: 'nassau', label: 'Nassau' },
      { value: 'total',  label: 'Total'  },
    ],
    defaultMode: 'nassau',
    pressable: true,              // press dropdowns appear in segment mode
    subsetPicker: false,          // players assigned explicitly via MatchCard
    scoringModes: ['gross','net','netofflow'],
    pairedOption: 'scoring',     // replaces scoring dropdown on main row (team only); scoring pills appear on separate row below
  },
  'Stroke Play': {
    betType: 'segment',
    modes: [
      { value: 'total',   label: 'Total' },
      { value: 'segments', label: 'F/B/T' },
    ],
    defaultMode: 'total',
    pressable: false,
    subsetPicker: true,
    subsetMinPlayers: 2,          // show picker when players > this value
    scoringModes: ['gross','net','netofflow'],
    pairedOption: null,
  },
  'Nines': {
    betType: 'rate',
    modes: [
      { value: 'perpoint',  label: 'Per Point' },
      { value: 'segments',  label: 'F/B/T'     },
    ],
    defaultMode: 'perpoint',
    pressable: false,
    subsetPicker: true,
    subsetMinPlayers: 3,
    subsetRequired: 3,            // exactly this many must be selected
    scoringModes: ['gross','net','netofflow'],
    pairedOption: 'niner',
  },
  'Stableford': {
    betType: 'rate',
    modes: [
      { value: 'perpoint',  label: 'Per Point' },
      { value: 'segments',  label: 'F/B/T'     },
    ],
    defaultMode: 'perpoint',
    pressable: false,
    subsetPicker: true,
    subsetMinPlayers: 2,
    scoringModes: ['gross','net','netofflow'],
    pairedOption: null,
    hasPointsTable: true,         // renders points table section
  },
  'Skins': {
    betType: 'rate',
    modes: [
      { value: 'perSkin', label: 'Per Skin' },
      { value: 'pot',     label: 'Pot'      },
    ],
    defaultMode: 'perSkin',
    pressable: false,
    subsetPicker: true,
    subsetMinPlayers: 2,
    scoringModes: ['gross','net','netofflow'],
    pairedOption: 'carryover',
  },
  'Sixes': {
    betType: 'perMatch',          // single scalar, no mode dropdown
    modes: [],                    // no mode dropdown rendered
    defaultMode: null,
    pressable: true,
    subsetPicker: false,          // all slots assigned explicitly
    scoringModes: ['gross','net','netofflow'],
    pairedOption: 'scoring',
  },
  'Dots': {
    betType: 'rate',
    modes: [
      { value: 'spread',  label: 'Spread' },
      { value: 'total',   label: 'Total'  },
    ],
    defaultMode: 'spread',
    pressable: false,
    subsetPicker: true,
    subsetMinPlayers: 2,
    scoringModes: ['gross','net'],  // no NOL for Dots
    pairedOption: 'teamsMode',
    hasDotsTable: true,            // renders Dots to Track section
  },
};
```

**Rules:**
- `GAME_CONFIGS` is read-only at runtime. Never mutate it.
- `betType` is a display-routing hint only — it determines which component renders, not any stored value.
- `modes` drives the mode dropdown. Empty array = no dropdown rendered (`<SimpleBetRow>` used instead of `<BetRow>`).
- `pairedOption` identifies which secondary control shares the bet/scoring row alongside the scoring dropdown. `null` = scoring dropdown is the only right-side control.
- Game-specific flags (`hasPointsTable`, `hasDotsTable`, `subsetRequired`) are additive — absence means false.

---

## 7. Wolf Extension Point

`GAME_CONFIGS` accommodates a future Wolf entry without modification to any other game's config or to the shared components. Wolf would be added as a new key with its own `betType`, `modes`, and flag properties. The `betType` value `'wolf'` (or an extension of `'rate'`) would route to a Wolf-specific betting component that handles the doubling mechanic — this component does not exist yet and is not specified here. The `GAME_CONFIGS` shape does not need to change to support it.

**Wolf panel implementation (post-13-E pattern):** As of 13-E, `GameConfig.jsx` is a thin dispatcher that routes each game key to its own panel file (e.g. `GameConfigSixes.jsx`, `GameConfigDots.jsx`). Adding Wolf therefore requires:
1. A new panel file `GameConfigWolf.jsx` containing the Wolf-specific config UI body, importing shared sub-components (`BetSection`, `PlayerSubsetDropdown`, `GameRangePill`, `GameRangePopup`, etc.) from `GameConfigShared.jsx`.
2. A new dispatcher branch in `GameConfig.jsx` adding `case 'Wolf': return <GameConfigWolf {...props} />;`.
3. A new entry in `GAME_CONFIGS` (in `NewRoundPage.jsx`).

No existing game's config is affected. See `BUILD_PLAN.md` Architectural Decision #26 for the dispatcher + Shared pattern in detail.

---

## 8. Cross-Game Design Standards

These are binding rules, not suggestions. Any implementation that violates them must be corrected.

1. **Internal labels only.** No external labels beside bet fields or dropdowns. Exception: Match F/B/T column labels ("Front", "Back", "Total") sit above the bet fields because a typed value replaces the field placeholder — external column labels are necessary for identity at that point.
2. **Match uses full-width pill toggle for bet mode.** Match does not use `<BetRow>`. Full-width Nassau/Total pill row gives F/B/T fields and press dropdowns their full column width, preventing truncation. All other games use `<BetRow>` (`[Mode▼][field(s)]` pattern) or `<SimpleBetRow>`.
3. **Press is always vertical for F/B/T mode (Match Nassau).** Press dropdowns sit directly below their bet fields, no left cell, aligned per column, full column width.
4. **Press is always horizontal for single-field modes (Match Overall, Sixes).** Bet field and press dropdown share one row.
5. **Total field is always right-justified (Match Overall mode).** Single field occupies the Total column position. F and B space absent.
6. **Scoring mode selector is a `StyledSel` dropdown for all games except Match team format.** Positioned inline on the bet row. Match team format uses `<ScoringPills>` full-width row because the bet row is occupied by mode pills + tie-break.
7. **Scoring dropdown pairs with secondary controls on the same row.** Match (individual): scoring dropdown right of bet mode pills. Match (team): tie-break dropdown right of bet mode pills; scoring pills on own row below. Skins: scoring + Carryover right of bet row. Nines: scoring + Niner right of bet row. Stableford/Stroke Play: scoring right of bet row. Sixes: scoring + Tie-break on own row. Dots: scoring + Teams right of bet row.
8. **Player subset picker is `<PlayerSubsetDropdown>` only.** No inline chip grids in game config blocks.
9. **Player subset picker hidden when not needed.** Visibility rules per §2.4.
10. **Terminology.** Overall → Total throughout. Segments → F/B/T in all mode labels. Nassau retained as a label for Match bet mode only.
11. **`InlineRow` is a shared export.** Single definition in `GameConfig.jsx`. No private duplicates.
12. **Niner is a `StyledSel` dropdown.** Options: No Niner (default) / Niner. No custom toggle widget.
13. **"Players" section heading is capitalized** to match all other section label styles.
14. **Start Round button is always pinned** to the bottom of the viewport. Never scrolls with content.
15. **Section headers — build both Option 1 and Option 4.** Owner decides after on-device review. Do not implement only one variant.

---

## 9. Open Questions

These items arose during the session and are deferred to a future session or to owner's discretion at implementation time.

| # | Item | Deferred to |
|---|---|---|
| OQ-1 | Section headers: Option 1 (all labels) vs Option 4 (separators + selective labels) — build both, decide on device | 11-I implementation + owner review |
| OQ-2 | Scoring mode selector: resolved — `StyledSel` dropdown for all games; `<ScoringPills>` retained for Match team format only (bet row occupied). Pill row approach retired. | Resolved — spec updated post-screenshot review |
| OQ-3 | "Tap a name to change players" hint persistence — localStorage vs component state | 11-I implementation decision |
| OQ-4 | Press "Off" state — current decision is that Manual (default, `'none'`) means long-press chips enabled but no auto-trigger. A true "presses disabled" state was considered and deferred. If a use case emerges, `'off'` can be added as a value without breaking existing data | Future session if needed |
| OQ-5 | Per-match instance labeling (Match A, Match B, etc.) — designed but not yet implemented | Session 11-J |
| OQ-6 | NOL dot selector — per-game/per-match dot minimum | Session 11-K |

---

## 10. Files Changed in 11-I

This spec implies changes to the following files. No other files should be touched in 11-I without explicit owner approval.

| File | Nature of change |
|---|---|
| `NewRoundPage.jsx` | Pinned Start button; Players card redesign; GAME_CONFIGS constant; draft persistence update |
| `GameConfig.jsx` | All game config blocks rebuilt using shared components; GAME_CONFIGS routing; InlineRow promoted to named export |
| `MatchCard.jsx` | Rebuilt using BetRow; terminology updates; format toggle moved to header row |
| `PlayerDropdown.jsx` | No changes expected — existing components remain |
| New: `BetRow.jsx` (or inline in GameConfig) | `<BetRow>` and `<SimpleBetRow>` components |
| New: `ScoringPills.jsx` (or inline in GameConfig) | `<ScoringPills>` component |
| New: `PlayerSubsetDropdown.jsx` (or inline in GameConfig) | `<PlayerSubsetDropdown>` component |

Whether new components live in dedicated files or as named exports within `GameConfig.jsx` is an 11-I implementation decision. Named exports within `GameConfig.jsx` is acceptable given the app's current file organization pattern.

