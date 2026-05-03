# Payout Contract

_Version 1.13 — April 2026_
_Supersedes Payout Contract v1.12._
_Changes in v1.13 (13-C.8 / 13-C.8.1):
§3.2 — Sixes reclassified from flat to **columnar** emitter. Sixes breakdown now carries `colHeaders: ['Front 6', 'Middle 6', 'Last 6', 'Game Total']` (length-adjusted for partial-range Sixes — see §7.6). The legacy flat `{ name, detail, net }` shape is retired for Sixes as of this version.
§7.3 — Match / Nassau block updated: the combined `'🥊 Match / Nassau'` flat-shape breakdown entry in `breakdown[]` is **retired** as of 13-C.8. `computePayouts` now emits one columnar entry per match instance into `breakdown[]` (same shape as `matchPayouts[]`). ResultsPage and RoundSummaryModal filter any header starting with `'🥊 Match '` from `breakdown[]` to prevent double-render alongside `matchPayouts[]`. Legacy history records that carry the old combined entry remain readable (flat-shape fallback preserved in renderers). The `computePerMatchPayouts` signature gains two new trailing args: `earlyEndOpts` (positional 12, default `{}`) and `lastCompletedHole` (positional 13, default `undefined`). All three call sites (ResultsPage, RoundSummaryModal, HistoryPage) pass these. Each returned match entry now includes `decoration: string | null` — a human-readable resolution-status suffix appended beneath the match SubHeader by the renderer.
§7.6 — Sixes block updated: breakdown row format changed to columnar shape; per-segment gb tracking added; `sixesSegLabel` helper documents label derivation; resolution decoration appended to header via `decorateHeader`.
No new invariants. Engine firewall preserved — games.js and handicap.js untouched._
_Changes in v1.12 (13-C.3 Phase 2A):
§3.2 — `BreakdownEntry` shape generalized to two shapes (flat vs columnar) distinguished by `entry.colHeaders`. Documents which games emit columnar shape, which preserve flat shape, the consumer detection rule (`!!entry.colHeaders`), and the last-column-is-total convention.
§7.1 — Stroke Play block updated: segments-mode payout formula referenced (Stroke Play §5.8 / §5.9); both flat (`'total'`) and columnar (`'segments'`) breakdown row formats specified.
§7.3 — Match / Nassau block updated: per-match `matchPayouts[]` columnar shape emitted by `roundUtils.computePerMatchPayouts` documented. Each match entry carries its own `label`, `colHeaders`, and `rows[].matchCols`. ResultsPage routes via `match.colHeaders` detection; legacy fallback preserved for older history records.
§7.4 — Stableford block updated: segments-mode tie behavior corrected to split-pot (was: sole-winner-only). `paySegStab` helper code shows per-name delta-map return. Columnar breakdown shape documented; team-mode parallel.
§7.5 — Nines block updated: nassau-mode breakdown row format updated from "header rows + player rows" (legacy `isHeader: true`) to columnar shape. Pairwise settlement unchanged.
No invariant changes. The Dots-team-mode columnar layout (pre-existing v2.3) remains the implementation reference for the `DotsColTable` renderer; this version generalizes the shape spec across all games that emit it._
_Changes in v1.11: §4.4 added — X score handling. `buildPayoutArgs` passes raw `scores` to engine; engine is responsible for detecting and handling `'X'` values._
_Status: AUTHORITATIVE._
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._

---

## 1. Purpose and Scope

This contract defines all rules governing how `computePayouts()` in `engine/payouts.js`
converts engine scoring outputs into dollar amounts. It is the authoritative
reference for:

- The entry point, parameter contract, and output shape of `computePayouts()`
- The `buildPayoutArgs` synchronization rule (mirrored in App Data Model Contract §10)
- The universal NOL+subset implementation rule via `subsetMin()` (§4.3)
- Per-game payout logic for all active games
- Tie-handling rules for all games (§5)
- Incomplete-round payout policy
- The `payWinner` helper and its usage constraints
- Architecture boundaries: what belongs in the engine vs. display layer

Game-specific scoring rules (hole winners, match lead progression, team
rotation, etc.) are defined in the relevant game contracts. This document
covers only how those scoring outcomes translate into money.

---

## 2. Architecture Boundary

`computePayouts()` is a pure engine function. It has no side effects,
no React dependency, and no localStorage access. It is always called
from `App.jsx` via `buildPayoutArgs()` before navigating to ResultsPage.

```
App.jsx
  └── buildPayoutArgs(activeRound)        // maps activeRound fields to engine args
        └── computePayouts(args)          // engine: pure function → { bank, breakdown }
              └── ResultsPage.jsx         // render only — no engine calls
```

**`computePayouts()` must not be called from any UI component, table
component, or `scorecardUtils.js`.** It is called exactly once per
Results navigation, in `App.jsx`.

`breakdown` and `bank` are written to `activeRound` for display purposes
and persisted in the history record at save time. They are display caches
only and are never used as inputs to any engine function.

---

## 3. Output Shape

### 3.1 Return value

```js
computePayouts(args) → { bank, breakdown }
```

| Field | Type | Description |
|---|---|---|
| `bank` | `{ [playerName]: number }` | Net dollar amount per player across all games. Always sums to zero. |
| `breakdown` | `BreakdownEntry[]` | Per-game result rows for display in ResultsPage. |

