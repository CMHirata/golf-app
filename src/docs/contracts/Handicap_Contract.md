# Handicap Contract — v2.0

**Status:** Authoritative
**Engine file:** `engine/handicap.js`
**Consumed by:** `engine/games.js` (all game calculators), `ScoreGrid.jsx` (dot display), `ScorecardPage.jsx` (via `groupCourseHandicaps`), `App.jsx` (via `buildPayoutArgs`)
**Cross-references:** App Data Model Contract §4, Skins Contract §3, Nassau/Match Contract §10, Payout Contract §3

_Changes in v1.9 (13-G): Gender-aware handicap computation. §2.1 amended — USGA formula par parameter is gender-aware: female players use women's total par when `parsWomen` data is present on nines. §2.5 amended — `groupCourseHandicaps` gains optional `nines` param; uses `tee.slopeW`/`tee.ratingW` for female players when present; falls back to men's values when absent. §2.7 NEW — `buildGenderLayout` function: builds gender-aware SI and par arrays from course nines, returning `hcpsWomen`, `parsWomen`, `parsWomenDiffer`, `hasWomenSI`. §5.16.1 amended — plus-CH indicator and dot rank use per-player gender-appropriate SI. §8 Gap G-4 NEW — women's SI warning in NewRoundPage. §11 invariants 18–20 NEW._
_Changes in v1.8 (13-F implementation tested): §5.16.1 trigger condition corrected.
The original v1.7 spec used `hcps[h] <= Math.abs(courseHcps[pi])` which marks the
HARDEST holes (SI 1..|CH|). Per USGA Rule of Handicapping, a plus handicapper gives
strokes back on the EASIEST holes (SI 18..19-|CH|). Corrected condition is
`hcps[h] > 18 - Math.abs(courseHcps[pi])`. For RJ at CH=-5, the indicator now fires
on holes ranked SI 14, 15, 16, 17, 18 (not SI 1, 2, 3, 4, 5). §5.16.2 amended:
plus-CH check must run BEFORE any `dotMode === 'gross'` early bail in display
helpers — `+` indicator is independent of dot-mode display preference._
_Changes in v1.7 (13-F): §5.16 NEW — Plus-CH cell indicator. Specifies the small `+` shown in scorecard cells when a player has a negative course handicap (gives strokes back). Covers display rule, trigger condition, affected surfaces (ScoreGrid, ZoomModal, ReadOnlyScorecard, shareUtils), and invariants. Documents the edge case where a low-positive HI on an easy course produces a negative CH._
_Changes in v1.6: §5.6–§5.13 added — NOL dot selector spec: unified segmented pill control, display condition, qualifying game rule, subset-min computation, non-participant display, ZoomModal inheritance, state ownership, architecture note, and `computeNolDotOptions` helper. Old §5.6 `escTotal` renumbered to §5.14 (content unchanged). `ScorecardPage` consumed-by entry updated. Hint text removal noted in §5.13._
_Changes in v1.5: §4.3 `escTotal` added — USGA World Handicap System Net Double Bogey adjusted gross score for GHIN posting. Added to §9 exported API table, §10 architecture boundary (UI permitted direct call), and §11 invariant 11._
_Changes in v1.4: §2.5 `groupCourseHandicaps` — signature changed from single shared `activeTee` to per-player `tees[]` array. Dual-mode `Array.isArray()` branch removed. All callers now pass an array; fallback/default-tee logic belongs in the caller (e.g. `roundLib.toActiveRound`), not in the engine. Old rounds reconstruct correctly because `roundLib` builds the array using the stored `selected_tee` as the fallback for each player when no per-player tee is on record._
_Changes in v1.3: §5.3 updated — Stroke Play and Stableford now have optional player subsets; they are no longer unconditionally full-field. §5.4 G-2 inline note removed (gap was closed in v1.2; stale warning deleted). §8 G-3 closed — `DEFAULT_STAB` comment added to `handicap.js`._
_Changes in v1.2: §2.6 `minGroupHandicap` clarified — full-field minimum at round start is correct by design; per-game subset adjustment belongs in `subsetMin()` in `payouts.js`, not here. §8 G-2 closed — NOL+match subset fix implemented in `payouts.js` via `subsetMin()`._

---

## 1. Overview

The handicap engine converts raw GHIN Handicap Indexes into per-hole stroke
allocations and adjusted scores. It is the sole source of truth for all
handicap math in the app. No other file may reimplement these computations.

**Two-level model:**

| Concept | Definition | Scope |
|---|---|---|
| **Handicap Index** | The portable USGA/WHS number on a player's GHIN card (e.g. `8.2`, `+5.4`) | Stored in `player.ghin` |
| **Course Handicap** | Strokes given/received at a specific course and tee — derived from Index × slope/rating/par | Computed at round start; used for all engine calls |

A **plus handicap** (e.g. `+5.4`) means the player is better than scratch.
Plus indexes are stored as **negative numbers** internally (`-5.4`). A player
with a `+5` course handicap gives 5 strokes back — they receive 0 strokes on
any hole, and in net-off-low games other players get additional strokes
relative to them.

---

## 2. Course Handicap Computation

### 2.1 USGA Formula

```
courseHandicap = round(Index × (Slope ÷ 113) + (Rating − Par))
```

- **`Index`** — signed float; plus handicaps are negative (e.g. `+5.4` → `-5.4`)
- **`Slope`** — tee slope rating (typically 55–155; standard is 113)
- **`Rating`** — course rating for the tee (e.g. `71.4`)
- **`Par`** — total par for the 18 holes on this tee (e.g. `72`)
- **Result** — signed integer; negative = plus handicap (gives strokes)

**Fallback (missing tee data):** If `slope`, `rating`, or `par` is absent or
zero, the formula degenerates to `round(Index)` — the Index rounded to the
nearest integer is used as the course handicap directly.

**Gender-aware par (v1.9):** The `par` parameter must equal the total par for
the tee and gender played. For female players, if `parsWomen` arrays are present
on the course nines, `par` = sum of `parsWomen` values across the active nines.
If `parsWomen` is absent, fall back to men's total par. `groupCourseHandicaps`
handles this automatically when the optional `nines` argument is supplied; callers
using `courseHandicap` directly are responsible for supplying the correct par.

### 2.2 Engine Function: `courseHandicap`

```js
courseHandicap(index, slope, rating, par) → number (signed integer)
```

| Param | Type | Notes |
|---|---|---|
| `index` | `number\|string` | GHIN index; strings are parsed by `parseIndex` |
| `slope` | `number\|null` | Tee slope; falsy triggers fallback |
| `rating` | `number\|null` | Tee rating; falsy triggers fallback |
| `par` | `number\|null` | Total par; falsy triggers fallback |

Accepts `string` index input: `courseHandicap` internally calls `parseIndex`
when `typeof index === 'string'`.

**Legacy alias:** `chp(ghin, slope, rating, par)` is an identical wrapper
that accepts the raw GHIN string directly. It exists for historical callers
only. New code must call `courseHandicap`.

### 2.3 Index Parsing: `parseIndex`

```js
parseIndex(raw) → number (signed float)
```

Converts a raw GHIN string to a signed float, handling all common plus-handicap
notations:

| Input | Output |
|---|---|
| `"8.2"` | `8.2` |
| `"+5.4"` | `-5.4` |
| `"5.4+"` | `-5.4` |
| `"-5.4"` | `-5.4` |
| `null` / `undefined` / `""` | `0` |

Plus handicaps are **always stored as negative numbers** throughout the engine.
All display formatting that shows `+` notation must negate the stored value.

### 2.4 `courseHcpVal` Override Field _(planned — not yet implemented)_

