# App Data Model Contract

_Version 4.1 — June 2026_
_Changes in v4.1 (15-O): §5.2 — course library record schema added; `starred?: boolean` field documented (library-only, absent = false; starred courses sort above non-starred in `courseLib.list()`; A→Z within each tier). Mirrors player library `starred` pattern from §5.3._
_Supersedes v4.0._
_Changes in v3.8 (15-E.1): §1 Storage Keys — two app-preference keys (`moneyListRange`, `historyRange`) documented as the exception to the SK-only rule. New §1.1 — shape and valid values for the range pref object. §1.2 — backup payload `settings` field documented as a new top-level export field carrying app preferences (`moneyListRange` and `historyRange`); preserved through `HistoryPage.applyImport` and applied to localStorage on import. New shared component `RangePicker.jsx` in `src/components/` is the sole owner of read/write to these keys — see `UI_Component_Contract.md` §10._
_Supersedes v3.7._
_Changes in v3.7 (13-G.2): §5.3 Players — Player object schema gains `siArray: number[18]` (per-player stroke index, required at round-start; never null for a started round; built once via `buildPlayerSI(player, layout)` from `Handicap_Contract.md` §2.8; not serialized — `roundLib.toActiveRound` rebuilds defensively on reload). Engines read `players[pi].siArray[h]` for stroke allocation in every game (§5 amendment in `Handicap_Contract.md`). The shared `activeRound.hcps` field is retained for SI display rows only._
_Supersedes v3.6._
_Changes in v3.6 (13-C.8 / 13-C.8.1): §10.1 `computePerMatchPayouts` updated — two new trailing args (`earlyEndOpts` positional 12, `lastCompletedHole` positional 13); full resolution pipeline now applied per match (aggregate per-match SegmentedResolution, skip abandoned matches, apply end_at_k trim, zero per-segment/press Pay/Abandon contributions). Return shape gains `decoration: string | null`. All three call sites updated. §10.1 share-image filter widened — `buildShareHtml` now drops any `breakdown[]` entry whose `game` starts with `'🥊 Match '` (per-instance entries from computePayouts Option A), not only the retired combined `'🥊 Match / Nassau'` entry. §11 invariant 19 NEW — per-match Option A policy: `computePayouts` emits one breakdown entry per match instance; the combined `'🥊 Match / Nassau'` flat entry is retired._
_Supersedes v3.4._
_Changes in v3.5 (13-C.7, post-device-test): §9 `roundLib` responsibilities — three round-trip rules added: (1) `earlyEndOpts` and `lastCompletedHole` MUST round-trip through all three converters (`fromActiveRound`, `toActiveRound`, `toSetupState`) using snake_case in history records and camelCase in setup state and active round; (2) `migrateRecord` MUST backfill `eventOrder` on legacy `earlyDepartureOpts` entries lacking the field; (3) `NewRoundPage.handleStart` MUST preserve `earlyDepartureOpts`, `earlyEndOpts`, and `lastCompletedHole` through the Back→Setup→Forward navigation path, reading from `initSrc` using camelCase keys per `toSetupState` emission. §10 `computePerMatchPayouts` shape — `earlyDepartureOpts` parameter added (positional arg 11, default `{}`). §10 `buildShareHtml` — `earlyDepartureOpts` consumed from `ar`. §11 invariant 17 added: dual-implementation of engine departure data guardrail (engine-side in `payouts.js`, display-side in `scorecardUtils.js`); both MUST remain in semantic agreement. Surfaced and fixed in 13-C.7 device test._
_Changes in v3.4 (13-C.7 / v2.0): §5.12 (NEW) — Partial round / departure fields (`earlyDepartureOpts`, `earlyEndOpts`, `lastCompletedHole`) cross-referenced to `PartialGameContract.md` §4.1. The fields themselves were added to `activeRound` in 13-C.6 (proactive entry) and 13-C.7 (reactive entry), but were not previously documented in this contract — the schema source-of-truth lived solely in `PartialGameContract`. §5.12 establishes the cross-reference so consumers searching App_Data_Model for activeRound shape find pointers to the relevant section. v2.0 of `PartialGameContract` adds `eventOrder` to `earlyDepartureOpts[pi]`; this contract follows by reference, not by duplication. §10 `buildPayoutArgs` shape updated to include `lastCompletedHole`, `earlyEndOpts`, `earlyDepartureOpts` pass-throughs (added in 13-C.6 / 13-C.7). No engine firewall change._
_Changes in v3.3 (13-C.3 Phase 2A): §5.1 — `gameRanges` field added to round identity table.
Field documents per-game custom hole ranges keyed by game name or `matchDef.id`. Persistence
round-trip via `roundLib` `game_ranges` snake-case field. §10 — `buildPayoutArgs` shape
updated to include `gameRanges`. 13-C.2 passthrough comment replaced with 13-C.3
description of resolution mechanism (`rangeFor` helper, pre-processing trimming via
`trimScoresToRange`). Engine firewall reference updated to invariant #13.b
(games.js exception clause for `runMatchNassau` + `calcTeamStablefordTotal` `range` arg)._
_Changes in v3.2 (13-C.2): §5.1 — `roundStartHole` and `roundNumHoles` added to activeRound
blob (round identity section). §5 table — new fields documented. §9 — `toSetupState` field
completeness rule updated: `manual_presses` and round length fields must be restored.
§10 — `buildPayoutArgs` shape updated to include `roundStartHole` and `roundNumHoles`
(passthrough only until 13-C.3). §4 permitted engine calls — `TotalsCard` ESC call scoped
to full rounds only; note added. §11 invariant 16 added: `toSetupState` field completeness._
_Changes in v3.0: §5.5 Dots — `teamMode` value set expanded; `'Match'` generic value replaced by `'Match:{matchId}'` (specific match ID). Match instance labels are derived from current array index at render time — not stored. §7.1 — migration shim added for legacy `teamMode: 'Match'` → `'Match:{firstTeamMatchId}'`._
_Changes in v2.9: §5.5 — `scoring` field renamed to `grossNetNOL` in all gameOpts shapes (Stroke Play, Skins, Stableford, Nines, Sixes, Dots); `tiebreak` renamed to `scoring` in `gameOpts.Sixes`. §5.7 — MatchDef `scoring` renamed to `grossNetNOL`; `tiebreak` renamed to `scoring`. §7.1 — four new migration shims added for both renames across all affected games and matches._
_Changes in v2.8: §5.5 Sixes and §5.7 MatchDef — `tiebreak` value set expanded to `'none' | 'second' | 'cumulative' | 'half'`. New value `'cumulative'` adds a hole-scoring rule summing both teammates' net scores per team. Legacy `'half'` retained for back-compat with rounds saved pre-v2.8 but not offered in UI as of session 11-I.2. Engine branches added in `games.js` `runTeamMatch`, `calcSixesSegment`, `runSixesSegment`._
_Changes in v2.7: §5.5 — Stroke Play: `betMode: 'total' | 'segments'` replaces `strokeMode: 'single' | 'nassau'`; old field retained for backward-compat fallback read. Stableford: `betMode: 'perpoint' | 'segments'` replaces `stabBetMode`; default changed from `'nassau'` to `'perpoint'`; old field retained for fallback. Nines: `betMode: 'perpoint' | 'segments'` replaces `ninesMode`; old field retained for fallback. Skins: `carryover` type changed from `'yes'|'no'` string to `boolean`; migration shim documented. §5.5 new subsection: `GAME_CONFIGS` constant documented. §7.1 new migration rules added for all renamed fields. `payouts.js` and `SkinsTable.jsx` engine read sites updated accordingly._
_Changes in v2.6: §5.5 — Stroke Play `gameOpts` schema updated: `strokeMode` field added (`'single'`\|`'nassau'`); `betF`, `betB`, `bet18` per-segment override fields added. Stableford `gameOpts` schema updated: `stabBetMode` now explicitly includes `'single'`; `betF`, `betB`, `bet18` added. Nines `gameOpts` schema updated: `ninesMode` now includes `'single'`; `betF`, `betB`, `bet18` added._
§4 `restoreAutoWhen`→`restoreDotDefs`, `SPECIALS_DEF`→`DOTS_DEF`. §5.5 `gameOpts.Specials`→
`gameOpts.Dots`. §5.9 renamed "Dots" — all field names updated (`dots`, `dotEntries`,
`dotsPlayers`); `pts`→`value`; `DotDef` shape updated; companion key updated to
`team_dot_for`; `restoreDotDefs` reference. §6 history record — `specials_players`→
`dots_players`, `specials`→`dots`, `spec_entries`→`dot_entries`. §8.3 ScoreGrid
references updated. §10 `buildPayoutArgs` shape updated — `specialsPlayers/specials/
specEntries`→`dotsPlayers/dots/dotEntries`. §11 invariant 6 updated for `restoreDotDefs`
and `DOTS_DEF`._
_Changes in v2.4: §4 — `TotalsCard` permitted call updated from `scoreForMode()` to `escTotal()` (10-A);
`MatchNassauTable` `isLandscape` prop noted (10-B). §8.2 — `ScorecardPage` holds `isLandscape`.
§8.3 — `ScoreGrid` accepts `isLandscape` as optional prop. §8.6 (new) — `App.jsx` landscape width wrapper._
_Changes in v2.3: §10 — `buildPayoutArgs` extracted from `App.jsx`
to `services/roundUtils.js`; updated sole-location rule accordingly._
_Changes in v2.2: Closes Specials Contract G-10. §5.5 `gameOpts.Specials` — replaced
`teamScoring: boolean` with `teamMode: string`; documented all three fields with full
semantics. §5.9 Specials — added `Special` object shape (including `multi` field);
updated `specEntries` value type from boolean to integer count; documented backward
compatibility. §4 `restoreAutoWhen` — updated signature to include `multi` restoration.
§7.1 — added `teamScoring → teamMode` migration note and `specEntries` integer
migration note. §11 invariant 6 updated to reflect integer values and `multi`
restoration._
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._