### 3.2 `BreakdownEntry` shape

A breakdown entry takes one of two shapes — flat or columnar — distinguished by the presence of `entry.colHeaders`. Display consumers detect columnar mode by checking `!!entry.colHeaders` and route accordingly.

**Flat shape (default):**

```js
{
  game: string,   // display label, e.g. '💰 Skins', '🥊 Match / Nassau'
  rows: [
    {
      name:     string,           // player name
      detail:   string,           // human-readable scoring detail
      net:      number | null,    // net dollars for this player in this game
      isHeader: true,             // present only on header rows (legacy
                                  // Nines Nassau / Stableford team segments
                                  // before 13-C.3 — superseded by colHeaders)
    }
  ]
}
```

**Columnar shape (13-C.3 Phase 2A):**

```js
{
  game:       string,
  colHeaders: string[],   // column header labels, last column is the per-row total
  rows: [
    {
      name:      string,
      matchCols: number[],  // one number per colHeader; matchCols[colHeaders.length - 1] is the total
      net:       number | null,  // legacy aggregate net (preserved for callers
                                 // reading .net only); typically equals
                                 // matchCols[matchCols.length - 1]
    }
  ]
}
```

**Where columnar shape is emitted:**
- **Stroke Play** in `'segments'` (formerly `'nassau'`) mode — `colHeaders: ['Front', 'Back', 'Total', 'Game Total']` (Stroke Play §5.9)
- **Stableford** in `'segments'` (formerly `'nassau'`) mode, both individual and team — same headers (Stableford Contract §5.3 individual, §5.7 team)
- **Nines** in `'nassau'` (or `'segments'`) mode — same headers (Nines Contract §5.4)
- **Match / Nassau** — emitted by `roundUtils.computePerMatchPayouts` for each match in `matchPayouts[]`. Each match entry carries its own `colHeaders` and `rows[].matchCols`. See §7.3 below for the per-match shape and Nassau_Match_Contract §5 for the match-label derivation. As of 13-C.8, `computePayouts` also emits one entry per match into `breakdown[]` (same columnar shape) — renderers filter these from `breakdown[]` to avoid double-render alongside `matchPayouts[]`.
- **Sixes** — `colHeaders: [sixesSegLabel(0, segLen), sixesSegLabel(1, segLen), sixesSegLabel(2, segLen), 'Game Total']`. For a full 18-hole round (segLen = 6): `['Front 6', 'Middle 6', 'Last 6', 'Game Total']`. For partial-range Sixes the labels scale with segment length — see §7.6. Changed from flat to columnar in v1.13.
- **Dots** in any team mode — `colHeaders: ['Match A', 'Match B', 'Match C', 'Total']` (3-match team mode) or `['Match', 'Total']` (single-match team mode) (Dots_Contract §7.7)

**Where flat shape is preserved:**
- All `'total'` / `'perpoint'` mode breakdowns
- Skins (per-skin layouts use flat shape)
- Any legacy entry without `colHeaders` (renderers must handle both shapes; columnar is opt-in per game/mode)

**Consumer detection rule:** display code (`ResultsPage.DotsColTable` and any future table renderer) routes columnar entries to a tabular renderer when `!!entry.colHeaders` is true. The flat-shape renderer is the fallback. Both shapes appear in the same `breakdown[]` array — consumers must dispatch per entry.

**Last column convention:** in columnar shape, the last entry of `colHeaders` is treated as the **per-row total** by `DotsColTable` (right-aligned, bold, slightly larger font). Callers should ensure `matchCols[matchCols.length - 1]` equals the sum of the preceding columns, and that the column header label is appropriate for a total (e.g., `'Game Total'`, `'Total'`).

### 3.3 `initBank` helper

Each game block initializes a local `gb` (game bank) via `initBank(players)`,
which creates a zero-valued object keyed by player name over all players.
At the end of the game block, `gb` values are merged into the global `bank`.
Non-participants remain at 0 in `gb` for the duration of that game block.

### 3.4 `payWinner` helper

```js
payWinner(winner: string, players: Player[], bet: number, gb: object)
```

Charges each player whose name ≠ `winner` by `bet` and credits `winner`
an equivalent amount per losing player. Used for sole-winner scenarios only.

**Usage constraint:** `payWinner` must only be called when exactly one
winner has been determined. For tie cases use the §5.0 split formula directly.
`payWinner` must never be called when two or more players share the winning score.

---

## 4. `buildPayoutArgs` Synchronization Rule

`buildPayoutArgs(ar)` in `App.jsx` is the sole mapping from the `activeRound`
blob to the argument object consumed by `computePayouts()`.

**Synchronization rule (mirrored from App Data Model Contract §10):**
Every field consumed by `computePayouts()` must be present in `buildPayoutArgs`.
Adding a game or a parameter without updating `buildPayoutArgs` is a contract
violation. Silent incorrect payouts (not an error) will result.

### 4.1 Current `buildPayoutArgs` shape