`courseHcpVal` is a **planned** optional integer field on the **round's player
snapshot** (i.e. a field in each entry of `activeRound.players`, not on the
permanent player record in `playerLib`) that, when present and non-null, will
**override** the USGA-computed course handicap for that player for the duration
of the round.

It belongs on the round snapshot — not the global player library — because a
course handicap is specific to the course and tee played that day and must not
pollute the permanent player record.

**Intended precedence rule (once implemented):** If `courseHcpVal` is set
(non-null, non-undefined), `groupCourseHandicaps` must return that value
directly for that player instead of calling `courseHandicap`. This override
will accommodate leagues and local rules where course handicaps are assigned
administratively rather than computed from GHIN.

**Current behavior:** `courseHcpVal` does not exist in the schema. The field
is not present in `playerLib`, is not set anywhere in `NewRoundPage`, and
`groupCourseHandicaps` always calls `courseHandicap` for every player. See
§8 Gap G-1 for the full implementation checklist.

### 2.5 Engine Function: `groupCourseHandicaps`

```js
groupCourseHandicaps(players, tees, pars, nines?) → number[] (signed integers)
```

Computes course handicaps for all players in a single call.

| Param | Type | Notes |
|---|---|---|
| `players` | `Player[]` | Full player array in round order |
| `tees` | `TeeObject[]` | Per-player tee array, one entry per player in the same order as `players`. Each entry may be `null`/`undefined` — `courseHandicap` degrades to `round(index)` when slope/rating are absent. |
| `pars` | `number[]` | Array of 18 per-hole par values (men's) |
| `nines` | `Nine[]` (optional) | Course nines array — used for gender-aware par and women's tee data selection. When absent, behaviour is identical to v1.8 (no change for existing callers without female players). |

**Gender selection (v1.9):** For each player whose `gender` normalises to `'f'`
(case-insensitive: `'f'`, `'female'`, `'w'`):
1. If `tee.slopeW` and `tee.ratingW` are both present and non-zero → use `slopeW`, `ratingW`, and women's total par (computed from `nines[].parsWomen` when `nines` supplied, falling back to men's total par).
2. Otherwise → use men's `tee.slope`, `tee.rating`, men's par (existing behaviour, unchanged).

Male players, players with unknown/absent gender, and all players when `nines` is absent use men's values. No male player ever uses women's tee data (invariant 18).

- Returns one signed integer per player in input order.
- The returned array is the `courseHcps` argument passed to all game engine functions.
- **Caller responsibility:** The `tees` array must always be a proper array. Fallback-tee logic belongs in the caller. Both current callers (`NewRoundPage.handleStart` and `roundLib.toActiveRound`) build the array and pass `course.nines`.
- **Caller responsibility for `siArray` (v2.0):** Both callers MUST also call `buildPlayerSI(player, layout)` (§2.8) for each player after `groupCourseHandicaps` returns and attach the result as `player.siArray` before storing `activePlayers` into `activeRound`. Engines read `players[pi].siArray[h]` for stroke allocation in every game (§5). A player object passed into any engine without `siArray` is a contract violation (invariant 21).
- **When `courseHcpVal` is implemented (§2.4):** per-player return must become `p.courseHcpVal ?? courseHandicap(...)`. Until then, the USGA formula is always used for every player.

### 2.6 Engine Function: `minGroupHandicap`

```js
minGroupHandicap(courseHcps) → number (signed integer)
```

Returns `Math.min(...courseHcps)` — the lowest (best) course handicap in the
supplied array. This is the baseline for net-off-low calculations.

**At round start:** `minGroupHandicap` is called over the full `courseHcps`
array and stored as `activeRound.minCourseHcp`. This full-field value is
correct by design — it is the starting point passed into `buildPayoutArgs`.
Per-game subset adjustment is applied inside `computePayouts` via `subsetMin()`
(Payout Contract §4.3), not here. Do not attempt to make `minGroupHandicap`
subset-aware — the subset is not known at round-start time.

### 2.7 Engine Function: `buildGenderLayout` _(v1.9)_

```js
buildGenderLayout(nines, frontName, backName) → {
  pars:            number[18],
  hcps:            number[18],
  parsWomen:       number[18] | null,
  hcpsWomen:       number[18] | null,
  frontName:       string,
  backName:        string,
  parsWomenDiffer: boolean,
  hasWomenSI:      boolean,
}
```

Extends `buildLayout` with gender-aware SI and par arrays.

- `pars` and `hcps` are identical to `buildLayout` output — no change to men's values.
- `hcpsWomen` — women's combined SI using identical odd/even rank interleaving as men's. `null` when either active nine lacks `handicapsWomen` (partial data is not interpolated).
- `parsWomen` — women's per-hole par array. `null` when no nine has `parsWomen` OR when every hole's women's par equals men's par (no display row needed).
- `parsWomenDiffer` — `true` if any hole's women's par differs from men's par.
- `hasWomenSI` — `true` if `handicapsWomen` is present (length 9) on both active nines.

**Invariant 20 applies:** `buildGenderLayout` never interpolates or fabricates women's SI from men's data. `hcpsWomen` is `null` or a complete 18-element array — never partial.

### 2.8 Engine Function: `buildPlayerSI` _(v2.0)_

```js
buildPlayerSI(player, layout) → number[18]
```

Returns the 18-element stroke index array for a single player, resolved by gender:

- **Female + `layout.hcpsWomen` present** → returns a copy of `layout.hcpsWomen`.
- **Otherwise** → returns a copy of `layout.hcps`.

| Param | Type | Notes |
|---|---|---|
| `player` | `Player` | Player object; the `gender` field is read via the same `isFemale()` predicate used in §2.5. Unknown/absent gender resolves to the men's array. |
| `layout` | `LayoutObject` | Output of `buildGenderLayout` (§2.7). Provides `hcps` and `hcpsWomen`. |

**Resolution rules:**

- Whole-array selection only. No per-hole branching, no per-hole interpolation.
- The returned array is a fresh copy (defensive — engines never mutate, but the
  contract guarantees a clone so accidental mutation never poisons the layout).
- A male player or a player with unknown gender always receives `layout.hcps`,
  even when `layout.hcpsWomen` is non-null (mirrors invariant 18).
- A female player on a course missing women's SI receives `layout.hcps` —
  the women's-SI warning banner in `NewRoundPage` (G-4) surfaces this case
  before the round starts, but the engine does not block on it.
- When `layout` itself is null/absent, `buildPlayerSI` falls back to `DEF_HCP`.
  This path is only exercised by `roundLib.toActiveRound` for legacy records
  that lack a course snapshot; live rounds always have a layout.

**Engine consumption (§5 amendment):** Every game engine (Match, Skins,
Stableford, Nines, Sixes, Stroke Play) and every helper that needs a per-hole
stroke-index rank for an individual player (`xGrossScore`, `escTotal`,
`scoreForMode` indirectly) reads `players[pi].siArray[h]` instead of the
round-shared `activeRound.hcps[h]`. The shared `hcps` array on `activeRound`
remains the source of truth for the SI display rows (`ScoreGrid` header,
`ZoomModal`, `ReadOnlyScorecard`) and is no longer used in any scoring path.

**Storage impact:** `siArray` is recomputable from `gender` + `layout`. It is
NOT serialized in `fromActiveRound`. `roundLib.toActiveRound` rebuilds it
defensively on every reload. ~144 bytes per player per round if it were
serialized — the choice not to serialize keeps the history record schema
unchanged.

---

## 3. Per-Hole Stroke Allocation: `hdcpStrokesFromCourseHcp`

```js
hdcpStrokesFromCourseHcp(courseHcp, rank) → number (0, 1, or 2)
```

Returns the number of strokes a player with the given course handicap receives
on a specific hole.