---

## 1. Storage Keys

Defined in `storage.js` as the `SK` object. Never hardcode key strings.

| Constant | Key | Contains |
|---|---|---|
| `SK.players` | `golf_players_v4` | Player library array |
| `SK.courses` | `golf_courses_v4` | Course library array |
| `SK.rounds` | `golf_rounds_v4` | Completed round history array |
| `SK.activeRound` | `golf_active_v4` | Live active round blob |
| `SK.roundSetup` | `golf_round_setup_v4` | NewRoundPage draft state |

Version suffix (`_v4`) must be incremented if a schema change is
destructively incompatible with existing stored data.

**App preferences exception (v3.8):** Keys that store app-level UI
preferences (not entity data) are direct string keys, not part of `SK`.
They are owned by the component that uses them and are read/written
through that component's helpers, never directly elsewhere.

| Key (string literal) | Contains | Owner |
|---|---|---|
| `moneyListRange` | Money List range filter pref (Home page) | `components/RangePicker.jsx` |
| `historyRange` | Round history range filter pref (History page) | `components/RangePicker.jsx` |

### 1.1 Range pref shape

Both `moneyListRange` and `historyRange` use the same shape:

```js
{
  range:        '7days' | 'mtd' | 'ytd' | 'all' | 'custom',
  customStart:  { day: number, month: number, year: number } | null,
  customEnd:    { day: number, month: number, year: number } | null,
}
```

- `range` — required. One of five values. Default on first read: `'ytd'`.
- `customStart` / `customEnd` — required only when `range === 'custom'`.
  Both must be set for the custom range to take effect; otherwise the
  filter falls through to no-op (returns all items).
- `month` is 1-indexed (1 = January, 12 = December).
- Read via `loadRangePref(key)`; write via `saveRangePref(pref, key)`.
  Both exported from `RangePicker.jsx` and accept the storage key as
  their final argument so each consumer page operates on its own pref.
  Home and History intentionally maintain independent filter state.
- No file outside `RangePicker.jsx` reads or writes either key directly,
  with the single exception of `HistoryPage.applyImport` (see §1.2).

### 1.2 Backup payload `settings` field (v3.8)

Backup JSON exports gain a top-level `settings` field carrying app
preferences. Current shape:

```js
{
  exportedAt:  string,    // ISO timestamp
  appVersion:  string,    // 'golf-scorekeeper-v4'
  players:     Player[],
  courses:     Course[],
  rounds:      Round[],
  settings: {
    moneyListRange: { range, customStart, customEnd } | null,
    historyRange:   { range, customStart, customEnd } | null,
  },
}
```

Owned by two paths: `services/exportUtils.js` `triggerExport` (auto-save
export) and `pages/HistoryPage.jsx` `handleExport` (manual export). Both
must populate `settings.moneyListRange` and `settings.historyRange`
from `ls.get(...)`.

Import path: `HistoryPage.handleImportFile` MUST preserve `parsed.settings`
through to `applyImport`. `applyImport` writes each present key from
`parsed.settings` to localStorage. Settings are not subject to the
player/course conflict-resolution prompt — they overwrite silently.

Future preference keys follow the same pattern: add to `settings` field,
add a row in §1, document shape under §1.1 (or new sub-section if shape
differs).

---

## 2. ID Generation

All entity IDs are generated by `makeId(prefix)` in `storage.js`.

Format: `{prefix}_{timestamp}_{4-char random}`
Examples: `p_1714000000000_a3f2`, `c_1714000000001_b7e1`, `r_1714000000002_c9d3`

| Entity | Prefix |
|---|---|
| Player | `p` |
| Course | `c` |
| Round | `r` |
| Match | `m` (generated in NewRoundPage at match creation) |

IDs are stable — never regenerated after initial creation.

---

## 3. The Canonical Rule

> All scoring, match outcomes, press logic, and payout calculations must
> originate from functions in `engine/`. No UI component, display-layer
> utility, or service may independently compute these values.

`scorecardUtils.js` may interpret engine output for display purposes
but may not reimplement or duplicate engine logic. If logic produces a
scoring result, it belongs in the engine.

`ScorecardPage.jsx` is the state owner. It orchestrates and passes
props. It does not compute match state, scoring outcomes, or press
triggers.

---

## 4. Architecture Boundary

All code in this system belongs to exactly one layer. Crossing layer
boundaries is a contract violation.

| Layer | Files | Role |
|---|---|---|
| Engine | `games.js`, `payouts.js`, `handicap.js` | Computes all scoring outcomes. Single source of truth. |
| Display logic | `scorecardUtils.js` | Interprets and formats engine output for UI. No scoring math. |
| State owner | `ScorecardPage.jsx` | Holds activeRound state. Orchestrates. Does not compute. |
| UI components | `tables/`, `scorecard/` | Renders props. Input handling. No game logic. |
| Services | `roundLib.js`, `playerLib.js`, `courseLib.js` | Persistence and schema conversion only. |

### Layer rules

- Engine functions are called only by `ScorecardPage.jsx`, `ScoreGrid.jsx`,
  `scorecardUtils.js` (Category 2 derived state builders), or UI components
  where the call is a direct display-only transformation with no game logic
  (e.g. `scoreForMode` to derive a net score for display)
- `scorecardUtils.js` interprets engine output; it never reimplements it
- UI components receive computed data via props wherever practical; when a
  component calls an engine function directly, the call must be a simple
  primitive transformation (no match state, no press logic, no payout math)
- State mutations are initiated only by `ScorecardPage.jsx` via the
  setters defined in §8.1; child components request mutations via
  callback props, they do not mutate state directly

### Permitted direct engine calls in UI components

The following direct engine calls in UI components are explicitly permitted:

| Component | Call | Reason |
|---|---|---|
| `ScoreGrid.jsx` | `scoreForMode()` | Net score display in grid totals |
| `ScoreGrid.jsx` | `strokesForMode()` | Handicap dot count (via `PopDots`) |
| `TotalsCard.jsx` | `escTotal()` | Adjusted Gross Score (ESC) for GHIN posting — display only. **Only called for full 18-hole rounds** (`roundStartHole = 0, roundNumHoles = 18`). ESC is omitted for partial rounds (PartialGameContract §1A.8). |
| `MatchNassauTable.jsx` | `scoreForMode()` | Hole winner comparison for display |
| `NinesTable.jsx` | `scoreForMode()` | Net score per hole for display |
| `StablefordTable.jsx` | `stabPts()` | Stableford points per hole for display |
| `StrokePlayTable.jsx` | `scoreForMode()` | Net score vs par for display |
| `SixesTable.jsx` | `scoreForMode()` | Net score per hole for display |

Any call not on this list requires justification before being added to a
UI component. Match state computation, press trigger evaluation, and
payout math are never permitted in UI components regardless of framing.

### scorecardUtils.js — two categories, strict boundary

**Category 1 — Pure formatters** (no engine dependency):
- Input: primitive values. Output: display strings or style tokens.

**Category 2 — Derived state builders** (call engine, interpret output):
- Input: raw state. Output: display-ready data structures.
- Must derive from engine output; must not recompute scoring logic.

**Prohibited in scorecardUtils.js:**
- Any function that produces a scoring result independently
- Reimplementing or duplicating engine logic
- The test: if this function's output would change when engine rules
  change, the logic belongs in the engine, not here

### scorecardUtils.js — key function signatures

These functions must conform to the following signatures and output
conventions. Implementations may not deviate from the output formats
specified here — consistent formatting across all tables depends on it.

**`fmtLead(lead, matchOver, holesLeft)`**
- `lead`: signed integer (positive = p1/teamA leading)
- `matchOver`: boolean
- `holesLeft`: integer
- Returns: string in one of three formats only:
  - `"AS"` — when lead === 0
  - `"{n}UP"` — when lead !== 0 and match is not closed (e.g. `"3UP"`)
  - `"{n}&{h}"` — when match is closed (e.g. `"3&2"`, meaning 3up with 2 to play)
- Never returns null; returns `"—"` only when no holes have been played