```js
buildPayoutArgs(ar) → {
  players:             ar.activePlayers,
  pars:                ar.pars,
  hcps:                ar.hcps,
  scores:              ar.scores,
  activeGames:         ar.activeGames,
  gameOpts:            ar.gameOpts,
  matches:             ar.matches             || [],
  strokePlayPlayers:   ar.strokePlayPlayers   || [],  // subset; [] = all players
  skinsPlayers:        ar.skinsPlayers        || [],  // subset; [] = all players
  stablefordPlayers:   ar.stablefordPlayers   || [],  // subset; [] = all players
  ninesPlayers:        ar.ninesPlayers        || [],  // exactly 3 indices
  sixesTeams:          ar.sixesTeams,
  sixesPlayers:        ar.sixesPlayers        || [],  // deferred 5-player subset
  dotsPlayers:         ar.dotsPlayers         || [],  // subset; [] = all players
  dots:                ar.dots,
  dotEntries:          ar.dotEntries,
  courseHcps:          ar.courseHcps,
  minCourseHcp:        ar.minCourseHcp,               // full-field minimum; subsetMin() applied per-game
  manualPresses:       ar.manualPresses       || {},
}
```

`minCourseHcp` in `buildPayoutArgs` is always the full-field minimum
(`Math.min(...cHcps)`). Per-game NOL+subset adjustment is applied inside
`computePayouts` via `subsetMin()` — see §4.3.

### 4.2 Checklist for adding a new game

1. Add new `activeRound` fields to the App Data Model Contract §5
2. Add those fields to `buildPayoutArgs`
3. Add `fromActiveRound` / `toActiveRound` / `toSetupState` in `roundLib.js`
4. Verify `computePayouts()` receives and uses all required fields
5. Apply `subsetMin()` in the new game block if the game has a subset and
   supports `netofflow` scoring (see §4.3)

### 4.3 Universal NOL + Subset Implementation Rule

**Root rule (Handicap Contract §5):** `minCourseHcp` passed to any engine
function must always be the minimum course handicap among the players
actually participating in that calculation — never from a superset.

**Implementation pattern in `computePayouts`:** A `subsetMin()` helper
function enforces this invariant. Every game block that has a player
subset and supports `netofflow` scoring must call it before invoking any
engine function.

```js
/**
 * Returns the minimum course handicap for a subset of player indices.
 * When mode is 'netofflow' and idxs is non-empty, returns min of cHcps[i]
 * for i in idxs only.
 * When mode is not 'netofflow' or idxs is empty, returns globalMin unchanged.
 */
function subsetMin(cHcps, idxs, globalMin, mode) {
  if (mode !== 'netofflow' || !idxs?.length) return globalMin;
  return Math.min(...idxs.map(i => cHcps[i]));
}
```

**Per-game application:**

| Game | Subset indices | `subsetMin` / NOL handling |
|---|---|---|
| Stroke Play | `strokePlayPlayers` (or all) | Passed as 8th arg to `calcStrokePlay`; function derives `effMin` internally |
| Skins | `skinsPlayers` (or all) | `subsetMin(cHcps, idxs, minCHcp, scoringMode)` |
| Match/Nassau | `[p1, p2]` or `[...teamA, ...teamB]` per match | `subsetMin(cHcps, involved, minCHcp, matchMode)` — computed per match |
| Stableford | `stablefordPlayers` (or all) | `subsetMin(cHcps, stabIdxs, minCHcp, mode)` |
| Nines | `nPlayerIdx` (exactly 3) | `subsetMin(cHcps, nPlayerIdx, minCHcp, mode)` |
| Sixes | full field (currently) | `minCHcp` used directly — see §7.6 for 5-player note |
| Specials | no scoring mode | N/A |

**Invariant:** For any engine call inside `computePayouts`, the
`minCourseHcp` argument equals `Math.min(...cHcps[participants])`.
Violation produces silent incorrect net-off-low scores.

---

### 4.4 X Score Handling

_Added session 13-B. See `ScoreKeypad_Contract.md` §4.5–§4.6 for the full
"X always loses" invariant and per-game behavior._

**`buildPayoutArgs` contract:** `scores` is passed raw to the engine.
`buildPayoutArgs` performs no substitution of `'X'` values — it is the
engine's responsibility to detect and handle them.

**Engine responsibility:** Every game engine function that compares scores
must treat `'X'` as follows:

| Comparison type | X handling |
|---|---|
| Simple `<` / `>` (Match, Sixes best-ball) | X → `Infinity` sentinel. `real < Infinity` → real wins. `Infinity < Infinity` → false → halved. |
| Sort-based (Nines) | X → `maxRealScore + 1` sentinel so X players sort after all real scores and tie each other. |
| Filter-based (Skins) | X players excluded from the min calculation entirely. All-X hole returns `{ tied: true }`. |

**"X always loses" invariant:** A player with `'X'` on a hole loses to any
player with a real (non-X) score, regardless of numeric values and scoring
mode (gross / net / NOL). Two X scores on the same hole tie each other.
This invariant holds across all 7 games.

**Stroke Play exception:** `'X'` is not a valid score in Stroke Play.
The Stroke Play engine treats X holes as unscored rather than substituting
`xGrossScore()`. A round with X scores in Stroke Play holes will not
compute complete Stroke Play payouts for those holes.

**`parseInt('X')` prohibition:** No payout function may call `parseInt`
on a raw score without first checking for `'X'`. `parseInt('X')` returns
`NaN`, which silently corrupts all downstream comparisons and totals.

---