| Param | Type | Notes |
|---|---|---|
| `courseHcp` | `number` | Signed integer course handicap |
| `rank` | `number` | Hole stroke index, 1–18 (1 = hardest hole) |

**Formula:**

```
strokes = floor(courseHcp / 18) + (rank <= courseHcp % 18 ? 1 : 0)
```

**Boundary behavior:**

| `courseHcp` | Behavior |
|---|---|
| `≤ 0` (scratch or plus) | Returns `0` — no strokes received on any hole |
| `1–18` | Gets `1` stroke on the `courseHcp` hardest holes (rank 1 through courseHcp) |
| `19–36` | Gets `1` stroke on all 18 holes, plus `1` extra stroke on the `(courseHcp − 18)` hardest holes |

**Examples:**

```
courseHcp=20, rank=2  → floor(20/18) + (2 <= 20%18=2 ? 1 : 0) = 1 + 1 = 2
courseHcp=20, rank=3  → floor(20/18) + (3 <= 2 ? 1 : 0)       = 1 + 0 = 1
courseHcp=5,  rank=5  → floor(5/18)  + (5 <= 5 ? 1 : 0)       = 0 + 1 = 1
courseHcp=5,  rank=6  → floor(5/18)  + (6 <= 5 ? 1 : 0)       = 0 + 0 = 0
courseHcp=0,  rank=1  → 0 (early return)
```

**Plus handicap behavior:** Players with negative `courseHcp` values receive
`0` strokes (the `courseHcp <= 0` guard fires). Their strokes-given behavior
is handled exclusively via the net-off-low mechanism — they do not receive
negative stroke adjustments through `hdcpStrokesFromCourseHcp`.

**36-stroke boundary:** The formula is mathematically correct for values up to
36. Inputs above 36 are not validated by the engine — callers are responsible
for ensuring inputs are within USGA limits. Values above 36 will produce
results that may be numerically correct but are not covered by this contract.

---

## 4. Scoring Mode Functions

### 4.1 `scoreForMode` — Adjusted Score for a Single Hole

```js
scoreForMode(gross, courseHcp, rank, minCourseHcp, mode) → number | null
```

Converts a gross score to the mode-adjusted score for one hole.

**Parameters:**

| Param | Type | Notes |
|---|---|---|
| `gross` | `number\|null\|0` | Raw stroke count for this hole |
| `courseHcp` | `number` | Signed integer course handicap of this player |
| `rank` | `number` | Hole stroke index 1–18 |
| `minCourseHcp` | `number` | Minimum course handicap of the **participating subset** (see §5) |
| `mode` | `'gross'\|'net'\|'netofflow'` | Scoring mode |

**Return value:**

- Returns `null` if `gross` is falsy (null, undefined, 0, or empty). A missing
  score is always `null` — no adjustment is applied.
- Otherwise returns an integer adjusted score.

**Mode behavior:**

| Mode | Formula | Description |
|---|---|---|
| `'gross'` | `gross` | No adjustment; raw stroke count returned as-is |
| `'net'` | `gross − hdcpStrokesFromCourseHcp(courseHcp, rank)` | Standard net: subtract strokes received on this hole |
| `'netofflow'` | `gross − netOffLowStrokes(courseHcp, minCourseHcp, rank)` | Net off low: subtract strokes relative to the field low (see §4.3) |

**Null propagation:** `null` returns immediately — no mode branch executes.
All game engine functions depend on this null to detect incomplete scoring.

### 4.2 `strokesForMode` — Stroke Count for UI Display

```js
strokesForMode(courseHcp, hcpRank, minCourseHcp, mode) → number (0, 1, or 2)
```

Returns the number of handicap strokes a player receives on a hole for the
given mode. Used exclusively for **UI dot display** in `ScoreGrid` — never
for scoring math (use `scoreForMode` for scoring).

**Parameters:**

| Param | Type | Notes |
|---|---|---|
| `courseHcp` | `number` | Signed integer course handicap |
| `hcpRank` | `number` | Hole stroke index 1–18 |
| `minCourseHcp` | `number` | Min course handicap of participating subset |
| `mode` | `'gross'\|'net'\|'netofflow'` | Scoring mode |

**Mode behavior:**

| Mode | Return value | Formula |
|---|---|---|
| `'gross'` | `0` | No strokes in gross mode |
| `'net'` | `hdcpStrokesFromCourseHcp(courseHcp \|\| 0, hcpRank)` | Standard stroke allocation |
| `'netofflow'` | `floor(diff/18) + (hcpRank <= diff%18 ? 1 : 0)` where `diff = (courseHcp\|\|0) − (minCourseHcp\|\|0)` | Strokes relative to field low |

**Null/missing handling:** `courseHcp` and `minCourseHcp` are defensively
coerced to `0` via `|| 0` before arithmetic. Callers should not pass null.

**UI-only invariant:** `strokesForMode` is a permitted direct call from UI
components (see App Data Model Contract §4). It must never be used inside
engine scoring functions — use `hdcpStrokesFromCourseHcp` or `scoreForMode`
there instead.

### 4.3 Net Off Low Strokes (Internal)

The internal `netOffLow` function computes:

```
diff    = courseHcp − minCourseHcp
strokes = floor(diff / 18) + (rank <= diff % 18 ? 1 : 0)
net     = gross − strokes
```

`diff` is always `≥ 0` for any player who is not the lowest handicapper.
The player with `courseHcp === minCourseHcp` has `diff = 0` and receives
`0` additional strokes — they play to their own course handicap (or at scratch
if they are the lowest). A plus-handicap player with `courseHcp < minCourseHcp`
would produce a negative `diff`, but this cannot occur when `minCourseHcp` is
correctly computed as the minimum of the group — the minimum player always has
`diff = 0`, not negative. See §5 for the invariant that enforces this.

---

## 5. The Universal NOL + Subset Invariant ⚠️

**This is the most critical rule in this contract. All game contracts
cross-reference it.**

### §5.0 Engine Stroke-Index Source _(v2.0)_

> **Engines read `players[pi].siArray[h]` for stroke allocation. Never the round-shared `activeRound.hcps[h]`.**

The shared `hcps` field on `activeRound` exists for SI display rows only
(`ScoreGrid` header, `ZoomModal` header, `ReadOnlyScorecard` header,
`shareUtils` HTML SI row). It is not consulted by any scoring engine.

Every engine function that derives a stroke-index rank for an individual
player reads it from that player's `siArray`, attached at round-start by
`buildPlayerSI` (§2.8). The list of engine functions that consume per-player
SI is exhaustive:

- `runMatch` / `runTeamMatch` / `runMatchNassau` / `runNassau`
- `calcSkinsHole` / `calcSkins`
- `calcNines`
- `calcSixesSegment` / `runSixesSegment`
- `calcStablefordTotal` / `calcTeamStablefordTotal`
- `calcStrokePlay`
- `xGrossScore` (callers pass `players[pi].siArray`)
- `escTotal` (callers pass `players[pi].siArray`)

Engine signatures changed at v2.0: the `hcps` parameter previously threaded
through every engine function was dropped. Callers that previously passed
`hcps` as the round-shared array now omit it (engines read from each player
internally). The single exception is `computePayouts` itself, which retains
`hcps` as a parameter for caller back-compat — internally it ignores `hcps`
and the engines it calls read from `players[pi].siArray`.

Engines NEVER branch on `player.gender`. The branching happened once at
round-start inside `buildPlayerSI`. After that, `siArray` is the only stroke
index the engine sees, and the engine treats every player identically.

### 5.1 Root Definition

> **`minCourseHcp` passed to any engine function must always be the minimum
> course handicap among the players actually participating in that specific
> calculation — never from a superset of players.**