**`buildLeadState(holeWinFn, runHoles)`**
- `holeWinFn`: function `(holeIndex) → 1 | 2 | 'half' | null`
  (1 = p1/teamA wins hole, 2 = p2/teamB wins hole, 'half' = tie, null = not yet played)
- `runHoles`: array of 0-based hole indices this bet covers
- Returns: object keyed by hole index → `{ lead, matchOver, holesLeft }`
- Must derive exclusively from `holeWinFn` output; must not compute
  hole winners independently

**`isNassauMatch(matchDef)`**
- `matchDef`: one entry from `activeRound.matches[]`
- Returns: boolean — `true` if `betFront > 0 || betBack > 0`
- This is the single authoritative test for Nassau vs. straight Match Play

**`restoreDotDefs(dots)`**
- `dots`: array of DotDef objects (from state, post-serialization)
- For each dot: re-attaches `autoWhen` from `DOTS_DEF` (for built-in auto dots);
  restores `multi` from `DOTS_DEF` for built-ins if absent, or defaults to `true`
  for custom dots (`c_` prefix) if absent; migrates `pts` → `value` if `value` is absent
- Returns: new array with restored functions and fields (non-mutating)
- Must be called before any code path that depends on `autoWhen`, `multi`, or `value`
- Source of truth for `autoWhen`, `multi`, and `value` is always `DOTS_DEF` in `games.js`
- Backward-compat alias `restoreAutoWhen` retained in `scorecardUtils.js` for old callers

---

## 5. activeRound Blob Schema

The live round state. Stored at `SK.activeRound`. Owned by
`ScorecardPage.jsx`. Written on every scoring change via `useEffect`.

### 5.1 Round identity

| Field | Type | Notes |
|---|---|---|
| `roundId` | `string \| null` | Set only when editing a saved round; null for new rounds |
| `roundDate` | `string` | ISO date string `YYYY-MM-DD` |
| `roundStartHole` | `number \| undefined` | 0-based start hole index. `undefined` = legacy full round; callers apply `?? 0` at read time. Default: 0 (hole 1). |
| `roundNumHoles` | `number \| undefined` | Number of holes played. `undefined` = legacy full round; callers apply `?? 18` at read time. Default: 18. |
| `gameRanges` | `{ [gameKey: string]: { startHole: number, endHole: number } } \| undefined` | Per-game custom hole ranges (13-C.3). Keys are either game names (`'Stroke Play'`, `'Skins'`, `'Stableford'`, `'Nines'`, `'Sixes'`) OR `matchDef.id` for individual Match instances. Each entry must satisfy `roundStartHole ≤ startHole < endHole ≤ roundEndHole`. Absent / `undefined` / `{}` = all games inherit the round range. Persistence: `roundLib` round-trips via `game_ranges` snake-case field on history records (PartialGameContract §4.3). |