## 5. Tie-Handling Rules

### 5.0 General split formula

When multiple players tie for a winning position in any game where a
sole-winner payout is expected, apply the following split formula:

- Identify `winners[]` — players with the best score/total.
- Identify `losers[]` — all other players in the relevant set.
- If `losers.length === 0`: no payout (all players tied).
- If `winners.length === 1`: `payWinner(winner, players, bet, gb)`.
- If `winners.length > 1`: each loser pays `bet`; each winner collects
  `(losers.length × bet) / winners.length`.

This formula is zero-sum and applies uniformly. Fractional amounts are
correct and accepted (see §11, Invariant 11).

### 5.1 Stroke Play ties

Ties handled by the §5.0 split formula. Winners are all players who share
the minimum net score. Losers are all other players.

### 5.2 Skins ties — carryover

When two or more players tie for the low score on a hole in Skins (after
handicap adjustment), no skin is awarded on that hole.

**With carryover enabled:** The skin value accumulates to the next hole.
Accumulated skins are awarded to the sole winner of the first subsequent
hole where a single player posts the low score.

**Without carryover:** A tied hole awards no skin and no value carries
forward.

### 5.3 Match Play ties (per hole)

In individual or team match play, a tied hole results in no points exchanged
for that hole. The hole is halved. Per-segment results reflect hole win
counts; a tied segment (`lead === 0`) produces no payout.

### 5.4 Stableford ties

In `perpoint` mode, a tied point total between two players produces zero
differential for that pair — no movement between them. Other pairwise
differentials still apply.

In `nassau` mode, a tied segment top score results in no winner for that
segment — no payout for that segment.

### 5.5 Nines ties

See Nines payout spec §7.5. A tie between two Nines players on a hole
produces zero differential for that pair.

---

## 6. Zero-Sum Invariant Check

All games are zero-sum: money only moves between players, never created
or destroyed. `computePayouts` includes a development-mode assertion at
the end of the function:

```js
if (process.env.NODE_ENV !== 'production') {
  const total = Object.values(bank).reduce((a, b) => a + b, 0);
  if (Math.abs(total) > 0.01) {
    console.error('[payouts] Zero-sum violation — total net:', total, bank);
  }
}
```

**Purpose:** Detects double-counting, subset misapplication, or rounding
bugs immediately during development. The `0.01` tolerance accommodates
floating-point arithmetic. A violation in production would indicate a
contract violation in one of the game blocks.

**This check does not run in production** (`NODE_ENV !== 'production'`)
to avoid any performance impact on the pure function.

---

## 7. Per-Game Payout Logic

### 7.1 Stroke Play

Source fields: `gameOpts['Stroke Play']`, `strokePlayPlayers`

| Field | Type | Default |
|---|---|---|
| `bet` | number | 0 |
| `grossNetNOL` | scoring mode | `'net'` |

**Subset:** `strokePlayPlayers` indices; empty = all players participate.

**NOL+subset:** Subset indices are passed as the optional 8th argument to
`calcStrokePlay`. The function internally derives `effMin` from the subset
when `mode === 'netofflow'` — the payout block does not need to call
`subsetMin()` separately (Handicap Contract §5.2).

**Engine call:** `calcStrokePlay(scores, players, hcps, pars, mode, cHcps, minCHcp, spIdxs)`
Returns subset players sorted ascending by net-to-par differential. Each row
includes `pi` (original player index).

**Payout:** If `bet > 0` and there is a sole leader (`rows[0]`), apply
`payWinner(rows[0].name, spPlayers, bet, gb)` — `spPlayers` is the subset
player array, not the full `players` array. For tie at top, apply §5.0
split formula over `spPlayers`.

**Segments mode (`betMode === 'segments'` or legacy `'nassau'`):** Three
independent segment settlements (Front / Back / Total) using
`payWinnerStroke` per Stroke Play Contract §5.8. Each segment uses the
§5.0 split formula on tie. See Stroke Play Contract §5.9 for the
columnar breakdown emission and the F/B/T/Game Total column scheme.

**Breakdown row format (`'total'` mode):** flat shape —
```js
{ name, detail: '${gt} gross / ${nt} net (${nd})', net }
```

**Breakdown row format (`'segments'` mode):** columnar shape (see §3.2) —
```js
{ name, matchCols: [f, b, o, f + b + o], net }
```
with `colHeaders: ['Front', 'Back', 'Total', 'Game Total']`.

### 7.2 Skins

Source fields: `gameOpts.Skins`, `skinsPlayers`

| Field | Type | Default |
|---|---|---|
| `mode` | `'perSkin'`\|`'pot'` | `'perSkin'` |
| `bet` | number | 0 |
| `grossNetNOL` | scoring mode | `'net'` |
| `carryover` | boolean | `true` |

**Subset:** `skinsPlayers` indices; empty = all players.

**NOL+subset:** `skinsMin = subsetMin(cHcps, idxs, minCHcp, scoringMode)`
passed to `calcSkins` as `minCourseHcp`. See §4.3.

**Engine call:** `calcSkins(scores, players, hcps, scoringMode, carryover, cHcps, skinsMin, idxs)`

For full payout formulas (`perSkin` and `pot` modes) see Skins Contract §7.
Zero-sum proofs are in Skins Contract §7.1 and §7.2.