This applies to every engine function that accepts `minCourseHcp`:
- `scoreForMode`
- `strokesForMode`
- `calcSkinsHole` / `calcSkins`
- `runMatch` / `runTeamMatch`
- `runSixesSegment`
- `calcNines`
- `calcStablefordTotal`
- `calcStrokePlay`

### 5.2 Consequence: Subset Games

When a game operates on a **player subset** (e.g. Skins with `skinsPlayers`)
and the scoring mode is `'netofflow'`, the `minCourseHcp` supplied to the
engine **must be computed from the subset players only**. Computing it from
all players in the round and passing it to a subset game is a **contract
violation** — it will produce incorrect net-off-low adjustments for the
subset participants.

**Correct pattern:**
```js
const subsetCourseHcps = skinsPlayerIdxs.map(pi => cHcps[pi]);
const subsetMinCHcp    = Math.min(...subsetCourseHcps);
calcSkins(..., subsetMinCHcp, skinsPlayerIdxs);
```

**Incorrect pattern (violation):**
```js
const minCHcp = Math.min(...cHcps);  // ← uses ALL players
calcSkins(..., minCHcp, skinsPlayerIdxs);  // ← wrong when subset active
```

### 5.3 Consequence: Full-Field Games

For games where all round players always participate, `minCourseHcp` is simply
`Math.min(...cHcps)` over the full `cHcps` array. No special logic is needed.

Unconditionally full-field: **Nassau/Match** (per-match subset handled in §5.4),
**Nines** (exactly 3 players — subset by definition, handled by `subsetMin()`),
**Sixes** (currently 4-player only; 5-player subset deferred — see Sixes Contract §14).