`roundEndHole = roundStartHole + roundNumHoles - 1` is **always derived** and **never stored**
(PartialGameContract §1A.3, invariant #17). Callers must compute it fresh from the two stored
fields. Storing `roundEndHole` directly is a contract violation.

The scores array is **always 18 slots** regardless of round length. `roundStartHole` and
`roundNumHoles` control which slots are displayed and computed — they do not affect the
array structure.

**`gameRanges` resolution:** the `payouts.js` `rangeFor(key, gameRanges, roundStart, roundEnd)`
helper resolves a per-game range. When the key is missing or the entry is invalid
(non-integer bounds, out-of-round, inverted), the resolved range falls back to
`[roundStartHole, roundEndHole]`. This is the canonical lookup pattern; matches the same
logic in `roundUtils.computePerMatchPayouts::resolveMatchRange`.

### 5.2 Course

| Field | Type | Notes |
|---|---|---|
| `course` | `object \| null` | Full course snapshot from courseLib |
| `frontNine` | `string` | Nine name (e.g. `"Front"`) |
| `backNine` | `string` | Nine name (e.g. `"Back"`) |
| `selectedTee` | `string` | Tee name matching a tee in `course.tees[]` |
| `pars` | `number[18]` | Par per hole |
| `hcps` | `number[18]` | Stroke index per hole (1–18) |

**Course library record** (stored in `golf_courses_v4` via `courseLib`):
```js
{
  id:              string,
  name:            string,
  location?:       string,
  nines:           NineRecord[],
  tees:            TeeRecord[],
  nineComboNames?: string[],   // 3-nine courses only
  starred?:        boolean,    // absent = false; sorts above non-starred in courseLib.list()
}
```

- `starred` — library-only. Not copied to round state. Absent = `false`. Starred courses sort before non-starred; A→Z within each tier. Surfaces in `courseLib.list()` and all course-picker UIs.

### 5.3 Players

| Field | Type | Notes |
|---|---|---|
| `activePlayers` | `Player[]` | Ordered array; index = player position throughout |
| `courseHcps` | `number[]` | Course handicap per player; computed once at round start |
| `minCourseHcp` | `number` | Minimum value in `courseHcps`; used for Net Off Low |

**Player object:**
```js
{
  id:           string,   // stable ID from playerLib
  name:         string,
  gender:       string,   // 'M' | 'F' | ''
  ghin:         string,   // handicap index as string, e.g. "8.4"
  courseHcpVal: number | null,  // override; null = compute from ghin
  siArray:      number[18],     // per-player stroke index — required at round-start (v2.0)
}
```

**`siArray` (v2.0 — see Handicap_Contract §2.8 / inv 21):**
- Built once at round-start by `buildPlayerSI(player, layout)`.
- 18 integers, each in `[1, 18]`, no duplicates.
- For female players on a course with `handicapsWomen`, equals `layout.hcpsWomen`.
- For all other players, equals `layout.hcps` (men's SI).
- Engines read `players[pi].siArray[h]` for stroke allocation in every game.
- Never null and never absent on a started round.
- Not serialized to history — `roundLib.toActiveRound` rebuilds it on reload.

Player order in `activePlayers` is set at round start and never
changes. All score arrays, courseHcps, and player index references
throughout the app use this order.

**Player library record** (stored in `golf_players_v4` via `playerLib`):
```js
{
  id:            string,   // stable ID
  name:          string,
  gender:        string,   // 'M' | 'F' | ''
  ghin:          string,   // handicap index as string
  email?:        string,
  phone?:        string,
  starred?:      boolean,  // absent = false; sorts above non-starred in playerLib.list()
  inMoneyLists?: boolean,  // absent = true; included in Money List on Home page
}
```

- `starred` — library-only. Not copied into `activePlayers` snapshot. Absent = `false`. Starred players sort before non-starred; last-name order preserved within each group. Surfaces in `playerLib.list()` and all player-picker UIs.
- `inMoneyLists` — library-only. Not copied into `activePlayers` snapshot. Absent = `true`. Controls whether a player's cumulative winnings appear on the Home page Money List. Toggle set on Players page only.

### 5.4 Games

| Field | Type | Notes |
|---|---|---|
| `activeGames` | `string[]` | Subset of `ALL_GAMES`; order controls display |
| `gameOpts` | `object` | Keyed by game name; see §5.5 |

`ALL_GAMES` (source of truth in `games.js`):
```js
['Stroke Play', 'Skins', 'Match / Nassau', 'Stableford', 'Nines', 'Sixes', 'Dots']
```

### 5.5 gameOpts shape per game

**Stroke Play:**
```js
{
  grossNetNOL: 'net' | 'gross' | 'netofflow',  // default 'gross'
  bet:         number,                           // total-mode amount; segments-mode per-segment fallback
  betMode:     'total' | 'segments',            // default 'total'. Canonical field as of v2.7.
                                                 // 'total'    = single 18-hole winner (formerly 'single')
                                                 // 'segments' = F9/B9/18h settle independently (formerly 'nassau')
  // Legacy fallback: strokeMode retained for backward compat. Engine reads:
  //   betMode ?? strokeMode ?? 'total'
  // Old value mapping: 'single' → 'total', 'nassau' → 'segments' (migration shim §7.1)
  betF:        number,                           // segments F9 override; 0/absent → bet
  betB:        number,                           // segments B9 override; 0/absent → bet
  bet18:       number,                           // segments 18h override; 0/absent → bet
}
```

**Skins:**
```js
{
  mode:        'perSkin' | 'pot',               // default 'perSkin' when absent
  grossNetNOL: 'net' | 'gross' | 'netofflow',
  bet:         number,
  carryover:   boolean,                         // default true. true = carryover enabled.
                                                // Legacy: 'yes' → true, 'no' → false (migration shim §7.1)
}
```

**Match / Nassau:** (no top-level opts; all config lives in `matches[]`)
```js
{}
```

**Stableford:**
```js
{
  grossNetNOL: 'net' | 'gross' | 'netofflow',      // default 'net'
  bet:         number,                               // per-point/segments per-segment fallback
  betMode:     'perpoint' | 'total' | 'segments',   // default 'perpoint'. Canonical field as of v2.7.
                                                     // 'perpoint' = pairwise point-differential (default)
                                                     // 'total'    = highest 18h pts wins; tied winners split pot
                                                     // 'segments' = F9/B9/18h settle independently
  // Legacy fallback: stabBetMode retained for backward compat. Engine reads:
  //   betMode ?? stabBetMode ?? 'perpoint'
  // Old value mapping: 'nassau' -> 'segments', 'single' -> 'perpoint' (migration shim §7.1)
  // Any value other than 'perpoint', 'total', or 'segments' falls to 'total' behavior.
  stabTable:   object | null,                        // custom points table; null = use DEFAULT_STAB
                                                     // valid keys: '-3' through '4' (8 keys, all strings)
  betF:        number,                               // segments F9 override; 0/absent -> bet
  betB:        number,                               // segments B9 override; 0/absent -> bet
  bet18:       number,                               // segments 18h override; 0/absent -> bet
  format:      'individual' | 'team',                // default 'individual'. Read: opts.format ?? 'individual'
  teamA:       number[],                             // 2 player indices; [] when individual mode
  teamB:       number[],                             // 2 player indices; [] when individual mode
  scoring:     'cumulative' | 'bestball',            // team hole-scoring rule; default 'cumulative'
                                                     // Read: opts.scoring ?? 'cumulative'
                                                     // 'cumulative' = sum of both teammates' points per hole
                                                     // 'bestball'   = better of two teammates' points per hole
                                                     // Ignored in individual mode.
}
```

> **`betMode` — three explicit values as of v3.1:** `'total'` is now a named value with
> split-pot semantics (tied winners share the pot from losers equally). The old unnamed
> else-branch (sole-winner) is superseded. Legacy rounds reaching the else-branch had
> values already migrated to `'perpoint'` or `'segments'` by the existing `roundLib` shim.

> **`stabTable` key range expanded in v3.1:** Key `'4'` (condor, 4 under par) added to
> `DEFAULT_STAB` with default value 6. Clamp in `stabPts` expanded from `[-3, 3]` to
> `[-3, 4]`. All 8 keys (`'-3'` through `'4'`) are customizable in the UI points table.
> Old custom tables lacking key `'4'` are safe — missing keys return 0 (condor scores 0
> until the round is reconfigured with the new key).

> **Team fields — no migration shim needed:** `format`, `teamA`, `teamB`, `scoring` are
> absent in all rounds saved before v3.1. Engine reads `opts.format ?? 'individual'` and
> `opts.scoring ?? 'cumulative'` — safe defaults. No `migrateRecord` entry required.

> **Default changed in v2.7:** Default `betMode` is `'perpoint'` (was `'nassau'` via `stabBetMode`).

> **Removed field:** `nassauMode: boolean` was previously documented here.
> Confirmed dead code, removed in v2.0. Old stored records are harmless.
> See Stableford Contract §14 G-1.

**Nines:**
```js
{
  grossNetNOL: 'net' | 'gross' | 'netofflow',  // default 'net'
  bet:         number,                           // per-point/segments per-segment fallback
  betMode:     'perpoint' | 'total' | 'segments',  // default 'perpoint'. Canonical field as of v2.7.
                                                 // 'perpoint'  = pairwise differential over 18h (default)
                                                 // 'total'     = highest total wins pot; tied winners split equally
                                                 // 'segments'  = F9/B9/18h settle independently (formerly 'nassau')
  // Legacy fallback: ninesMode retained for backward compat. Engine reads:
  //   betMode ?? ninesMode ?? 'perpoint'
  // Old value mapping: 'nassau' → 'segments', 'single' → 'perpoint' (migration shim §7.1)
  blitz:       boolean,                         // default false; enables 9-point sweep on 2+ stroke margin
  betF:        number,                          // segments F9 override; 0/absent → bet
  betB:        number,                          // segments B9 override; 0/absent → bet
  bet18:       number,                          // segments 18h override; 0/absent → bet
}
```

> **`betMode` semantics:**
> - `'perpoint'` — 18-hole point totals settle pairwise; `bet × differential` per pair.
> - `'segments'` — F9, B9, and 18-hole totals each settle independently; per-segment bet per pair per segment won (strict win — tied pair = no movement).
>
> See Nines Contract §4.1–§4.2 and §5.3–§5.4 for full payout mechanics.

**Sixes:**
```js
{
  grossNetNOL: 'net' | 'gross' | 'netofflow',
  bet:         number,
  scoring:     'none' | 'second' | 'cumulative' | 'half',
  // 'none'       = Best Ball (default)
  // 'second'     = 2nd Ball Breaks Tie
  // 'cumulative' = Cumulative Score (sum both teammates' net scores)
  // 'half'       = LEGACY (half-point on tied best-ball). Retained for back-compat with
  //                rounds saved pre-v2.8. Not offered in UI as of session 11-I.2.
}
```

**Dots:**
```js
{
  grossNetNOL: 'gross' | 'net',  // default 'gross'. Controls score used for auto-mark
                                  // threshold (ace/condor/albatross/eagle/birdie).
                                  // 'netofflow' intentionally excluded — see Dots Contract §3.2.
                                  // Also drives handicap dot display when Dots is the only
                                  // active game (ScorecardPage.deriveDotModes reads this field).
  bet:         number,           // dollars per dot-value unit of pairwise differential
  teamMode:    'none' | 'Sixes' | 'Match:{matchId}',
                                  // 'none'            (default) = individual mode.
                                  // 'Sixes'           = teams follow Sixes 3×6 rotation.
                                  // 'Match:{matchId}' = teams follow the specific team matchDef
                                  //                     whose id === matchId.
                                  // matchId is the stable match ID (e.g. 'm_1714000000_a3f2').
                                  // If the referenced match is deleted, UI resets teamMode to 'none'.
}
```

> **`teamMode` semantics:**
> In team mode, when a player earns dots on a hole, their current teammate
> auto-receives Team dots equal to the total count of the earner's non-team
> dots on that hole (anti-circular: team entries excluded from the sum).
> Payout is pairwise differential in both individual and team modes — team mode
> only changes how dot counts are accumulated. See Dots Contract §5.3 and §7.3.
>
> **Match instance labels** are derived from the match's current position in
> `matches[]` at render time — `String.fromCharCode(65 + index)` — and are
> **never stored** on the match object. When a match is removed, surviving
> matches renumber from their new indices. The Dots dropdown label (e.g.
> "Match A Teams") is always derived at render time from current array position.
> The stored `teamMode` value references the match by stable ID, not by label,
> so the correct match is always resolved even after renumbering.
>
> **Migration notes:**
> - Prior versions stored `teamScoring: boolean` instead of `teamMode: string`.
>   When reading a round with `teamScoring: true` and no `teamMode`, treat as
>   `teamMode: 'Sixes'`. When `teamScoring: false` or absent, treat as `teamMode: 'none'`.
> - Prior versions (pre-11-J) stored `teamMode: 'Match'` (no matchId suffix).
>   `migrateRecord` converts this to `'Match:{firstTeamMatchId}'` on read.
>   If no team-format match exists, converts to `'none'`. See §7.1.
> - `gameOpts.Specials` is read as a fallback when `gameOpts.Dots` is absent (pre-v2.0 rounds).
>   `migrateRecord` moves `gameOpts.Specials` → `gameOpts.Dots` on read.

### 5.5a GAME_CONFIGS constant

A static read-only constant defined in `NewRoundPage.jsx` (or a co-located
constants file). Its full shape is specified in `NewRoundPage_Design_Spec.md §6`.

**Rules — non-negotiable:**
- `GAME_CONFIGS` is **never stored** in `gameOpts`, `activeRound`,
  `SK.roundSetup`, or any other persisted state.
- Used exclusively by the setup UI to determine which components and
  modes to render for each game.
- `betType` within `GAME_CONFIGS` is a display-routing hint only — it
  determines which component renders, not any stored value.
- `GAME_CONFIGS` must never be mutated at runtime.
- New games (e.g. Wolf) are added by inserting a new key. No existing
  entry needs to change.

### 5.6 Scores

| Field | Type | Notes |
|---|---|---|
| `scores` | `Array[18][N]` | `scores[hole][playerIdx]`; values are `''`, a positive integer string (e.g. `'4'`), or `'X'` (player picked up) |

**Valid `scores[h][i]` values:** `''` (unscored) | positive integer string | `'X'` (picked up).
`'X'` is the canonical stored value for a pickup. The computed display string `'NX'` is never stored.
`xGrossScore()` is called at render time and in engine calculations to derive the numeric value for `'X'`.
`'X'` must never be sanitized to `''` during score normalization.

### 5.7 Match definitions

| Field | Type | Notes |
|---|---|---|
| `matches` | `MatchDef[]` | One entry per configured match |

**MatchDef object:**
```js
{
  id:          string,              // stable match ID
  format:      'individual' | 'team',
  p1:          number,              // player index (individual only)
  p2:          number,              // player index (individual only)
  teamA:       number[],            // player indices (team only)
  teamB:       number[],            // player indices (team only)
  grossNetNOL: 'net' | 'gross' | 'netofflow',
  scoring:     'none' | 'second' | 'cumulative' | 'half',
  // team format: 'none' = Best Ball; 'second' = 2nd Ball Breaks Tie;
  //              'cumulative' = Cumulative Score; 'half' = LEGACY (back-compat only).
  // individual format: always 'none'; UI does not expose scoring dropdown for individual.
  betFront:    number,
  betBack:     number,
  betOverall:  number,
  autoPressF:  'none' | '1'–'5',   // Front auto-press threshold
  autoPressB:  'none' | '1'–'5',   // Back auto-press threshold
  autoPressO:  'none' | '1'–'5',   // Overall auto-press threshold
}
```

### 5.8 Player subsets

| Field | Type | Notes |
|---|---|---|
| `strokePlayPlayers` | `number[]` | Player indices; empty = all players |
| `skinsPlayers` | `number[]` | Player indices; empty = all players |
| `stablefordPlayers` | `number[]` | Player indices; empty = all players |
| `ninesPlayers` | `number[]` | Player indices; must be exactly 3 for Nines to score. **Empty array (`[]`) means no players selected — not "all players".** Nines is skipped entirely if this resolves to fewer than 3 valid indices. In 3-player rounds, falls back to `[0,1,2]`; in 4+ player rounds with no subset set, the payout block is skipped. See Nines Contract §2.2. |
| `sixesTeams` | `[{a,b}, {a,b}]` | Two fixed team pairs for Sixes; third pair auto-derived |
| `sixesPlayers` | `number[]` | **DEFERRED — 5-player support only.** 4 player indices participating in Sixes. Empty = all players (current 4-player-round behavior). When populated, Sixes payout block uses `subsetMin()` per segment. See Sixes Contract §14. Currently a passthrough; `NewRoundPage` does not expose a picker. |
| `dotsPlayers` | `number[]` | Player indices; empty = all players |

All subset fields default to `[]` when absent. For most games, the engine
interprets `[]` as "all players participate" — non-participants are excluded
from scoring and payouts for that game but still appear in `bank` at 0.
**Exception: `ninesPlayers`.** An empty `[]` means no players selected.
Nines requires exactly 3 indices; an empty or short array skips the game
entirely (in 4+ player rounds) or falls back to `[0,1,2]` (3-player rounds only).

### 5.9 Dots

| Field | Type | Notes |
|---|---|---|
| `dots` | `DotDef[]` | Configured dot definitions for this round; includes built-ins and any custom dots |
| `dotEntries` | `object` | Keyed `"{hole}_{pi}_{dotId}"` → positive integer (count) |

**`DotDef` object shape:**
```js
{
  id:       string,    // built-ins: 'ace','condor','albatross','eagle','birdie',
                       //            'sandy','polie','kp','chippie','team'
                       // custom: 'c_${timestamp}' (always starts with 'c_')
  name:     string,    // display name
  value:    number,    // dollar value per dot occurrence; 1–10
                       // formerly 'pts' — read sites use sp.value ?? sp.pts ?? 1
  enabled:  boolean,   // whether active for this round
  auto:     boolean,   // true = auto-marked from score (scoring specials only)
  multi:    boolean,   // true = multiple can be earned on one hole (sandy, kp, team, custom)
  autoWhen: function,  // (effectiveScore, par) => boolean; auto dots only
                       // STRIPPED BY JSON — restored at read time via restoreDotDefs()
}
```

**Scoring specials are mutually exclusive:** Ace, condor, albatross, eagle, birdie — only
the highest-priority one fires per hole per player. Priority: ace > condor > albatross >
eagle > birdie. See Dots Contract §4.1.

**`multi` field:** Controls popup interaction only — not payout math. `multi:true`
dots show an increment counter in the popup (tap tile = increment, tap count = decrement);
`multi:false` dots toggle on/off.
If absent on old rounds, `restoreDotDefs` defaults built-ins from `DOTS_DEF`
and custom dots to `true`.

**`dotEntries` values are positive integers (count):**
Each entry records how many times a dot was earned. Absent key = not earned.
Values of `0` or `false` must not be written.

**Backward compatibility:** Old rounds stored `true` instead of an integer.
All read sites use the `entryCount` helper:
```js
const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);
```

**Team companion entry key format:**
```
"${hole}_${partnerIndex}_team_dot_for_${earnerIndex}"
```
Value = integer count of all non-team dots the earner earned on that hole.
This key format is immutable — five files parse it positionally. See Dots
Contract §5.1 invariant.

`autoWhen` on dots is always `null` in stored state. `multi` may be absent
in pre-v2.2 records. `value` may be absent in pre-v2.0 records (stored as `pts`).
All three are restored via `restoreDotDefs(dots)` at every read site before use.
See §11 invariant 6.

**Team companion entry key format:**
```
"${hole}_${partnerIndex}_team_special_for_${earnerIndex}"
```
Value = integer count of all non-team dots the earner earned on that hole.
This key format is immutable — five files parse it positionally. See Dots
Contract §5.1 invariant.

`autoWhen` on dots is always `null` in stored state. `multi` may be absent
in pre-v2.2 records. Both are restored via `restoreDotDefs(dots)` at every
read site before use. See §11 invariant 6.

### 5.10 Presses

| Field | Type | Notes |
|---|---|---|
| `manualPresses` | `object` | Keyed `"Match:{matchId}:{Front\|Back\|Overall}"` → `number[]` |

Values are flat sorted arrays of hole indices (0-based). See the
Nassau/Match Contract §4 for the full press schema. The contract
interpretation there must remain aligned.

Press outcomes (lead, status, winnings) are **never stored**. Always
computed by the engine from scores + `manualPresses`.

### 5.11 Results (computed fields, written at save time)

| Field | Type | Notes |
|---|---|---|
| `breakdown` | `BreakdownEntry[]` | Per-game result rows; computed by `computePayouts()` |
| `bank` | `object` | Keyed by player name → net dollar amount |

These fields are computed fresh by `computePayouts()` when the user
navigates to Results, and written to `activeRound` before saving.
They are **never used as inputs** to engine functions.

### 5.12 Partial-round / early-departure fields (13-C.6 / 13-C.7 / v2.0)

| Field | Type | Notes |
|---|---|---|
| `earlyDepartureOpts` | `{ [playerIdx: number]: { departureHole, eventOrder, gameResolutions } } \| undefined` | Per-player departure data. Each entry records one departure event. `departureHole` is the 0-based last hole the departed player scored. `eventOrder` (added in v2.0 of PartialGameContract) is the 0-based chronological position among all departure events; v1.x records lacking this field are derived at read-time by sorting on `departureHole` ascending. `gameResolutions` is a SegmentedResolution map per game (PartialGameContract §4.2). Persistence: `roundLib` round-trips via `early_departure_opts` snake-case field on history records. Schema source-of-truth: PartialGameContract §4.1. |
| `earlyEndOpts` | `{ [gameKey: string]: SegmentedResolution } \| undefined` | Group-stop game resolutions (Scenario B per PartialGameContract §5.4). Set ONLY when no player reaches `roundEndHole` (every player is Early-departure classified). Written by the LAST event in the sequenced resolver chain per PartialGameContract §5.4.4 / §14 invariant 20. Persistence: `roundLib` round-trips via `early_end_opts` snake-case field. |
| `lastCompletedHole` | `number \| undefined` | Group-stop hole index (Scenario B). 0-based. Defaults to `roundEndHole` when absent (no group stop occurred — at least one player completed the round). Same write rule as `earlyEndOpts` — set together, by the last event in the chain. Persistence: `roundLib` round-trips via `last_completed_hole` snake-case field. |

**Schema source-of-truth:** `PartialGameContract.md` §4.1 is authoritative
for the full shape and semantics of these fields. This section is a
cross-reference for consumers searching App_Data_Model for activeRound
fields. PartialGameContract §14 invariants 19-22 govern v2.0 sequenced-
event ordering, group-stop write rules, the engine departure data
guardrail (post-departure scores ignored at compute time regardless of
stored value), and Reorder Departures detection. Engine consumption of
these fields is specified in `Resolver_UI_Spec.md` §4 and ships in 13-C.8.

**Backward compatibility:** all three fields are optional. Legacy records
without them load as full rounds with no departures (read-side default
`?? null` / `?? {}` per PartialGameContract §13). v1.x `earlyDepartureOpts`
records loaded under PartialGameContract v2.0 derive `eventOrder` at
read-time — no data migration. See PartialGameContract §13.

---

## 6. History Record Schema

Stored in `SK.rounds` as an array of records, newest-first.
Produced by `roundLib.fromActiveRound()`. Read by `roundLib.list()`.

| Field | activeRound source | Notes |
|---|---|---|
| `id` | `makeId('r')` | Generated at save time |
| `date` | `roundDate` | |
| `course_name` | `course.name` | |
| `course_snapshot` | `course` | Full course object |
| `front_nine` | `frontNine` | |
| `back_nine` | `backNine` | |
| `selected_tee` | `selectedTee` | |
| `pars` | `pars` | |
| `hcps` | `hcps` | |
| `players` | `activePlayers` | Snapshot; see §5.3 for shape |
| `course_hcps` | `courseHcps` | |
| `min_course_hcp` | `minCourseHcp` | |
| `active_games` | `activeGames` | |
| `game_opts` | `gameOpts` | |
| `matches` | `matches` | |
| `stroke_play_players` | `strokePlayPlayers` | |
| `skins_players` | `skinsPlayers` | |
| `stableford_players` | `stablefordPlayers` | |
| `nines_players` | `ninesPlayers` | |
| `sixes_teams` | `sixesTeams` | |
| `sixes_players` | `sixesPlayers` | |
| `dots_players` | `dotsPlayers` | |
| `dots` | `dots` | |
| `dot_entries` | `dotEntries` | |
| `manual_presses` | `manualPresses` | |
| `scores` | `scores` | |
| `breakdown` | `breakdown` | |
| `bank` | `bank` | |

---

## 7. Migration Rules

All history records are migrated on read via `migrateRecord()` in
`roundLib.js`. Migration is **non-destructive** — original data in
localStorage is never modified.

### 7.1 Current migrations

**Legacy match format (pre-`matches[]`):**
Old records used separate `match_pairs` and `nassau_pairs` arrays.
`migrateRecord()` converts these to the unified `matches[]` format on
read. Records with `matches !== undefined` are skipped (already migrated).

**Legacy auto-press fields:**
Old records may have `autoPress` / `autoPressN` on match definitions.
Engine reads `autoPressF/B/O` first; falls back to legacy fields.
No migration needed — handled transparently in the engine.

**`teamScoring` → `teamMode` in Dots gameOpts (v2.2):**
Old records may have `gameOpts.Specials.teamScoring: boolean` instead of
`gameOpts.Dots.teamMode: string`. All read sites carry a migration shim:
`teamScoring: true` → treat as `teamMode: 'Sixes'`; `teamScoring: false` or
absent → treat as `teamMode: 'none'`. Never write `teamScoring` in new code.

**Specials → Dots field rename (v2.0):** `migrateRecord()` maps all legacy
Specials identifiers to Dots identifiers on read: `activeGames 'Specials'→'Dots'`,
`gameOpts.Specials→gameOpts.Dots`, `specialsPlayers→dotsPlayers`,
`specials→dots`, `specEntries→dotEntries`, `spec_entries→dot_entries`,
`specials_players→dots_players`, `DotDef.pts→value`, and companion key segment
`team_special_for→team_dot_for`. KP name `'KP (par 3s)'→'KP'` also patched.
See Dots Contract §0 for the full shim list and removal workflow.

**`dotEntries` boolean → integer values (v2.2):**
Old rounds (pre-Dots Contract v1.1) stored `true` as the entry value.
New rounds store positive integers (count). All read sites use `entryCount`:
`const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);`
No migration required — the helper handles both formats transparently.

**`nassauMode` in Stableford gameOpts (v2.0):**
Old records may have `gameOpts.Stableford.nassauMode` set to `true` or `false`.
This field has been removed from the schema. Because it was never used in any
conditional logic, its presence in old records has no behavioral effect — the
engine ignores unknown fields. No code migration required.

**`betMode` field renames — Stroke Play, Stableford, Nines (v2.7):**
Three games previously used game-specific field names for the same concept.
`migrateRecord()` copies the old field value to `betMode` on read (non-destructive):

| Game | Old field | Old values | New field | New values |
|---|---|---|---|---|
| Stroke Play | `strokeMode` | `'single'` → `'total'`; `'nassau'` → `'segments'` | `betMode` | `'total'` \| `'segments'` |
| Stableford | `stabBetMode` | `'nassau'` → `'segments'`; `'single'` → `'perpoint'` | `betMode` | `'perpoint'` \| `'segments'` |
| Nines | `ninesMode` | `'nassau'` → `'segments'`; `'single'` → `'perpoint'` | `betMode` | `'perpoint'` \| `'segments'` |

Migration rule: if `betMode` is absent and the old field is present, map the old
value to the new vocabulary and write `betMode` onto the record. If `betMode` is
already present, skip. Engine read sites use the fallback chain
`opts.betMode ?? opts.{oldField} ?? {default}` so old rounds work without migration.

**`carryover` type change — Skins (v2.7):**
`gameOpts.Skins.carryover` was previously stored as `'yes' | 'no'` string.
New rounds store `boolean`. `migrateRecord()` normalizes on read:
`'yes'` → `true`, `'no'` → `false`, absent → `true` (default).
Engine read site: `gameOpts.Skins?.carryover === false ? false : true`
handles `true`, `false`, `'yes'`, `'no'`, and absent uniformly.
`SkinsTable.jsx` read site updated to `opts?.carryover !== false`.

**`scoring` → `grossNetNOL` field rename — all games (v2.9):**
`migrateRecord()` copies the old field value to `grossNetNOL` on read (non-destructive).
Applied to each game's `gameOpts` entry and to every `matchDef` in `matches[]`.

| Object | Old field | New field |
|---|---|---|
| `gameOpts['Stroke Play']` | `scoring` | `grossNetNOL` |
| `gameOpts.Skins` | `scoring` | `grossNetNOL` |
| `gameOpts.Stableford` | `scoring` | `grossNetNOL` |
| `gameOpts.Nines` | `scoring` | `grossNetNOL` |
| `gameOpts.Sixes` | `scoring` | `grossNetNOL` |
| `gameOpts.Dots` | `scoring` | `grossNetNOL` |
| `matches[n]` | `scoring` | `grossNetNOL` |

Migration rule: if `grossNetNOL` is absent and `scoring` is present on that object, copy `scoring` value → `grossNetNOL`. Value vocabulary is carried unchanged (`'gross'`\|`'net'`\|`'netofflow'`). Engine read sites use the fallback chain `opts.grossNetNOL ?? opts.scoring ?? {default}` so unmigrated rounds work without migration.

**`tiebreak` → `scoring` field rename — Sixes and MatchDef (v2.9):**
`migrateRecord()` copies the old field value to `scoring` on read (non-destructive).

| Object | Old field | New field | Value mapping |
|---|---|---|---|
| `gameOpts.Sixes` | `tiebreak` | `scoring` | Same values; `'half'` remapped to `'none'` |
| `matches[n]` | `tiebreak` | `scoring` | Same values; `'half'` remapped to `'none'` |

Migration rule: if `scoring` is absent and `tiebreak` is present on that object, copy `tiebreak` → `scoring`; if value is `'half'`, remap to `'none'`. Engine read sites use the fallback chain `opts.scoring ?? opts.tiebreak ?? 'none'`.

**`teamMode: 'Match'` → `'Match:{matchId}'` in Dots gameOpts (v3.0 / 11-J):**
Pre-11-J rounds stored the generic string `'Match'` for Dots team mode (no match ID).
`migrateRecord()` converts on read:
- Find the first entry in `matches[]` where `format === 'team'`.
- If found: replace `teamMode: 'Match'` with `teamMode: 'Match:{match.id}'`.
- If not found: replace with `teamMode: 'none'`.
Condition: `gameOpts.Dots.teamMode === 'Match'` (exact string, no colon).
Records already using `'Match:{id}'` format are skipped.

**Stableford team fields and condor key (v3.1 / 11-L) — no migration shim needed:**
`format`, `teamA`, `teamB`, `scoring` are absent in all rounds saved before v3.1.
Engine fallbacks: `opts.format ?? 'individual'`; `opts.scoring ?? 'cumulative'`.
Both produce safe individual-mode behavior for old rounds. No `migrateRecord` entry required.

`stabTable` key `'4'` (condor) absent in old custom tables. `stabPts` uses
`t[String(d)] ?? 0` — missing key returns 0 safely. No migration shim required.

### 7.2 Rules for future migrations

- Never modify stored data in place during migration
- Migration happens in `migrateRecord()` in `roundLib.js`
- After a migration is added, increment the storage key version if the
  change is destructively incompatible (`_v4` → `_v5`)
- Document the migration in this section

---

## 8. Mutation Rules

### 8.1 State setters — one per domain

| Domain | Setter | Owner |
|---|---|---|
| Hole scores | `setScores` | `ScorecardPage.jsx` |
| Manual presses | `setManualPresses` | `ScorecardPage.jsx` |
| Dot entries | `setDotEntries` | `ScorecardPage.jsx` |
| Active games | `setActiveGames` | `ScorecardPage.jsx` |

**Mutation ownership rule:** State mutations may only be initiated by
`ScorecardPage.jsx`. Child components must not call these setters
directly. They request mutations via callback props (e.g. `onConfirm`,
`onRemove`) which internally trigger the appropriate setter.

Mutations must not compute or store derived values. All derived values
must be recomputed via engine functions when needed.

### 8.2 ScorecardPage.jsx — allowed and prohibited

**Allowed:**
- Holding live-round state (`scores`, `dotEntries`, `manualPresses`)
- Persisting state to localStorage via `useEffect`
- Deriving `primaryMode` from `activeGames` / `gameOpts`
- Holding `isLandscape` UI state (single source of truth for scorecard layout)
  and passing it as a prop to `ScoreGrid`
- Passing props to `ScoreGrid` and other children

**Prohibited:**
- Computing match state, hole winners, lead values, or press triggers
- Reproducing logic that exists in the engine
- Deriving scores or outcomes inline
- Rendering the score grid or game tables directly (delegated to `ScoreGrid`)

### 8.3 ScoreGrid.jsx — allowed and prohibited

`ScoreGrid` is the rendering and input-handling layer for the live
scorecard. It is a UI component, not a state owner.

**Allowed:**
- Rendering the hole-by-hole grid and game tables
- Handling score input, keyboard navigation, and long-press
- Local UI state (e.g. `popup` for DotsPopup visibility)
- Accepting `isLandscape` as an optional prop from `ScorecardPage`;
  falling back to local window detection only when prop is not provided
- Calling `scoreForMode()` and `strokesForMode()` for display-only
  net score and handicap dot calculations
- Calling `restoreDotDefs()` before using dots in `autoMark`
- Passing `setScores`, `setDotEntries`, `setManualPresses` callbacks
  down to children; not calling them directly on arbitrary state

**Prohibited:**
- Holding or owning `scores`, `dotEntries`, or `manualPresses` state
- Computing match lead, hole winners, or press triggers
- Performing payout calculations

### 8.4 scorecardUtils.js — allowed and prohibited

**Allowed (Category 1 — pure formatters):**
- Taking primitive values and returning display strings or style tokens
- No engine dependency; no side effects

**Allowed (Category 2 — derived state builders):**
- Calling engine functions and returning display-ready data structures
- Interpreting engine output

**Prohibited:**
- Reimplementing or duplicating engine scoring logic
- Performing arithmetic that produces a scoring result
- Direct localStorage reads or writes

### 8.5 Table components — allowed and prohibited

All files in `tables/` must begin with:
```js
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
```

**Allowed:**
- Rendering props
- Conditional styling based on prop values
- Trivial display formatting (e.g. `value.toFixed(0)`)
- Calling engine primitive functions for direct display-only
  transformations (see permitted list in §4)

**Prohibited:**
- Match state computation or press trigger logic
- Local state that mirrors or duplicates activeRound fields

---

### 8.6 App.jsx — landscape width wrapper

`App.jsx` wraps all page content in a `<div>` with:
```jsx
<div style={{ maxWidth: isLandscape ? 'none' : 520, margin: '0 auto' }}>
```

**Rules:**
- `App.jsx` is the authoritative landscape width constraint for all pages.
- `isLandscape` state in `App.jsx` is detected via `window.innerWidth > window.innerHeight`
  with resize/orientationchange listeners. It is the outer layout control only.
- `ScorecardPage.jsx` holds its own `isLandscape` state as the single source of truth
  for scorecard-level landscape switching (passed to `ScoreGrid` as prop). These are two
  separate concerns — do not merge them.
- Pages that should remain capped at 520px in landscape (Home, Players, Courses, New Round,
  History, Results) rely on the `App.jsx` wrapper. Do not remove `maxWidth: 520` from their
  own inner content divs — the two constraints are redundant by design.
- Do not add a third `isLandscape` detection mechanism anywhere in the app.

---

## 9. roundLib Responsibilities

`roundLib.js` is the sole owner of schema conversion between the live
`activeRound` blob and the history record format.

| Function | Job |
|---|---|
| `fromActiveRound(ar)` | Live blob → history record |
| `toActiveRound(r)` | History record → live blob |
| `toSetupState(r)` | History record → NewRoundPage init state |
| `migrateRecord(r)` | Upgrades legacy records on read |
| `saveFromActive(ar)` | Calls `fromActiveRound`, writes to `SK.rounds` |

No other file performs these conversions. No other file writes to
`SK.rounds`.

**`toSetupState` field completeness (13-C.2 amendment):** `toSetupState` must restore
every field that `NewRoundPage` reads from `initSrc` on reload. Omitting a field from
`toSetupState` silently resets it to its default when a saved round is reloaded for
editing — a data-loss bug with no error. The following fields are explicitly required
in `toSetupState` in addition to all game-config fields:
- `manual_presses` — restores press configuration; was missing (pre-13-C.2 bug, fixed in 13-C.2)
- `round_start_hole`, `round_num_holes` — restores round length pickers

**Rule:** Whenever a new field is added to `fromActiveRound` or `toActiveRound`, it must
also be added to `toSetupState` if `NewRoundPage` reads it from `initSrc`. Failure to do
so is a contract violation (invariant 16).

**Departure metadata round-trip (v3.5 / 13-C.7):** Three fields written
by the resolver chain MUST round-trip faithfully through all three
converters — failure causes silent loss of departure state on
Back→Setup→Forward navigation. Per `PartialGameContract` §4.5 and
PartialGameContract §14 invariant 23:

| Field | activeRound (camelCase) | history record (snake_case) | setupState (camelCase) |
|---|---|---|---|
| `earlyDepartureOpts` | required | `early_departure_opts` | `earlyDepartureOpts` |
| `earlyEndOpts` | required | `early_end_opts` | `earlyEndOpts` |
| `lastCompletedHole` | required | `last_completed_hole` | `lastCompletedHole` |

`fromActiveRound` writes all three under their snake_case keys.
`toActiveRound` restores all three under camelCase, defaulting to
`undefined` if absent in legacy records (backward compatible).
`toSetupState` emits all three under camelCase keys (NOT snake_case;
the setup-state shape uses camelCase for fields newer than the original
v1 schema, except for legacy snake_case fields like `dot_entries` and
`manual_presses` retained for backward compatibility).

**`migrateRecord` backfill rule (v3.5 / 13-C.7):** Legacy records may
have `earlyDepartureOpts[pi]` entries that lack the `eventOrder` field
(written prior to v2.0 of `PartialGameContract`). `migrateRecord` MUST
backfill `eventOrder` by sorting entries on `departureHole` ascending,
tie-broken by `playerIdx` ascending, and assigning 0-based indices.
Backfill is non-destructive — only entries lacking `eventOrder` get a
new value; entries already carrying one are left intact (the migration
is idempotent under repeated reads).

**`NewRoundPage.handleStart` preservation rule (v3.5 / 13-C.7):**
When the user navigates Back to setup from an in-progress round and
forward again to the scorecard, `handleStart` reconstructs the
`activeRound` blob from `initSrc` (= `loadedRound` for reload paths,
= setup draft otherwise). The handler MUST preserve
`earlyDepartureOpts`, `earlyEndOpts`, and `lastCompletedHole` through
this reconstruction by reading them from `initSrc` using camelCase
keys (NOT snake_case, since `toSetupState` emits camelCase for these
three fields) and including them in the resulting `roundState`.
Without this preservation, the user navigating Back→Setup→Forward
mid-round silently loses all locked-cell displays and resolution
decisions. (Invariant 23.)

---

## 10. buildPayoutArgs

`buildPayoutArgs(ar)` maps from the `activeRound` blob to the argument
object consumed by `computePayouts()`. It must include all fields the
engine needs.

**Location:** `services/roundUtils.js` — extracted from `App.jsx` in
Session 2 so that `RoundSummaryModal.jsx` can import it without
creating a circular dependency. `App.jsx` imports it from
`services/roundUtils.js`. Both call sites use the identical function.

**Rule:** There must be exactly one definition of `buildPayoutArgs`.
It lives in `services/roundUtils.js`. Do not redefine it inline in
any other file. Adding a second definition is a contract violation.

Current shape:
```js
{
  players, pars, hcps, scores, activeGames, gameOpts,
  matches,
  strokePlayPlayers,   // [] = all players
  skinsPlayers,        // [] = all players
  stablefordPlayers,   // [] = all players
  ninesPlayers,        // exactly 3 indices
  sixesTeams,
  sixesPlayers,        // deferred — [] = all players (4-player rounds only currently)
  dotsPlayers,         // [] = all players
  dots, dotEntries,
  courseHcps, minCourseHcp, manualPresses,
  // 13-C.2: Round length — passed through to computePayouts; full-round
  // defaults preserve byte-identical pre-13-C.2 behavior.
  roundStartHole,      // ar.roundStartHole ?? 0
  roundNumHoles,       // ar.roundNumHoles  ?? 18
  // 13-C.3: Per-game hole ranges. Keys are game names OR matchDef.id for
  // individual match instances (PartialGameContract §4.3). Empty {} = all
  // games inherit round range. payouts.js resolves per-game ranges via
  // `rangeFor(key, gameRanges, roundStartHole, roundEndHole)` and applies
  // pre-processing trimming (`trimScoresToRange`) before each engine call.
  // Engine functions remain range-unaware except for `runMatchNassau` and
  // `calcTeamStablefordTotal`, which accept an optional `range` argument
  // for §3.6 midpoint derivation (PartialGameContract §14 invariant #13.b).
  gameRanges,          // ar.gameRanges    ?? {}
  // 13-C.6 / 13-C.7: Partial-round / departure pass-through fields.
  // payouts.js does NOT yet read these — that is 13-C.8 work. Pass-through
  // is required now so the resolver can write them via activeRound without
  // the engine call site dropping them. Default `{}` for byte-identical
  // pre-departure behavior when no departures exist.
  earlyDepartureOpts,  // ar.earlyDepartureOpts ?? {}
  earlyEndOpts,        // ar.earlyEndOpts       ?? {}
  lastCompletedHole,   // ar.lastCompletedHole  ?? null
}
```

**Synchronization rule:**
Any field consumed by `computePayouts()` must be present in
`buildPayoutArgs`. Adding or modifying a game without updating this
function is a contract violation. The symptom of a missing field is
silent incorrect payouts — no error will be thrown if the engine
receives `undefined` for an optional field.

Checklist for adding a new game:
1. Add new `activeRound` fields to the schema (§5)
2. Add those fields to `buildPayoutArgs`
3. Add `fromActiveRound` / `toActiveRound` / `toSetupState` in `roundLib.js`
4. Verify `computePayouts()` receives and uses all required fields

### 10.1 `computePerMatchPayouts` (v3.6)

`computePerMatchPayouts(matches, players, scores, hcps, courseHcps,
minCourseHcp, manualPresses, gameRanges = {}, roundStartHole = 0,
roundEndHole = 17, earlyDepartureOpts = {}, earlyEndOpts = {},
lastCompletedHole = undefined)` is the per-match payout breakdown helper
used by `RoundSummaryModal`, `ResultsPage`, and `HistoryPage`'s share-image
path. It mirrors `computePayouts` for Match/Nassau games specifically,
returning per-match Front/Back/Total breakdowns under each match's
per-match range.

**Signature evolution:**
- 13-C.3 added `gameRanges`, `roundStartHole`, `roundEndHole` (positional args 8–10)
- 13-C.7 / v3.5 added `earlyDepartureOpts` (positional arg 11, default `{}`)
- 13-C.8 / v3.6 added `earlyEndOpts` (positional arg 12, default `{}`) and `lastCompletedHole` (positional arg 13, default `undefined`)

**Engine departure data guardrail:** when `earlyDepartureOpts` is
non-empty, `computePerMatchPayouts` applies an inline copy of the
guardrail at function entry (zeroing scores for any cell where `h >
earlyDepartureOpts[pi].departureHole`). The inline copy avoids importing
`scorecardUtils.js` from `services/roundUtils.js`, which would create a
circular dependency through `components/ui`. Per `PartialGameContract`
§11.9 the inline copy MUST remain in semantic agreement with
`payouts.js` `applyDepartureGuardrail` and `scorecardUtils.js`
`applyDepartureGuardrailToScores`. (Invariant 17.)

**Engine departure handling (13-C.8):** when `earlyDepartureOpts` or
`earlyEndOpts` contain `SegmentedResolution` entries for a match instance,
`computePerMatchPayouts` aggregates them into an effective per-match
resolution and applies the full dispatcher: abandoned matches are filtered
out of the return array (no entry, no bank contribution); `end_at_k` trims
scores per-player at their `departureHole` before the engine call; per-segment
and per-press Pay/Abandon decisions zero the corresponding F/B/O contributions
to `matchCols`. Group-stop Scenario B (`earlyEndOpts` + `lastCompletedHole`)
is consumed identically to a per-player `end_at_k` applied to all players at
`lastCompletedHole`.

**Return shape per match entry (v3.6):**
```js
{
  label:      string,              // 'Match A', 'Match B', ...
  colHeaders: string[],            // ['Front', 'Back', 'Total', 'Game Total']
  rows:       MatchRow[],          // per-player matchCols + net
  decoration: string | null,       // resolution-status suffix for SubHeader rendering.
                                   // null when no resolution applies.
                                   // Examples: 'ended at hole 11, paid Front only',
                                   //           'continued (Tom departed)',
                                   //           'drop player (Dave)'
}
```

Abandoned matches are excluded from the return array entirely — no entry is emitted, no SubHeader appears in the renderer. (The corresponding bank contribution of zero for abandoned matches is enforced separately by `computePayouts`, which this function does not call.)

**All three call sites MUST pass `ar.earlyDepartureOpts || {}` as the
11th argument, `ar.earlyEndOpts || {}` as the 12th argument, and
`ar.lastCompletedHole` as the 13th argument.** Omitting the departure
args defaults to `{}` / `undefined` and silently disables the resolution
pipeline for that call — a contract violation if the round contains
departures.

**Share-image render path:** `roundUtils.js buildShareHtml` destructures
`earlyDepartureOpts` from `ar` and forwards it to every embedded
`renderToStaticMarkup` call for the seven game-table components
(`SkinsTable`, `StrokePlayTable`, `StablefordTable`, `NinesTable`,
`SixesTable`, `MatchNassauTable`, `DotsTable`), AND uses an inline
`isPastDeparture(h, pi)` predicate in its hand-built scorecard
`scoreCell` and per-half-row-total reducers to render `–` and exclude
past-departure cells from sums.

**`buildShareHtml` filter (v3.6):** the filter that removes Match entries
from `breakdown[]` before rendering has been widened from
`e.game !== '🥊 Match / Nassau'` to `!String(e.game).startsWith('🥊 Match ')`,
catching the per-instance entries emitted by `computePayouts` under Option A
(13-C.8) as well as the retired combined entry.

---

## 11. Invariants

These are always true. Any state that violates them is a bug.

**Data integrity:**
1. `scores[h]` has exactly `activePlayers.length` entries for every hole `h`
2. `courseHcps` has exactly `activePlayers.length` entries
3. All player index references (in `matches`, subset pickers, `sixesTeams`) are valid indices into `activePlayers`
4. `manualPresses` arrays are sorted ascending with no duplicate values
5. All press start holes are within their segment's hole range
6. `autoWhen` on dots is always absent or non-functional in stored state (stripped by JSON serialization). `multi` may be absent on pre-v2.2 records. `value` may be absent on pre-v2.0 records (stored as `pts`). All three are restored at read time via `restoreDotDefs()` before use — `autoWhen` and `multi` from `DOTS_DEF`, `value` from `DOTS_DEF` with `pts` fallback for custom dots
7. No function-valued property on any stored object is trusted after a localStorage round-trip — all must be restored at read time
8. `scores[h][i]` is `''`, a positive integer string, or `'X'`. No other values are valid. `'X'` must not be sanitized to `''`.
9. `'X'` is never stored as `'NX'` or any other derived form — `'X'` is the canonical storage value.

**Derived data:**
8. `breakdown` and `bank` are always computed from current scores — never used as engine inputs
9. Match lead, hole winners, press outcomes, and payout amounts are never stored — always recomputed
10. Engine is the single source of truth for all scoring outcomes

**Architecture:**
11. UI components do not compute match state, press triggers, or payout math; direct engine calls in UI are limited to the permitted list in §4
12. State mutations are initiated only by `ScorecardPage.jsx`
13. `scorecardUtils.js` interprets engine output; it never reimplements engine logic
14. `roundLib.js` is the sole owner of schema conversion between activeRound and history records
15. Every field consumed by `computePayouts()` must be present in `buildPayoutArgs`
16. Every field added to `fromActiveRound` or `toActiveRound` that `NewRoundPage` reads from `initSrc` must also be added to `toSetupState`. Omitting it causes silent data loss on round reload.
17. **(NEW v3.5)** Engine departure data guardrail — dual implementation. The guardrail (PartialGameContract §11.9, invariant 21) is implemented at TWO sites that MUST remain in semantic agreement: (a) engine pipeline (`payouts.js` `applyDepartureGuardrail`, called from `computePayouts`); (b) display pipeline (`scorecardUtils.js` `applyDepartureGuardrailToScores` / `applyDepartureGuardrailToDotEntries`, called from every game table, `TotalsCard`, `roundUtils.js computePerMatchPayouts` (inline copy), and `roundUtils.js buildShareHtml` (inline copy)). Adding a new game-aggregating component to the codebase imposes a contract obligation on the author to apply the guardrail in the new component before any score read.
18. **(NEW v3.5)** Departure metadata round-trip preservation. The three fields `earlyDepartureOpts`, `earlyEndOpts`, and `lastCompletedHole` MUST round-trip through all three `roundLib` converters (`fromActiveRound` ↔ `toActiveRound` ↔ `toSetupState`) using the camelCase ↔ snake_case mapping defined in §9. Additionally `NewRoundPage.handleStart` MUST preserve all three fields from `initSrc` (camelCase keys) into the reconstructed `activeRound` for Back→Setup→Forward navigation. See PartialGameContract §4.5 / invariant 23 and Round_Lifecycle_Contract invariant 23 for the full semantics; this contract codifies the schema-conversion obligation.
19. **(NEW v3.6)** Per-match Option A breakdown policy. `computePayouts` MUST emit one columnar breakdown entry per match instance into `breakdown[]`, in `matches[]` array order (first match → "Match A", second → "Match B", etc.). The retired combined `'🥊 Match / Nassau'` flat entry MUST NOT be emitted. All renderers that consume `breakdown[]` MUST filter entries whose `game` field starts with `'🥊 Match '` before rendering, to prevent double-render alongside the `matchPayouts[]` list rendered separately. Legacy history records containing the old combined entry remain valid and are handled by the flat-shape fallback in renderers.