**`minCHcp` field in `buildPayoutArgs`:** The full-field minimum is passed
from `buildPayoutArgs`. `subsetMin()` inside the Skins block derives the
correct subset minimum before the engine call. ✅ Implemented.

**Breakdown row format:**
```js
{ name, detail: '${totals[p.name]} skins', net }
// sorted descending by net; subset players only
```

### 7.3 Match / Nassau

Source fields: `matches[]`, `manualPresses`

For full scoring rules see Nassau/Match Contract. Payout logic only:

**NOL + match subset:** Each match involves 2 players (individual) or 4
players (team). When scoring mode is `'netofflow'`, the `minCourseHcp`
passed to `runMatchNassau` must be the minimum of the match participants'
course handicaps only — not the full-field minimum. This is enforced via
`subsetMin()` per match. ✅ Implemented.

```js
const involved   = [...sideA, ...sideB].filter(i => players[i]);
const matchMode  = matchDef.grossNetNOL ?? matchDef.scoring ?? 'net';
const matchMin   = subsetMin(cHcps, involved, minCHcp, matchMode);
// matchMin passed to runMatchNassau, not minCHcp
```

**Engine call per match:** `runMatchNassau(scores, players, hcps, matchDef, cHcps, matchMin, manualPressesForMatch)`
Returns `{ front: [...bets], back: [...bets], overall: [...bets] }`.

**Per-segment, per-bet payout:**

For each segment (front/back/overall) and for each bet object in that
segment's array:
1. If `bet.thru === 0`: skip — no result.
2. Individual match: if `m.lead > 0` → p1 wins; if `m.lead < 0` → p2 wins;
   if `m.lead === 0` → tied, no movement.
3. Team match: winning side (determined by sign of `m.lead`) collects
   `betAmt` each; losing side pays `betAmt` each.

**Breakdown row format (in the main `breakdown[]` array, as of 13-C.8):**

As of 13-C.8, `computePayouts` emits **one columnar entry per match instance** into `breakdown[]` instead of a single combined flat entry. The entry shape uses `game:` (not `label:`), and resolution decoration is baked into the `game` string by `decorateHeader` rather than carried as a separate field. Renderers (ResultsPage, RoundSummaryModal, buildShareHtml) filter `breakdown[]` entries whose `game` field starts with `'🥊 Match '` to avoid double-rendering alongside the `matchPayouts[]` list.

```js
// breakdown[] entry per match (computePayouts):
{
  game:       string,    // '🥊 Match A (Tom vs Dave)' with optional ' — <decoration>' suffix
  colHeaders: ['Front', 'Back', 'Total', 'Game Total'],
  rows: [
    {
      name:      string,
      matchCols: [f, b, o, f + b + o],
      net:       number,
      detail:    string,  // per-player match status summary (e.g. 'Front: Tom +2up')
    },
    ...
  ]
}
```

**Legacy flat combined entry (retired as of 13-C.8):** prior versions emitted a single `'🥊 Match / Nassau'` flat entry summing all matches. History records containing this entry remain readable via the flat-shape fallback in renderers. The filter `e.game !== '🥊 Match / Nassau'` that existed in renderers has been widened to `!String(e.game).startsWith('🥊 Match ')`.

**Per-match breakdown (`matchPayouts[]`):** A separate array, computed by
`roundUtils.computePerMatchPayouts` and rendered on the Results page as
discrete "Match A / Match B / …" sections. Each match entry uses `label:` (not
`game:`) and carries a separate `decoration` field — shapes are parallel but
not identical to the `breakdown[]` Match entries above:

```js
// matchPayouts[] entry per match (computePerMatchPayouts):
{
  label:      'Match A',                                // not 'game' — match-specific
  colHeaders: ['Front', 'Back', 'Total', 'Game Total'],
  rows: [
    { name, matchCols: [f, b, o, f + b + o], net },
    ...
  ],
  decoration: string | null,   // 13-C.8: resolution-status suffix rendered as
                               // small italic line beneath the SubHeader.
                               // null when no resolution applies (full round).
                               // Examples: 'ended at hole 11, paid Front only',
                               //           'continued (Tom departed)',
                               //           'drop player (Dave)'
}
```

Abandoned matches are excluded from `matchPayouts[]` entirely — no entry, no SubHeader. (Bank contribution for abandoned matches is also zero, enforced by `computePayouts`.)

**`computePerMatchPayouts` signature (as of 13-C.8):**
```js
computePerMatchPayouts(
  matches, players, scores, hcps, courseHcps, minCourseHcp, manualPresses,
  gameRanges,           // positional 8  (13-C.3)
  roundStartHole,       // positional 9  (13-C.3)
  roundEndHole,         // positional 10 (13-C.3)
  earlyDepartureOpts,   // positional 11 (13-C.7)
  earlyEndOpts,         // positional 12 (13-C.8)
  lastCompletedHole,    // positional 13 (13-C.8)
)
```

The Results page renderer detects `match.colHeaders` and routes the entry
through the same columnar table renderer (`DotsColTable`) used for
Stroke Play / Stableford / Nines / Dots. Legacy fallback (PayRow + tie banner)
handles older history records that lack `colHeaders` (13-C.3 Phase 2A
backward-compat).

### 7.4 Stableford