Optional-subset games: **Stroke Play** (`strokePlayPlayers`), **Stableford**
(`stablefordPlayers`), **Skins** (`skinsPlayers`), **Specials** (`specialsPlayers`).
For these, `subsetMin()` in `payouts.js` (or `calcStrokePlay`'s internal `effMin`)
derives the correct minimum from the subset when `mode === 'netofflow'`. When the
subset is empty (all players participate), the full-field minimum is used unchanged.

### 5.4 Consequence: Match Subsets (Nassau/Match)

Each individual match in a Nassau configuration may involve only 2 of N
players (individual format) or 4 of N players (team format). When mode is
`'netofflow'`, the `minCourseHcp` for that match must be the minimum of only
the 2 (or 4) players in that match.

**Example:** In a 4-player round where players have course handicaps
`[0, 5, 12, 18]`, a match between players with handicaps `5` and `12` must
use `minCourseHcp = 5`, not `minCourseHcp = 0` (the full-field minimum).
Using `0` gives Player A (hcp 5) five extra strokes they should not receive,
and Player B (hcp 12) twelve strokes instead of the correct seven — a
completely different match result.

This is implemented via `subsetMin(cHcps, involved, minCHcp, matchMode)` computed
per match in `payouts.js`. ✅ Closed (G-2 — see §8).

### 5.5 Invariant Statement

> **Invariant:** For any call to any engine function with `minCourseHcp`,
> `Math.min(...courseHcps_of_participants) === minCourseHcp` must hold,
> where `courseHcps_of_participants` is the course handicap array restricted
> to the players whose scores are compared in that call.

Violation of this invariant produces mathematically incorrect net-off-low
scores silently — the engine cannot detect it internally.

---

### 5.6 NOL Dot Selector — Display Condition

The NOL dot selector is a unified segmented pill control rendered in
`ScorecardPage` that replaces the existing Net/NOL toggle whenever it appears.
It is shown when either of the following is true:

- **`isMixed` is true** (the round has both Net and NOL games), OR
- **At least one qualifying subset pill exists** (defined in §5.7)

When neither condition holds, no dot mode control is shown — a pure-Net or
pure-gross round shows nothing; a pure-NOL round with no qualifying subsets
shows nothing (single mode, no user choice needed).

**Segment composition rules:**

| Condition | Segments shown |
|---|---|
| `isMixed` only (no subset pills) | `Net` / `NOL` |
| `isMixed` + subset pills | `Net` / `NOL` / `NOL {game}` … |
| Pure NOL + subset pills | `NOL` / `NOL {game}` … |

`Net` is only included when `hasNet` is true. It is never shown in a pure-NOL
round.

**Layout:** The control is rendered as two separate bordered pill groups in a
`flex-wrap: wrap` row. The first group always contains the base mode segments
(`Net` and/or `NOL`). The second group contains the subset segments (`NOL
Skins`, `NOL Match A`, etc.) and is only rendered when subset pills exist.
When both groups fit on one line they sit side by side; when they do not fit
the second group wraps to the next line. The `Dots:` label sits to the left of
the first group. No horizontal scrolling is used.

**Hint text removal:** The hint text row (`"Enter/Tab = next cell · Hold score
= log dots"`) that previously appeared on the same line as the dot mode toggle
is removed entirely. It is not relocated — it is deleted.

---

### 5.7 Qualifying Games and Pill Generation Rule

A game generates a `NOL {game}` subset segment if and only if **all three**
of the following are true:

1. The game is active (included in `activeGames`)
2. The game's own scoring mode is `'netofflow'` (`gameOpts[key].grossNetNOL === 'netofflow'` for named games; `match.grossNetNOL === 'netofflow'` for match instances)
3. The game's participant subset excludes the round's global low-handicap player:

```
subsetMin > minCourseHcp
```

where `subsetMin = Math.min(...subsetIdxs.map(i => courseHcps[i]))` and
`subsetIdxs` is the resolved participant index array for that game.

**Empty subset rule:** An empty subset array (`[]`) means all players
participate. When a subset array is empty, `subsetMin === minCourseHcp` and
the game does not generate a segment. This is consistent with how the payout
engine handles empty subsets via `subsetMin()` in `payouts.js`.

**Qualifying games and segment labels:**

| Game | Subset source | Single-game label |
|---|---|---|
| Skins | `skinsPlayers` | `NOL Skins` |
| Stableford | `stablefordPlayers` | `NOL Stab` |
| Nines | `ninesPlayers` | `NOL Nines` |
| Stroke Play | `strokePlayPlayers` | `NOL Stroke` |
| Sixes | `sixesPlayers` | `NOL Sixes` |
| Match (each instance) | `[p1, p2]` or `[...teamA, ...teamB]` | `NOL Match A`, `NOL Match B`, … |

Match segment labels are derived from the match's position in the `matches`
array at render time — the same index-based labeling rule established in
session 11-J. They are not stored on the match object.

**Subset grouping rule:** After all qualifying games are identified,
`computeNolDotOptions` groups them by participant fingerprint — the sorted
participant index array joined as a string (e.g. `"1,2,3"`). Games whose
participant sets are identical produce the same dot display (same
`effectiveMinCourseHcp`, same `nonParticipantIdxs`) and are merged into a
single pill segment. The merged label joins individual game labels in
declaration order with ` / ` (e.g. `"NOL Skins / Match A"`). When a
fingerprint has only one game, the label and value are unchanged.

**`nolDotGame` value for merged segments:** When two or more games share a
fingerprint, the `nolDotGame` value is the fingerprint string itself (e.g.
`"1,2,3"`). When only one game has a fingerprint, the value is the
single-game string (e.g. `'Skins'`, `'Match:m_123'`). `ScorecardPage`
always derives `effectiveMinCourseHcp` and `nonParticipantIdxs` from the
option's `subsetIdxs` — it never parses the value string.

**Non-qualifying games:**

- **Dots / Specials** — Dots has a `dotsPlayers` subset but its scoring mode
  is always `'gross'`. Because NOL dot display requires `dotMode ===
  'netofflow'`, and Dots cannot be in NOL mode, it never produces a segment.
- **Sixes (4-player round)** — All 4 players always participate in a standard
  4-player Sixes game, so `subsetMin === minCourseHcp` and no segment is
  generated. In a 5-player round where `sixesPlayers` excludes the low player,
  a `NOL Sixes` segment is generated.

---

### 5.8 Subset-Min Computation Per Selection

The active segment determines `effectiveMinCourseHcp` and
`nonParticipantIdxs`, computed in `ScorecardPage`. All subset segments
(single-game or merged) carry their `subsetIdxs` from `computeNolDotOptions`
— `ScorecardPage` uses that array directly and never parses the value string.

```js
// 'net' segment selected:
effectiveMinCourseHcp = minCourseHcp;   // unused for dot display (dotMode='net')
nonParticipantIdxs    = new Set();

// 'NOL' (field) segment selected (nolDotGame === 'field'):
effectiveMinCourseHcp = minCourseHcp;   // full-field, unchanged
nonParticipantIdxs    = new Set();      // all players show dots

// Any NOL subset segment selected (single-game or merged):
//   opt = nolDotOptions.find(o => o.value === nolDotGame)
effectiveMinCourseHcp = Math.min(...opt.subsetIdxs.map(i => courseHcps[i]));
nonParticipantIdxs    = new Set(
  players.map((_, i) => i).filter(i => !opt.subsetIdxs.includes(i))
);
```

`effectiveMinCourseHcp` and `nonParticipantIdxs` are passed as props to
`ScoreGrid`, which passes them to `ZoomModal`. They are computed values —
never persisted.

---

### 5.9 Non-Participant Display

When a `NOL {game}` subset segment is active, players whose index appears in
`nonParticipantIdxs` receive **no dot display** — their dot cells render as if
`dotMode === null` (blank, no `PopDots` / `ZoomPopDots` rendered).

When the `NOL` (field) segment is active, `nonParticipantIdxs` is an empty
`Set` and all players receive dot display normally.

Suppression is applied at the cell level:

```js
{dotMode === 'netofflow' && !nonParticipantIdxs.has(pi) && (
  <PopDots courseHcp={courseHcps[pi]} hcpRank={hcps[h]}
           minCourseHcp={effectiveMinCourseHcp} mode={dotMode} />
)}
```

The same pattern applies to `ZoomPopDots` in `ZoomModal`.

---

### 5.10 ZoomModal Inheritance

`ZoomModal` does not own or recompute the segment selection. It receives
`effectiveMinCourseHcp` and `nonParticipantIdxs` as props (passed through
`ScoreGrid`) and renders what it receives.

The Net/NOL toggle previously rendered inside `ZoomModal`'s header for mixed
rounds is replaced by the same unified segmented pill, receiving the same
props. Selecting a segment inside ZoomModal calls `setDotModeOverride` and
`setNolDotGame` identically to the main scorecard control, producing immediate
dot display updates in both surfaces.

`ZoomModal` replaces `minCourseHcp` with `effectiveMinCourseHcp` in all
`ZoomPopDots` calls.

---

### 5.11 State Ownership

Two pieces of state in `ScorecardPage.jsx` jointly drive the unified pill:

**`dotModeOverride`** (existing) — `'net' | 'netofflow' | null`  
Unchanged from current behavior. Governs which base dot mode is active. When
`isMixed` is false, it is `null` and `dotMode` is determined by `defaultDotMode`.

**`nolDotGame`** (new) — string  
Value set: `'field'` | single-game string (`'Skins'`, `'Stab'`, `'Nines'`, `'Stroke'`, `'Sixes'`, `'Match:{matchId}'`) | fingerprint string (e.g. `'1,2,3'`) when two or more games share a participant set.  
Default: `'field'`.

Active segment mapping:

| Pill segment tapped | `dotModeOverride` set to | `nolDotGame` set to |
|---|---|---|
| `Net` | `'net'` | `'field'` (reset) |
| `NOL` | `'netofflow'` | `'field'` |
| Single-game subset (e.g. `NOL Skins`) | `'netofflow'` | Single-game value (e.g. `'Skins'`) |
| Merged subset (e.g. `NOL Skins / Match A`) | `'netofflow'` | Fingerprint string (e.g. `'1,2,3'`) |

**Reset rule:** `nolDotGame` resets to `'field'` whenever `dotMode` is not
`'netofflow'`:

```js
useEffect(() => {
  if (dotMode !== 'netofflow') setNolDotGame('field');
}, [dotMode]);
```

**Persistence:** `nolDotGame` is never written to `activeRound` or
`localStorage`. It is ephemeral UI state. It does not survive a page refresh
and this is by design.

---

### 5.12 Architecture Note

This feature is **display-only**. The NOL dot selector changes only which
`minCourseHcp` value is passed to `strokesForMode` for dot rendering in
`ScoreGrid` and `ZoomModal`. The following are explicitly unchanged:

- `handicap.js` — no modifications; `strokesForMode` signature unchanged
- `games.js`, `payouts.js` — no scoring or payout logic touched
- `activeRound` schema — no new persisted fields
- All game engine calls — receive the same arguments as before

---

### 5.13 `computeNolDotOptions` Helper

```js
// scorecardUtils.js — Category 2 derived state builder
computeNolDotOptions(
  activeGames, gameOpts, matches,
  skinsPlayers, stablefordPlayers, ninesPlayers, strokePlayPlayers, sixesPlayers,
  courseHcps, minCourseHcp
) → Array<{ value: string, label: string, subsetIdxs: number[] }>
```

Returns the array of qualifying subset segment options after grouping. The
`Net` and `NOL` (field) segments are not included — they are added
unconditionally by `ScorecardPage`.

**Two-phase implementation:**

Phase 1 — qualification: iterate all active games in declaration order
(Skins, Stab, Nines, Stroke, Sixes, then Match instances). For each, check
all three qualifying conditions (active, NOL mode, `subsetMin > minCourseHcp`).
Collect raw entries: `{ value, label, subsetIdxs }`.

Phase 2 — grouping: compute a fingerprint for each entry —
`[...subsetIdxs].sort((a,b)=>a-b).join(',')`. Group by fingerprint using a
`Map`. Entries with the same fingerprint are merged: their labels are joined
with ` / ` in declaration order; their `subsetIdxs` are taken from the first
entry (identical for all); their `value` becomes the fingerprint string when
two or more games share it, or stays as the single-game value when alone.

Each returned object:

| Field | Type | Description |
|---|---|---|
| `value` | `string` | `nolDotGame` state value. Single-game value (e.g. `'Skins'`) when unmerged; fingerprint (e.g. `'1,2,3'`) when merged. |
| `label` | `string` | Display label. Single game: `'NOL Skins'`. Merged: `'NOL Skins / Match A'`. |
| `subsetIdxs` | `number[]` | Participant index array — the authoritative source for `effectiveMinCourseHcp` and `nonParticipantIdxs` in `ScorecardPage`. Never derived from `value`. |

**Invariant:** `ScorecardPage` always uses `opt.subsetIdxs` to compute derived
values. It never parses or inspects the `value` string beyond identity
comparison (`o.value === nolDotGame`).

**Location:** `scorecardUtils.js` — display logic layer.

---

## 5.14 `escTotal` — Adjusted Gross Score for GHIN Posting

_(Renumbered from §5.6 in v1.5 — content unchanged.)_

```js
escTotal(scores, pi, pars, hcps, courseHcp) → number
```

Computes the **Adjusted Gross Score (AGS)** a player should post to GHIN.
Per the USGA World Handicap System (effective January 2020), the maximum
score on any hole for handicap posting purposes is **Net Double Bogey**:

```
cap[h] = par[h] + 2 + hdcpStrokesFromCourseHcp(courseHcp, hcps[h])
```

That is: double bogey (par + 2), plus the number of standard net strokes the
player would receive on that hole. The ESC total is:

```
escTotal = Σ min(gross[h], cap[h])  for all scored holes
```

| Param | Type | Notes |
|---|---|---|
| `scores` | `Array` | `scores[hole][pi]` — the full 18-hole score array |
| `pi` | `number` | Player index |
| `pars` | `number[18]` | Par for each hole |
| `hcps` | `number[18]` | Stroke index (rank 1–18) for each hole |
| `courseHcp` | `number` | Signed integer course handicap for this player |

**Stroke allocation used:** Always `hdcpStrokesFromCourseHcp` (standard net),
never NOL. ESC is a GHIN posting tool — it always uses the player's full
course handicap regardless of the scoring mode used for any active game.

**Unscored holes:** Holes where `gross` is falsy (0, null, empty) are skipped
entirely. This means the function is safe to call mid-round on the live
scorecard — it returns a running ESC total for however many holes have been played.

**Plus handicaps:** `courseHcp ≤ 0` → `hdcpStrokesFromCourseHcp` returns 0 →
cap = par + 2 on every hole. Correct: a plus-handicap player's maximum is
double bogey, no bonus strokes.

**Return value:** Non-negative integer. Returns `0` if no holes have been scored.

**X score handling:** Holes scored `'X'` (player picked up) are already at
their ESC maximum by definition — `xGross = par + 2 + strokes = cap[h]`.
`escTotal` treats `'X'` as equal to the ESC cap for that hole: it calls
`xGrossScore()` and uses that value directly, applying no further `min()` cap.
`parseInt('X')` must never be used — the raw string must be checked first.

**Permitted caller:** `TotalsCard.jsx` — display-only. This is a permitted
direct engine call from a UI component (same class as `scoreForMode`). No
game engine, payout block, or scoring function may call `escTotal` — it is
purely for post-round display.

---

## 5.15 `xGrossScore` — Gross Value for a Pickup Score

_Added session 13-B. See `ScoreKeypad_Contract.md` §4.2._

```js
xGrossScore(holeIdx, courseHcp, hcps, pars) → number
```

Computes the numeric gross value for a hole where the player picked up (`'X'`).
Per USGA rules, a pickup is assigned Net Double Bogey — the same value as the
ESC cap for that hole:

```
xGross = pars[holeIdx] + 2 + hdcpStrokesFromCourseHcp(courseHcp, hcps[holeIdx])
```

| Param | Type | Notes |
|---|---|---|
| `holeIdx` | `number` | 0-based hole index |
| `courseHcp` | `number` | Player's full signed course handicap (never NOL offset) |
| `hcps` | `number[18]` | Stroke index (rank 1–18) for each hole |
| `pars` | `number[18]` | Par for each hole |

**Stroke allocation:** Always uses the player's **full** `courseHcp` (standard
net strokes). Never uses the NOL offset. This is consistent with ESC, which is
always computed from the full course handicap regardless of scoring mode.