Source field: `gameOpts.Stableford`

| Field | Type | Default |
|---|---|---|
| `bet` | number | 0 |
| `grossNetNOL` | scoring mode | `'net'` |
| `stabBetMode` | `'nassau'`\|`'perpoint'`\|other | `'nassau'` |
| `stabTable` | `object \| null` | null (use DEFAULT_STAB) |

> **Removed field:** `nassauMode: boolean` previously appeared here. Confirmed dead code —
> read in `payouts.js` but never referenced in any conditional branch. Removed in v1.8.
> Old records containing this field are unaffected (engine ignores unknown fields).
> See Stableford Contract §14 G-1.

**Subset:** `stablefordPlayers` indices; empty = all players.

**NOL+subset:** `stabMin = subsetMin(cHcps, stabIdxs, minCHcp, mode)`
passed to `calcStablefordTotal` as `minCourseHcp`. ✅ Implemented.

**Engine call:** `calcStablefordTotal(scores, pi, pars, hcps, courseHcp, stabMin, mode, stabTable, holes)`

**`perpoint` mode:** Compute 18-hole point totals for each subset player.
Apply point-differential payout over all **unordered pairs `(i < j)`** —
each pair is evaluated exactly once. A tie between two players (zero
differential) produces no movement between them.

```js
for (let i = 0; i < ranked.length; i++)
  for (let j = i + 1; j < ranked.length; j++) {
    const diff = ranked[i].pts - ranked[j].pts;
    if (diff > 0) { gb[ranked[i].name] += diff * bet; gb[ranked[j].name] -= diff * bet; }
  }
```

**`nassau` / `segments` mode:** Evaluate Front 9, Back 9, and 18-hole totals independently. For each segment, **tied high-score winners split the segment pot equally** (consistent with Stableford Contract §4.4 / §4.7 and Stroke Play §5.8). All tied = push (no payout for that segment). The pre-13-C.3 contract entry described a sole-winner-only rule — superseded.

```js
const paySegStab = (arr, field, segBet) => {
  const segDelta = {};
  arr.forEach(r => (segDelta[r.name] = 0));
  if (segBet <= 0) return segDelta;
  const maxVal  = Math.max(...arr.map(r => r[field]));
  const winners = arr.filter(r => r[field] === maxVal);
  const losers  = arr.filter(r => r[field] < maxVal);
  if (losers.length === 0) return segDelta;
  const share = (losers.length * segBet) / winners.length;
  losers.forEach(r  => { gb[r.name] -= segBet; segDelta[r.name] -= segBet; });
  winners.forEach(r => { gb[r.name] += share;  segDelta[r.name] += share;  });
  return segDelta;
};
```

`paySegStab` returns a per-name delta map so the caller can populate `matchCols` for the columnar breakdown.

**Single-winner mode** (any `stabBetMode` other than `'nassau'`, `'segments'`, or `'perpoint'`):
Highest 18-hole total wins `bet` from each other participant; sole winner guard
applies. Uses `payWinner(pts18[0].name, stabPs, bet, gb)`.

**Breakdown row format (`perpoint` mode and single-winner mode):** flat shape —
```js
{ name, detail: '${pts} pts', net }
```

**Breakdown row format (`nassau` / `segments` mode):** columnar shape (see §3.2) —
```js
{ name, matchCols: [f, b, o, f + b + o], net }
```
with `colHeaders: ['Front', 'Back', 'Total', 'Game Total']`.

The team-mode segments path uses an analogous helper (`payTeamSeg`) that returns
the same per-name delta map and emits the same columnar `colHeaders` /
`matchCols` shape (one row per teammate; both teammates on the winning side
receive the full segment payout per Stableford Contract §4.7 head-to-head rule).

### 7.5 Nines

Source field: `gameOpts.Nines`

| Field | Type | Default |
|---|---|---|
| `bet` | number | 0 |
| `grossNetNOL` | scoring mode | `'net'` |
| `ninesMode` | `'perpoint'`\|`'nassau'` | `'perpoint'` |
| `blitz` | boolean | false |

**Player count requirement:** Nines requires exactly 3 players.
`ninesPlayers` must contain exactly 3 valid player indices. If fewer
than 3 valid indices are resolved, the Nines block is skipped entirely.

**NOL+subset:** `ninesMin = subsetMin(cHcps, nPlayerIdx, minCHcp, mode)`
passed to `calcNines`. ✅ Implemented.

**`perpoint` mode:** Compute 18-hole point totals for each of the 3 players.
Apply point-differential payout over all **unordered pairs `(i < j)`** —
each pair is evaluated exactly once. A tie between two players produces
zero differential for that pair — no movement between them.

**`nassau` mode:** Evaluate Front 9, Back 9, and 18-hole totals as independent
segments. For each segment, apply pairwise bilateral settlement over the 3 Nines
players using all unordered pairs `(i < j)`. For each pair: if player i's segment
point total is **strictly greater** than player j's, `gb[i] += bet; gb[j] -= bet`.
Equal totals between a pair → no movement for that pair in that segment.
All three tied in a segment → no movement for any pair (full segment wash).

```js
// payNassauSeg — called once per segment (f9, b9, ov)
for (let i = 0; i < ranked.length; i++)
  for (let j = i + 1; j < ranked.length; j++)
    if (ranked[i].pts > ranked[j].pts && bet > 0) {
      gb[ranked[i].name] += bet;
      gb[ranked[j].name] -= bet;
    }
```

> **Note (v1.9 correction):** Earlier versions of this section referenced the "§5.0
> split formula" for nassau mode. The actual implementation is the pairwise loop
> above, which is correct and zero-sum for 3 players. The split formula description
> was inaccurate. See Nines Contract §5.4 and §14 G-3.

**Breakdown row format:**
- `perpoint`: flat shape — `{ name, detail: '${pts} pts', net }` sorted descending by net.
- `nassau` (or legacy `segments`): columnar shape — `colHeaders: ['Front', 'Back', 'Total', 'Game Total']`, one row per player with `matchCols: [f, b, o, f+b+o]`. See §3.2 (columnar shape). The pre-13-C.3 layout used `isHeader: true` marker rows above per-player net rows; that shape was superseded in 13-C.3 Phase 2A.

### 7.6 Sixes

Source field: `gameOpts.Sixes`

| Field | Type | Default |
|---|---|---|
| `bet` | number | 0 |
| `grossNetNOL` | scoring mode | `'net'` |
| `scoring` | `'none'`\|`'second'`\|`'cumulative'`\|`'half'` | `'none'` |

For full scoring rules see Sixes Contract. Payout logic only:

**Current player scope:** Sixes is currently a strict 4-player game.
All round players participate in every segment. `minCHcp` (full-field
minimum) is passed directly to `runSixesSegment` — no subset adjustment
is needed.

**Future 5-player scope (Session 5):** When `sixesPlayers` subset is
implemented, a `subsetMin()` call must be added using the 4 participating
player indices for each segment before calling `runSixesSegment`. See
Sixes Contract §NOL note and Handicap Contract §5.2. A forward comment
is present in the Sixes block in `payouts.js` marking the required
insertion point.

**Engine calls:**
- `getSixesTeam(segIdx, sixesTeams, players)` — resolves team for each segment.
- `runSixesSegment(holes, scores, players, hcps, team, mode, scoring, cHcps, minCHcp, autoN, mpHoles)` — returns array of match levels.
- If `getSixesTeam` returns `null`: skip that segment.
- If `runSixesSegment` returns `null`: skip (< 4 players guard).

**Per-match-level payout:** For each match level in each segment, if
`m.winTeam` is non-null and `m.thru > 0`, pay `bet` to each player on
the winning team; deduct `bet` from each player on the losing team.

**Breakdown row format (columnar — v1.13):**

```js
{
  game:       string,    // 'Sixes' with optional ' — <decoration>' suffix when
                         // a resolution applied (see decorateHeader in payouts.js).
                         // The legacy '🔄 Sixes' emoji prefix is retired as of 13-C.8.1.
  colHeaders: ['Front 6', 'Middle 6', 'Last 6', 'Game Total'],
                         // labels produced by sixesSegLabel(si, segLen) for si=0,1,2
                         // where segLen = floor(sxLen / 3) and sxLen = endHole - startHole + 1.
                         // Full 18-hole round: segLen = 6 → 'Front 6', 'Middle 6', 'Last 6'.
                         // 12-hole range: segLen = 4 → 'Front 4', 'Middle 4', 'Last 4'.
  rows: [
    {
      name:      string,
      detail:    '',
      net:       number,  // equals matchCols[3] — preserved for callers reading .net only
      matchCols: [seg0Net, seg1Net, seg2Net, total],
                          // per-segment net for each of the three 6-hole (or segLen-hole)
                          // segments; last column equals the sum of the first three
    },
    ...
  ]
}
// sorted descending by net; all 4 players appear
```

**`sixesSegLabel(segIdx, segLen)` helper:**

Returns the human-readable segment label for a given segment index and length:
- `segIdx = 0` → `'Front ' + segLen`
- `segIdx = 1` → `'Middle ' + segLen`
- `segIdx = 2` → `'Last ' + segLen`

For the full 18-hole round (segLen = 6): `'Front 6'`, `'Middle 6'`, `'Last 6'`.
These labels are used consistently between the resolver UI (segment pill labels),
the Results page (columnar header), and the breakdown decoration.

**Resolution decoration (13-C.8):** when a `SegmentedResolution` is in effect for Sixes
(via `earlyDepartureOpts` or `earlyEndOpts`), the `game` string is extended with a
`' — <decoration>'` suffix via `decorateHeader`. Per-segment Pay/Abandon decisions
zero the corresponding segment's contribution to `gbSeg[si]` and `gb` before the
bank merge. The segment decision list passed to `summarizeSegmentDecisions` uses the
same `sixesSegLabel` labels so the decoration matches the column headers:
e.g., `'Sixes — ended at hole 12, paid Front 6, Middle 6 only'`.

### 7.7 Dots

Source fields: `gameOpts.Dots`, `dots`, `dotEntries`, `dotsPlayers`

| Field | Type | Default |
|---|---|---|
| `bet` | number | 0 |
| `teamMode` | `'none'`\|`'Sixes'`\|`'Match'` | `'none'` |
| `grossNetNOL` | `'gross'`\|`'net'` | `'gross'` |

**Subset:** `dotsPlayers` indices; empty = all players.