**Return value:** Positive integer ≥ `par + 2`. Never less than double bogey.

**Permitted callers:**
- `handicap.js` — `escTotal()` calls it for X holes
- `ScoreGrid.jsx` — cell display (NX rendering)
- `ZoomModal.jsx` — cell display (NX rendering)
- `TotalsCard.jsx` — gross total computation
- `RoundSummaryModal.jsx` / `roundUtils.js` — read-only scorecard display
- `NinesTable.jsx`, `MatchNassauTable.jsx` — display-layer scoring (X handling)

No game engine or payout function may call `xGrossScore` directly — engine
functions receive raw `scores` arrays and handle `'X'` via their own X guards.

---

## 5.16 Plus-CH Cell Indicator

_Added session 13-F._

### §5.16.1 Purpose and trigger condition

A player with a **negative course handicap** (`courseHcps[pi] < 0`) gives
strokes back to the course on the EASIEST holes (per USGA Rule of Handicapping).
They receive zero dots from `PopDots` (since `hdcpStrokesFromCourseHcp` returns
0 for `courseHcp ≤ 0`). The `+` indicator marks which holes are "plus holes"
for the plus-CH player — the holes where they owe a stroke back.

**A plus hole for player `pi` on hole `h` is any hole where:**
```
siRank(pi, h) > 18 - Math.abs(courseHcps[pi])
```

where `siRank(pi, h)` is the **player's gender-appropriate stroke index** for
hole `h`: women's SI (`hcpsWomen[h]`) for female players when `hcpsWomen` is
available, falling back to men's SI (`hcps[h]`). Male players always use men's
SI. This rule applies identically to `PopDots` dot count and the `+` indicator.

For a player with CH = -5, this fires on holes ranked SI 14, 15, 16, 17, 18 —
the five easiest holes by stroke index. This matches USGA Rule of Handicapping
section 6: a player with a plus handicap "gives back" strokes on the holes
ranked by the highest stroke-index numbers (easiest), starting from SI 18 and
working down. The number of strokes given back equals `Math.abs(CH)`.

**Important edge case:** A player does not need a plus HI to have a negative CH.
A player with a low positive HI (e.g. `0.3`) playing a very easy course (low
slope/rating) may have a computed `courseHandicap` of `0` or even `-1`. The
indicator fires for `courseHcps[pi] < 0` regardless of the sign of `player.ghin`.

### §5.16.2 Display spec

The indicator replaces `PopDots` for plus-CH players. It never coexists with
dots — a player either receives dots (CH > 0) or receives `+` indicators (CH < 0)
or receives nothing (CH = 0, scratch).

**Rendering:**
- Position: same as `PopDots` — `position: absolute`, `bottom: 2`, `right: 2`
- Content: a single small `+` character
- Font size: matches dot diameter — approximately `6px` bold, color `G` (green)
- No dots rendered alongside the `+`

**Logic (replaces the `PopDots` call):**
```js
const ch = courseHcps[pi];
if (ch < 0 && hcps[h] > 18 - Math.abs(ch)) {
  // render + indicator
} else if (ch > 0) {
  // render PopDots (existing behavior)
}
// ch === 0: render nothing
```

**Important:** The plus-CH check must be evaluated BEFORE any early bail on
`dotMode === 'gross'`. The `+` indicator is independent of dot mode — it
expresses a structural USGA fact about strokes given back, not a stroke-allocation
display preference. `ReadOnlyScorecard.hcpDots` and `shareUtils.hcpStrokesHtml`
both run the plus-CH check first, then bail on dotMode.

In NOL mode with the NOL dot selector active, the `effectiveMinCourseHcp`
used for dot display does not affect the `+` indicator — the indicator is
always based on the player's absolute `courseHcps[pi]`, never a NOL offset.

### §5.16.3 Affected display surfaces

The `+` indicator must appear on all surfaces that currently render `PopDots`:

| Surface | File | Current dot rendering | Change |
|---|---|---|---|
| Live scorecard | `ScoreGrid.jsx` | `<PopDots>` component | Replace with `+` indicator when `ch < 0` |
| Zoom modal | `ZoomModal.jsx` | `<ZoomPopDots>` component | Same replacement |
| Read-only scorecard | `ReadOnlyScorecard.jsx` | `hcpDots()` helper | Same replacement |
| Share image (displayed) | `shareUtils.js` | `hcpStrokesHtml()` helper | Same replacement — HTML span |
| Share image (exported PNG) | `shareUtils.js` | Same `hcpStrokesHtml()` | Same |

### §5.16.4 Non-participant handling

In NOL mode, `nonParticipantIdxs` marks players outside the selected NOL game.
For non-participants, `PopDots` is already suppressed. The `+` indicator follows
the same suppression rule — it is not shown for non-participants in the NOL
dot-selector context.

### §5.16.5 Invariants

- The `+` indicator and `PopDots` are mutually exclusive per player per hole.
- The indicator size must not exceed the size of a single dot from `PopDots`.
- The `+` is always green (`G`) — never amber, red, or gray.
- `courseHcps[pi] === 0` renders nothing (scratch player, no indicator).
- The indicator does not appear in game-table components (`MatchNassauTable`,
  `NinesTable`, etc.) — only in the four display surfaces listed in §5.16.3.

---

## 6. Stableford Points: `stabPts`

### 6.1 Function Signature

```js
stabPts(gross, par, courseHcp, rank, minCourseHcp, mode, stabTable) → number | null
```

| Param | Type | Notes |
|---|---|---|
| `gross` | `number\|null\|0` | Raw stroke count for this hole |
| `par` | `number` | Par for this hole |
| `courseHcp` | `number` | Signed integer course handicap |
| `rank` | `number` | Hole stroke index 1–18 |
| `minCourseHcp` | `number` | Min course handicap of participating subset |
| `mode` | `'gross'\|'net'\|'netofflow'\|null` | Scoring mode; `null` defaults to `'net'` |
| `stabTable` | `object\|null` | Point table; `null` defaults to `DEFAULT_STAB` |

### 6.2 Computation

```
net = scoreForMode(gross, courseHcp, rank, minCourseHcp, mode || 'net')
d   = clamp(par − net, −3, 3)
pts = stabTable[String(d)] ?? 0
```

1. The net score is computed using `scoreForMode` — meaning Stableford
   automatically supports all three scoring modes.
2. `d = par − net` — positive `d` means under par (good).
3. `d` is clamped to `[−3, 3]`. Scores worse than triple bogey (+3) or
   better than albatross (−3) are treated as the boundary value.
4. The clamped `d` is looked up in the point table as a string key.
5. If the key is absent from the table, `0` points are returned.

### 6.3 Null Handling

Returns `null` if `gross` is falsy (same null propagation as `scoreForMode`).
A missing score produces no points — callers must treat `null` as `0` when
accumulating totals.

### 6.4 Scoring Mode Dependency

`stabPts` is fully mode-aware. The `mode` parameter controls whether the net
score used for Stableford point calculation is gross, standard net, or net off
low. All game engine callers must pass the same `mode` that is configured for
the Stableford game in `gameOpts.Stableford.scoring`.

Default when `mode` is `null` or absent: `'net'`.

### 6.5 `DEFAULT_STAB` Table

Modified Stableford scoring — the default table used when `stabTable` is null:

| `d` (par − net) | Score name | Points |
|---|---|---|
| `−3` (triple bogey or worse) | — | `0` |
| `−2` (double bogey) | — | `0` |
| `−1` (bogey) | — | `1` |
| `0` (par) | Par | `2` |
| `1` (birdie) | Birdie | `3` |
| `2` (eagle) | Eagle | `4` |
| `3` (albatross or better) | Albatross | `5` |

```js
export const DEFAULT_STAB = {
  '-3': 5, '-2': 4, '-1': 3,
  '0': 2, '1': 1, '2': 0, '3': 0
};
```

**Sign convention note:** Because `d = par − net`, a positive `d` means
_under_ par (good) and a negative `d` means _over_ par (bad). So `'3'` maps
to albatross/3-under (5 pts) and `'-3'` maps to triple-bogey-or-worse (0 pts).
This is the reverse of what a reader might intuitively expect from the key
names alone. The implementation is correct — this note exists to prevent
misreading. The same note should appear as a comment directly above
`DEFAULT_STAB` in `handicap.js` (see §8 G-3).

### 6.6 Custom Stableford Tables

Callers may pass a custom `stabTable` with any subset of string keys
`'-3'` through `'3'`. Missing keys return `0`. The `DEFAULT_STAB` is exported
and may be spread to create partial overrides:

```js
const myTable = { ...DEFAULT_STAB, '0': 0 }; // par = 0 pts instead of 2
```

---

## 7. Hole Layout: `buildLayout`

```js
buildLayout(nines, frontName, backName) → { pars, hcps, frontName, backName }
```

Combines two nine-hole definitions into a single 18-hole layout.

| Param | Type | Notes |
|---|---|---|
| `nines` | `Nine[]` | Array of nine definitions from course record |
| `frontName` | `string` | Name of the front nine (e.g. `'Front'`) |
| `backName` | `string` | Name of the back nine (e.g. `'Back'`) |

**Return shape:**

```js
{
  pars:      number[18],   // par for each hole, front nine first
  hcps:      number[18],   // combined stroke index 1–18 across both nines
  frontName: string,       // resolved front nine name
  backName:  string,       // resolved back nine name
}
```

**Stroke index interleaving:** The two nines carry their own local handicap
rankings (e.g. front might use odds 1–17, back might use evens 2–18, or each
nine might rank 1–9 independently). `buildLayout` converts local rankings to a
single 18-hole combined stroke index:

- Front nine holes are assigned odd ranks: the front hole ranked 1st hardest
  locally gets rank `1`, the 2nd hardest gets rank `3`, …, 9th hardest gets
  rank `17`.
- Back nine holes are assigned even ranks: the back hole ranked 1st hardest
  locally gets rank `2`, the 2nd hardest gets rank `4`, …, 9th hardest gets
  rank `18`.

This ensures that the combined `hcps` array passed to `hdcpStrokesFromCourseHcp`
always has ranks in `[1, 18]` with no duplicates, meeting the requirements of
the stroke allocation formula.

**Fallback behavior:** If `frontName` is not found in `nines`, `nines[0]` is
used. If `backName` is not found, `nines[1]` is used (or `nines[0]` again for
a 9-hole course). Default pars and handicap arrays from `DEF_PARS` / `DEF_HCP`
are used when a nine has no pars or handicaps defined.

**Exported constants:**
```js
export const DEF_PARS = [4,4,3,5,4,3,4,5,4, 4,3,5,4,4,3,5,4,4]; // 18-hole
export const DEF_HCP  = [7,11,15,1,5,17,3,9,13, 8,16,2,6,12,18,4,10,14];
```

---

## 8. Known Gaps and Open Items

### G-4 — Women's SI warning in `NewRoundPage` _(v1.9 — implemented)_