**`grossNetNOL` scope:** The `grossNetNOL` field controls only the score value used
for **auto-marking** (birdie/eagle/ace detection) in `ScoreGrid` and
`DotsPopup`. It has no effect on payout math — payout is always
dot-count-based regardless of scoring mode.

**NOL exclusion:** `'netofflow'` is intentionally excluded from `grossNetNOL`
because auto-mark detection is a per-hole achievement test (`"did this
player make a birdie?"`) that compares a single score against par. Net-off-
low strokes require the group minimum handicap as a reference point, making
the detection threshold vary across players in a way that is unintuitive and
rarely meaningful for junk/dots purposes. The selector offers only
`'gross'` and `'net'`. Existing records that do not have `grossNetNOL` (or
the legacy `scoring` field) default to `'gross'` (no behavior change for
pre-existing rounds).

Dots payouts are unaffected by the NOL+subset rule — payout is
determined by dot-value totals only, not by any score comparison.

**Individual mode** (`teamMode: 'none'`): Pairwise differential — each pair
settles based on their dot-value total difference × `bet`.

**Team mode** (`teamMode: 'Sixes'` or `'Match'`): When a player earns dots,
their current teammate auto-receives Team dots. Payout uses the same pairwise
differential formula over accumulated dot-value totals.

**Breakdown row format:**
```js
{ name, detail: '${indivDots[pi]} dots', net }
```

---

## 8. Known Gaps and Open Items

All previously open NOL+subset gaps are now closed:

| # | Status | Description |
|---|---|---|
| ~~Skins G-3~~ | ✅ **CLOSED** | NOL+subset: Skins block now uses `subsetMin()`. `skinsMin` derived from subset indices only when `netofflow`. |
| ~~Match G-2~~ | ✅ **CLOSED** | NOL+match subset: per-match `matchMin` now derived from involved player indices only. |
| ~~Stab NOL~~ | ✅ **CLOSED** | Stableford block now uses `subsetMin()` for `stabMin`. |
| ~~Nines NOL~~ | ✅ **CLOSED** | Nines block now uses `subsetMin()` for `ninesMin`. |
| ~~Stab display NOL~~ | ✅ **CLOSED** | `StablefordTable` now accepts `stablefordPlayers` prop and computes `displayMin` via inline `subsetMin` logic (mirrors `StrokePlayTable`). Scorecard display now agrees with payout for NOL+subset rounds. |
| ~~Nines nassau desc~~ | ✅ **CLOSED v1.9** | §7.5 nassau description corrected from "§5.0 split formula" to pairwise bilateral loop. Implementation was always correct; only the contract description was wrong. |
| Sixes (5-player) | 🔵 **DEFERRED** | When `sixesPlayers` subset is implemented, `subsetMin()` must be applied per segment. Forward comment in code marks insertion point. |

---

## 9. Incomplete Round Policy

`incompletePolicy` field in `buildPayoutArgs` controls how incomplete
segments pay out. Current default: `'payComplete'` — pay based on
results through the last scored hole.

Full incomplete round policy spec is deferred to the Round Lifecycle
Contract (not yet written).

---

## 10. Per-Game Invariants

1. Every game block's local `gb` sums to zero before merging into `bank`.
2. Non-participating players remain at `0` in `gb` for the duration of any
   game block they are not part of.
3. `payWinner` is never called when two or more players share the winning
   score — §5.0 split formula is used instead.
4. Skins `totals` is iterated by subset index, never by full `totals` key
   iteration (which would include non-subset players at 0).
5. Match payout is derived from `m.lead` sign — positive = sideA wins,
   negative = sideB wins, zero = no movement.
6. Stableford and Nines `perpoint` pairwise loops use `i < j` — each
   unordered pair is evaluated exactly once.
7. Sixes pays each match level independently — press outcomes are not
   merged with base match outcomes.

---

## 11. Global Invariants

These hold across the entire `computePayouts` function:

1. `bank` is initialized to zero for all players before any game block runs.
2. Every game block reads from `bank` only via its local `gb`; it never
   reads `bank` directly.
3. `gb` is merged into `bank` exactly once per game block, at the end.
4. No game block modifies `gb` after merging into `bank`.
5. `breakdown` contains exactly one entry per active game that was processed.
6. Engine functions (`calcSkins`, `runMatchNassau`, etc.) are the sole
   source of scoring truth — no arithmetic that reproduces engine logic
   may appear in `computePayouts`.
7. `subsetMin()` is called before every engine function invocation that
   involves a player subset and supports `netofflow` scoring.
8. `minCourseHcp` passed to any engine function equals
   `Math.min(...cHcps[participants])` — the minimum over participating
   players only. Any deviation is a contract violation.
9. `bank` sums to zero across all players at function exit. Verified by
   the zero-sum check in development (§6).
10. `breakdown` rows for non-participating players are never included in
    any game's breakdown row array.
11. Fractional payout amounts are correct and accepted. No rounding is
    applied inside `computePayouts`.
12. No payout function calls `parseInt` on a raw score without first
    checking for `'X'`. `parseInt('X')` returns `NaN` and must never
    reach any arithmetic or comparison operation.
13. A player with `'X'` on a hole never wins that hole's payout against
    any player with a real score. Two X scores on the same hole produce
    no winner (tie / carryover per game rules).