When any female player is added to the players group and the selected course
has no `handicapsWomen` data (`buildGenderLayout` returns `hasWomenSI: false`),
a warning banner is displayed below the Players card. The banner names the
affected player(s) by first name and links to course settings. It does not
block round start. It disappears when all female players are removed or when
women's SI data is present on the course. Not shown when no course is selected
(no course data at all — men's data also absent).

User-defined course handicap override is fully specified in §2.4 but has no
implementation anywhere in the codebase. The field does not exist in the player
schema, is not set in `NewRoundPage`, and `groupCourseHandicaps` has no code
to read it.

**Required work to implement:**
1. Add `courseHcpVal: number | null` to each player entry in the round snapshot
   (`activeRound.players`) — not to the permanent `playerLib` schema.
2. Add UI in `HIConfirmPopup` (or a parallel popup at round-start) with a
   "Course HCP" input per player. When filled, set `courseHcpVal`; when blank,
   leave it null so the USGA formula runs.
3. Update `groupCourseHandicaps` to return `p.courseHcpVal ?? courseHandicap(...)`
   for each player.
4. Update `App_Data_Model_Contract.md` §2 to document the new field.

Until implemented, the USGA formula is always used for every player and
`courseHcpVal` is treated as permanently absent.

---

### ~~G-2 — NOL + match subset: full-field `minCHcp` passed to per-match engine calls~~ ✅ CLOSED

Fixed in `payouts.js` Match/Nassau block. For each match, `involved` indices
(`[p1,p2]` or `[...teamA,...teamB]`) are assembled and `matchMin = subsetMin(cHcps,
involved, minCHcp, matchMode)` is computed before calling `runMatchNassau`. The
full-field `minCHcp` is no longer passed to per-match engine calls when mode is
`'netofflow'`. See Payout Contract §4.3 and §7.3.

---

### ~~G-3 — `DEFAULT_STAB` sign convention needs source comment~~ ✅ CLOSED

Comment added directly above `DEFAULT_STAB` in `handicap.js`. The `d = par − net`
convention and counterintuitive negative-key = worse-score direction are now
documented inline. No logic change — comment only.

---

## 9. Exported API Surface

All public exports from `handicap.js`:

| Export | Type | Description |
|---|---|---|
| `DEF_PARS` | `number[18]` | Default 18-hole par values |
| `DEF_HCP` | `number[18]` | Default 18-hole stroke index values |
| `parseIndex` | function | Parse GHIN string → signed float |
| `courseHandicap` | function | USGA course handicap formula |
| `chp` | function | Legacy alias for `courseHandicap` (deprecated for new code) |
| `hdcpStrokesFromCourseHcp` | function | Per-hole stroke allocation |
| `strokesForMode` | function | UI dot count by mode |
| `scoreForMode` | function | Mode-adjusted score for one hole |
| `escTotal` | function | Adjusted Gross Score for GHIN posting (Net Double Bogey cap) |
| `xGrossScore` | function | Gross value for a pickup (X) score — par + 2 + strokes |
| `DEFAULT_STAB` | object | Default Stableford point table |
| `stabPts` | function | Stableford points for one hole |
| `buildLayout` | function | Combine two nines into 18-hole layout |
| `groupCourseHandicaps` | function | Batch course handicap computation |
| `minGroupHandicap` | function | Minimum of a course handicap array |

`netOffLow` and `netOf` are **internal** helpers — not exported. No external
code may depend on them.

---

## 10. Architecture Boundary

| Layer | Files | Role |
|---|---|---|
| Engine | `handicap.js` | All handicap math. Source of truth. |
| Engine consumers | `games.js`, `payouts.js` | Call `scoreForMode`, `stabPts`, `hdcpStrokesFromCourseHcp` |
| Display logic | `scorecardUtils.js` | May call `strokesForMode` for display-ready stroke counts; owns `computeNolDotOptions` |
| UI | `ScoreGrid.jsx` | May call `strokesForMode` directly (permitted; see App Data Model Contract §4) |
| State layer | `ScorecardPage.jsx`, `App.jsx` | Call `groupCourseHandicaps`, `minGroupHandicap` to build `cHcps` / `minCHcp` for `buildPayoutArgs`; owns `nolDotGame` and `dotModeOverride` state; computes `effectiveMinCourseHcp` and `nonParticipantIdxs` |

**Rules:**
- No UI component may reimplement handicap arithmetic. If a display value
  requires handicap math, call a function from `handicap.js`.
- `scoreForMode` is a permitted direct call from UI components for display-only
  net score derivation (e.g., showing the net score cell in `ScoreGrid`).
- `escTotal` is a permitted direct call from `TotalsCard.jsx` for display-only
  GHIN posting totals. No game engine or payout function may call `escTotal`.
- `xGrossScore` is a permitted direct call from UI display components
  (`ScoreGrid`, `ZoomModal`, `TotalsCard`, `RoundSummaryModal`, `NinesTable`,
  `MatchNassauTable`) for NX cell rendering and X-aware totals. No game engine
  or payout function may call `xGrossScore` — they handle `'X'` via their own
  X guards using raw score values.
- Game engine files (`games.js`, `payouts.js`) must not reimplement the stroke
  allocation formula — they must call `hdcpStrokesFromCourseHcp`.
- `minCourseHcp` must always be computed at the call site from the correct
  subset before being passed into any engine function (see §5). The engine
  never computes `minCourseHcp` internally.

---

## 11. Invariants

1. `courseHandicap` always returns a signed integer (via `Math.round`).
2. `hdcpStrokesFromCourseHcp` returns `0` for any `courseHcp ≤ 0`.
3. `hdcpStrokesFromCourseHcp` returns at most `2` for any `courseHcp ≤ 36`
   and any `rank` in `[1, 18]`.
4. `scoreForMode` returns `null` if and only if `gross` is falsy.
5. `strokesForMode` returns `0` in `'gross'` mode, always.
6. `stabPts` returns `null` if and only if `gross` is falsy.
7. For any player in the group, `strokesForMode(..., 'netofflow')` returns `0`
   for the player whose `courseHcp === minCourseHcp` (the low player gets no
   additional strokes in NOL mode).
8. The `minCourseHcp` passed to any engine function equals
   `Math.min(...courseHcps_of_participants)` — the minimum over the
   participating subset only. Any deviation from this is a contract violation.
9. `parseIndex` never returns `NaN` — unknown/empty input always yields `0`.
10. Plus handicaps flow as negative numbers through the entire engine. No
    engine function converts to/from `+` notation. Display conversion is
    exclusively a UI concern.
11. `escTotal` returns `0` if and only if no holes have been scored. For any
    scored hole, `escTotal ≤ grossTotal` — the adjusted score is never higher
    than the raw gross score.
12. `nolDotGame` is never persisted to `activeRound` or `localStorage`. It is
    ephemeral UI state owned exclusively by `ScorecardPage.jsx`.
13. `effectiveMinCourseHcp` passed to `strokesForMode` for dot display always
    equals `Math.min(...opt.subsetIdxs.map(i => courseHcps[i]))` for the
    currently selected `nolDotGame` option, or `minCourseHcp` when
    `nolDotGame === 'field'`. `ScorecardPage` always derives this from
    `opt.subsetIdxs` — never by parsing the `nolDotGame` value string.
    Any deviation is a contract violation.
14. The `Net` segment is only present in the unified dot control when `hasNet`
    is true. A pure-NOL round never shows a `Net` segment.
15. `xGrossScore()` always returns a value ≥ `par + 2`. It is never less
    than double bogey gross.
16. `xGrossScore()` always uses the player's full `courseHcp` — never a
    NOL offset. This is consistent with ESC calculation rules.
17. `parseInt('X')` must never be used as a score value anywhere in the
    codebase. Any function that accepts a raw score must check for `'X'`
    before calling `parseInt`.
18. `groupCourseHandicaps` uses `tee.slopeW` / `tee.ratingW` for any player
    whose `gender` normalises to `'f'`. If both women's tee fields are absent
    or zero, men's values are used as fallback — never vice versa. No male
    player ever uses women's tee data.
19. The `par` supplied to `courseHandicap` for a female player equals the sum
    of `parsWomen` values for the active nines when `parsWomen` is present;
    falls back to men's total par when absent.
20. `buildGenderLayout` returns `hcpsWomen: null` when either active nine lacks
    `handicapsWomen`. It never interpolates or fabricates women's SI from men's
    data. `hcpsWomen` is always either `null` or a complete 18-element array.
21. **`siArray` is built once at round-start from `buildPlayerSI(player, layout)`
    (§2.8) and stored on each player object in `activePlayers`. It is never
    recomputed during a round and never re-derived from gender or course data
    mid-round. Engines never branch on `player.gender` — they read
    `players[pi].siArray[h]` unconditionally. A `players` array passed into any
    engine function with a participant lacking `siArray` is a contract violation.
    `roundLib.toActiveRound` rebuilds `siArray` defensively on reload to honour
    this invariant for legacy records that predate v2.0.**
