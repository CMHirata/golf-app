# Stroke Play Contract

_Version 1.7 — April 2026_
_Supersedes: v1.6_
_Changes in v1.7 (13-C.3 Phase 2A):
§1.3 — `'segments'` mode tie behavior corrected: tied low scores now split the segment pot equally (was: "sole winner only"); matches `'total'` mode.
§3.7 (new) — partial-range note: F/B/T derived via PartialGameContract §3.6 midpoint when `gameRanges['Stroke Play']` is set or round is shorter than 18 holes.
§4.1 — segments-mode bet structure description updated to split-pot tie behavior.
§4.3 — "Known bug" callout reworded as historical note (G-4 closed).
§5.4 — `payWinner` usage note updated to acknowledge both `total` and `segments` modes now conform.
§5.8 — segments-mode payout formula rewritten: `payWinnerStroke` now returns per-name delta map; tie behavior is split-pot. New code is the canonical spec.
§5.9 (new) — segments breakdown column emission spec: `colHeaders: ['Front', 'Back', 'Total', 'Game Total']` and `matchCols: [f, b, o, f+b+o]`. Detected by Results page via `entry.colHeaders`.
§13 invariant 19 — rewritten to specify split-pot (was: sole-winner-per-segment).
§14 G-4 — CLOSED. Both `'total'` mode (fixed prior session) and `'segments'` mode (fixed 13-C.3 Phase 2A) conform to §4.3 / §5.0 tie detection rule. Reference code retained as historical traceability._
_Changes in v1.6: §14 G-1 closed — default `grossNetNOL` fallback corrected to `'gross'` in `StrokePlayTable.jsx`; `NewRoundPage` `allOpts` now explicitly writes `grossNetNOL` with correct per-game default; `App.jsx` `getActiveRound` applies live migration. Bug fixed in session 11-I.3._
_Changes in v1.4: §1.3 — `betMode` field replaces `strokeMode`; `'total'` replaces `'single'`; `'segments'` replaces `'nassau'`. Engine fallback chain documented. §4.1 — bet type descriptions updated. §4.2 — field table updated. §5.8 — section heading updated. §8.1 — schema updated. §13 — invariant 19 updated._
_Changes in v1.3: §1.3 — Nassau variant added (`strokeMode = 'nassau'`). §4.2 — `strokeMode` field added; per-segment bet fields `betF`, `betB`, `bet18` added. §5.8 — Nassau payout formula added. §8.1 — schema updated with new fields. §13 — invariant 19 (Nassau mode) added._
_Status: AUTHORITATIVE_
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._

---

**Engine file(s):** `engine/games.js`, `engine/payouts.js`, `engine/handicap.js`
**Table component:** `pages/tables/StrokePlayTable.jsx`
**Payout logic location:** `payouts.js` — Stroke Play block (search `activeGames.includes('Stroke Play')`)
**Cross-references:**
- `Handicap_Contract.md` §4 — `scoreForMode`, scoring modes
- `Handicap_Contract.md` §5 — NOL+subset invariant; `subsetMin()` pattern
- `Payout_Contract.md` §4.3 — `subsetMin()` universal implementation rule
- `Payout_Contract.md` §5.0 — split formula (tie handling)
- `Payout_Contract.md` §5.1 — Stroke Play tie note
- `Payout_Contract.md` §7.1 — Stroke Play payout block spec
- `App_Data_Model_Contract.md` §5.8 — `strokePlayPlayers` field
- `App_Data_Model_Contract.md` §10 — `buildPayoutArgs` synchronization rule
- `Round_Lifecycle_Contract.md` §4.5 — early-end model (`lastCompletedHole`, `earlyEndOpts`)
- `Round_Lifecycle_Contract.md` §12.3 — score input normalization invariant

---

## §1. Overview and Game Identity

### §1.1 Plain-language description

Stroke Play is the simplest game in the app. Each player accumulates a
total stroke count over the holes played. The engine converts each
hole's gross score to a mode-adjusted score using the configured
scoring mode (gross, net, or net-off-low), sums the totals, and ranks
players ascending — lowest total wins. The winner collects `bet` from
every other participating player. There are no segments, no per-hole
settlements, no teams, no presses, and no carryover.

In a full round, all 18 holes contribute to the total. When a round
ends early, only holes up to `lastCompletedHole` are included.

### §1.2 Game key (activeGames entry)

The string identifier in `activeGames[]` for this game is: `'Stroke Play'`

> ⚠️ **Key naming warning:** The key contains a space — `'Stroke Play'` — not
> camelCase. This matches the entry in `ALL_GAMES` in `games.js`. As a result,
> `gameOpts` must be accessed as `gameOpts['Stroke Play']`, never as
> `gameOpts.StrokePlay`. A mismatch causes silent non-payout — the game is
> active but no payout block fires. This is the only game key in the app that
> contains a space.

### §1.3 Format variants

| Variant | UI label | Stored `betMode` | Description | Configured by |
|---|---|---|---|---|
| `'total'` | Total | `'total'` | One winner-take-all settlement over 18 holes (or `lastCompletedHole`); tied low scores split the pot. **Default.** | `gameOpts['Stroke Play'].betMode` |
| `'segments'` | F/B/T | `'segments'` | Three independent segments (F9, B9, 18-hole); lowest total per segment wins; tied low scores split the segment pot equally (consistent with `'total'` mode and standard stroke-play etiquette). | `gameOpts['Stroke Play'].betMode` |

Default variant: **`'total'`** (replaces `'single'`; functionally identical).

> **Legacy values retired from UI:** `'single'` and `'nassau'` are no longer
> written by the setup UI. Engine fallback chain:
> `opts.betMode ?? opts.strokeMode ?? 'total'`
> Migration shim (`roundLib.migrateRecord`): `'single'` → `'total'`;
> `'nassau'` → `'segments'`; absent → no action (engine default handles it).
> Engine branches on `=== 'nassau' || === 'segments'` for the segments path.

---

## §2. Eligibility and Players

### §2.1 Valid player counts

| Player count | Valid? | Notes |
|---|---|---|
| 2 | Yes | No subset picker shown (all players always participate) |
| 3 | Yes | Subset picker shown in `NewRoundPage` |
| 4 | Yes | Subset picker shown in `NewRoundPage` |
| 5 | Yes | Subset picker shown in `NewRoundPage` |

Minimum required: 2 players in the participating subset.
Maximum allowed: 5 (round-level soft cap per Round Lifecycle Contract §2.3).

> **Subset picker trigger:** The `PlayerSubsetChips` picker in `NewRoundPage`
> is rendered only when `players.length > 2`. With exactly 2 players there is
> no picker and both always participate. This is a UI guard, not an engine
> constraint.

### §2.2 Subset support

Yes — Stroke Play supports a player subset.

- **State field:** `activeRound.strokePlayPlayers` — type: `number[]` (player
  indices); `[]` = all players participate
- **History record field:** `stroke_play_players` — mapped by `roundLib.fromActiveRound`
- **`buildPayoutArgs` key:** `strokePlayPlayers` — passed as top-level field
- **Engine parameter name:** `playerIdxs` (8th argument of `calcStrokePlay`;
  derived inside `computePayouts()` as `spIdxs` from `strokePlayPlayers`)
- **Selection UI:** `PlayerSubsetChips` in `NewRoundPage`, shown only when
  `players.length > 2`
- **Subset changes mid-round:** Apply retroactively to all holes within the
  active hole range per Round Lifecycle Contract §3.6. The engine recomputes
  from raw scores on every call — no per-hole eligibility state is stored.
- **Duplicate indices:** `strokePlayPlayers` must contain unique indices.
  Duplicates must be removed (deduped) before the array is passed to the
  engine. A player may not appear twice in the subset.

**Subset resolution in payout block:**
```js
const spIdxs   = strokePlayPlayers?.length ? strokePlayPlayers : players.map((_, i) => i);
const spPlayers = spIdxs.map(i => players[i]).filter(Boolean);
```
Empty array (`[]`) and absent/`undefined` both resolve to all players.

**Subset resolution in engine (`calcStrokePlay`):**
```js
const idxs = playerIdxs?.length ? playerIdxs : players.map((_, i) => i);
```
The engine applies the same fallback: `undefined`, `null`, and `[]` all
mean "all players."

**`strokePlayPlayers` full implementation chain — confirmed ✅:**
- `App_Data_Model_Contract.md` §5.8 — field declared
- `games.js calcStrokePlay` — 8th arg `playerIdxs` ✅
- `payouts.js` — `strokePlayPlayers` destructured; `spIdxs`/`spPlayers` derived ✅
- `roundLib.fromActiveRound` — writes `stroke_play_players` ✅
- `roundLib.toActiveRound` — reads `stroke_play_players` → `strokePlayPlayers` ✅
- `roundLib.toSetupState` — reads `stroke_play_players` → `strokePlayPlayers` ✅
- `App.jsx buildPayoutArgs` — passes `strokePlayPlayers` ✅
- `NewRoundPage.jsx` — `strokePlayPlayers` state; `PlayerSubsetChips` ✅
- `ScoreGrid.jsx` — passes `strokePlayPlayers` to `StrokePlayTable` ✅
- `ScorecardPage.jsx` — destructures and passes ✅
- `StrokePlayTable.jsx` — derives `activeIdxs` and `displayMin` ✅

### §2.3 Multi-instance support

No. There is exactly one Stroke Play game per round. The `activeGames` array
may contain `'Stroke Play'` at most once. The payout block fires once.

### §2.4 Team structure

N/A — Stroke Play is an individual scoring game. No teams.

---

## §3. Scoring

### §3.1 Scoring modes

Three modes are supported, configured per round via
`gameOpts['Stroke Play'].grossNetNOL`:

| Mode | Supported | Description |
|---|---|---|
| `'gross'` | Yes | Raw hole scores summed with no handicap adjustment. **Default.** |
| `'net'` | Yes | Each player's gross score is reduced by their per-hole stroke allocation before summing. |
| `'netofflow'` | Yes | Strokes received are relative to the lowest course handicap in the Stroke Play subset (not the full-field minimum — see §3.4). |

**Default:** `'gross'`

Invalid or unrecognized `grossNetNOL` values must be treated as `'gross'`
by both the engine and the display layer. See §13 invariant 18.

> ⚠️ **Known gap G-1:** The current `NewRoundPage` `<Sel>` for scoring mode
> falls back to `'net'` (`opts.grossNetNOL||'net'`) not `'gross'`. See §14 G-1.

### §3.2 Score comparison unit

Total adjusted strokes over the holes played (holes 0 through
`lastCompletedHole` inclusive), where "adjusted" means mode-adjusted
via `scoreForMode`. The player with the **lowest total** wins.

Tie condition: two or more players whose mode-adjusted totals are
exactly equal are tied. See §4.3 for tie payout handling. Tie handling
applies identically in early-end rounds — hole count does not affect
the tie detection or split formula.

**Note on display vs. ranking:** The display component renders each
player's total as strokes-vs-par (e.g. `+2`, `−1`, `E`). This is a
display convention only. The win condition is **lowest total strokes**
under the selected mode — not lowest-vs-par. Because par is the same for
all players, sorting by total strokes and sorting by strokes-vs-par
produce identical rankings. The contract states the win condition as
"lowest total strokes" to be unambiguous.

### §3.3 Team scoring rule

N/A — individual game; no team scoring.

### §3.4 Handicap application

Per-hole net score is computed by
`scoreForMode(gross, courseHcp, rank, minCourseHcp, mode)` inside
`calcStrokePlay`. See Handicap Contract §4.

**NOL+subset rule (AUTHORITATIVE):** When `mode === 'netofflow'`, the
`minCourseHcp` reference value (`effMin`) must be the minimum course
handicap among the Stroke Play subset participants only — not the
full-field minimum. This enforces the NOL+subset invariant (Handicap
Contract §5).

**Correct specified pattern (consistent with all other games):** The
payout block calls `subsetMin()` before calling `calcStrokePlay`, then
passes the result as `minCourseHcp`:

```js
// CORRECT SPECIFIED BEHAVIOR (not yet implemented — see §14 G-2):
const spMin = subsetMin(cHcps, spIdxs, minCHcp, mode);
const rows  = calcStrokePlay(scores, players, hcps, pars, mode, cHcps, spMin, spIdxs);
```

`calcStrokePlay` would then use `minCourseHcp` directly, without any
internal derivation. This matches the pattern used by every other game
(Stableford, Skins, Match/Nassau, Sixes, Nines).

**Current non-conforming implementation:** `calcStrokePlay` currently
derives `effMin` internally from `playerIdxs` rather than receiving it
from the payout block. The payout block does not call `subsetMin()` before
the engine call. This produces correct results for full-field rounds but
violates the architectural invariant that `subsetMin()` is always called
in the payout block. See §14 G-2.

**Display layer:** `StrokePlayTable` computes `displayMin` locally using
the same subset-min logic (✅ implemented, matches engine behavior for
current non-conforming code). When G-2 is fixed, `displayMin` must
continue to match whatever `effMin` the payout block uses. Any change
to the NOL baseline logic in either `calcStrokePlay` or the payout
block must be applied simultaneously in `StrokePlayTable` — the two
must always agree. See §13 invariant 9.

### §3.5 Score input and missing hole behavior

**Score value rule:** Score values in `scores[h][pi]` are either empty
string (`''`) or a valid positive integer string (e.g. `'4'`, `'10'`).
The UI must sanitize input to this format before persistence. The
engine must not receive non-numeric strings, negative values, or
whitespace-only strings. See Round Lifecycle Contract §12.3.

**Missing score behavior:** A hole with an empty string score is
treated as unplayed — not as zero. The engine excludes unplayed holes
from all totals rather than treating them as zero strokes. The
engine is deliberately tolerant of missing scores — it skips them
cleanly. However, the application layer guarantees that payout
computations only occur on complete data within the active hole range:
`App.handleGoResults()` enforces the completeness check before
`computePayouts` is ever called. The engine's tolerance is a safety
net, not a license to call it with incomplete data.

**Completeness check for results:** Before navigating to Results, the
app checks that all participating Stroke Play players have a score
entered for every hole up to `lastCompletedHole`. If any hole in the
active range is missing for any participant, an alert is shown and
navigation is blocked.

**Subset and completeness:** The completeness check applies only to
the current subset (`spIdxs`). Players excluded from the subset are
not checked. This means that narrowing the subset to only players
with complete scores will allow results to proceed even if excluded
players have incomplete scores. This is intentional behavior — subset
membership is the user's explicit declaration of who is participating.

**Early-end scoping:** When a round ends early, the completeness check
applies only to holes 0 through `lastCompletedHole`. Holes beyond that
are not required and are not included in rankings.

### §3.6 Early-end behavior

Stroke Play supports early-end settlement per Round Lifecycle Contract
§4.5. When `lastCompletedHole < 17`:

- Only holes 0 through `lastCompletedHole` (inclusive) contribute to
  each player's total.
- The completeness check (§3.5) is scoped to the active hole range only.
- `earlyEndOpts['Stroke Play']` controls whether a payout is issued:
  - `'payout'` (default) — ranking and payout computed over completed holes
  - `'no_payout'` — game ends with no money changing hands regardless of
    how many holes were played
- Tie handling (§4.3) applies identically in early-end rounds. A tie
  after 12 holes is resolved the same way as a tie after 18.

**Ranking with fewer than 18 holes:** The same winner-take-all (or
split on tie) logic applies regardless of hole count. A player with
the lowest total over, say, 14 holes wins the same way they would over
18 holes.

### §3.7 Segment relevance

| Segment | Holes (0-based, full round) | Used in |
|---|---|---|
| Front 9 | 0–8 | `'segments'` mode F9 bet; display sub-table |
| Back 9 | 9–17 | `'segments'` mode B9 bet; display sub-table |
| Full 18 | 0–17 | `'total'` mode; `'segments'` 18h bet; display chip bar |

In `'total'` mode the game is continuous — only the Full 18 score matters.
In `'segments'` mode each of F/B/Full has an independent bet (`betF` /
`betB` / `bet18`) and settles independently.

**13-C.3 — Non-standard ranges.** When the game has a custom range
(`gameRanges['Stroke Play']` is set) or the round is shorter than 18 holes,
Front/Back/Full segments are derived from the effective range via
PartialGameContract §3.6 (universal F/B/T midpoint rule). The split is
performed in `payouts.js` via the shared `splitRangeByMidpoint(startHole,
endHole)` helper, which returns `{ front, back, all }` hole-index arrays.
The engine (`calcStrokePlay`) remains range-unaware; payouts.js pre-trims
the `scores` array via `trimScoresToRange` so the engine's internal
18-hole iteration behaves as if out-of-range holes were never scored.

For the default full round `[0, 17]`, this produces the segment table
above — byte-identical to pre-13-C.3 behavior.

---

## §4. Bet Structure

### §4.1 Bet type

Two bet structures depending on `betMode`:

- **`'total'` mode:** One `bet` amount. Each losing player pays `bet` to the winner(s); tied low scores split the pot equally.
- **`'segments'` mode:** Three independent per-segment bets — `betF` (F9), `betB` (B9), `bet18` (18-hole). Each falls back to `bet` if `0` or absent. Tied low scores within a segment split that segment's pot equally; all tied = push (no payout for that segment).

### §4.2 Bet configuration fields

| Field | Location | Type | Default | Meaning |
|---|---|---|---|---|
| `bet` | `gameOpts['Stroke Play'].bet` | `number` | `0` | Dollar amount each loser pays per winner (total mode); also segments per-segment fallback |
| `grossNetNOL` | `gameOpts['Stroke Play'].grossNetNOL` | `string` | `'gross'` | Scoring mode: `'gross'`, `'net'`, or `'netofflow'` |
| `betMode` | `gameOpts['Stroke Play'].betMode` | `string` | `'total'` | Payout variant: `'total'` or `'segments'`. Canonical field as of v1.4. Engine reads: `betMode ?? strokeMode ?? 'total'` |
| `betF` | `gameOpts['Stroke Play'].betF` | `number` | `0` | Segments F9 bet; falls back to `bet` if `0` or absent |
| `betB` | `gameOpts['Stroke Play'].betB` | `number` | `0` | Segments B9 bet; falls back to `bet` if `0` or absent |
| `bet18` | `gameOpts['Stroke Play'].bet18` | `number` | `0` | Segments 18-hole bet; falls back to `bet` if `0` or absent |

> **`bet === 0` behavior:** In `'total'` mode, when `bet` is `0` the payout block is skipped entirely. In `'segments'` mode, only segments with a non-zero effective bet (after fallback resolution) produce payouts; segments with effective bet `0` are skipped.

### §4.3 Tie handling

When two or more players share the lowest mode-adjusted total, the §5.0
split formula from the Payout Contract applies.

**Tie detection rule:** The winners set `W` is defined as all players
in `rows` where `row.nd === rows[0].nd`. Every player with the lowest
`nd` value is a winner and must receive an equal share of the pot.
Only `rows[0]` is not sufficient — the full array must be scanned.
Losers `L` are all players in `rows` where `row.nd !== rows[0].nd`.

**Settlement:**
1. Each losing player (not tied for low) pays `bet` into the pot.
2. The pot is divided equally among all tied winners.

**Example:** 4 players, `bet = $10`. Alice and Bob both shoot 72 net
(tied low). Carol shoots 74, Dave shoots 76.

```
W = {Alice, Bob}  (nd === rows[0].nd)
L = {Carol, Dave}

Pot = 2 × $10 = $20
Each winner gets $20 / 2 = $10

gb: Alice +$10, Bob +$10, Carol −$10, Dave −$10 | Sum = $0 ✓
```

If **all** players tie (all share the lowest `nd`), `|L| = 0`, pot = $0,
and no money changes hands.

> **Historical note — see §14 G-4 (closed):** Pre-13-C.3, `'total'` mode
> code called `payWinner(rows[0].name, spPlayers, bet, gb)` — naming only
> `rows[0]` as winner. The tie detection rule above is the correct
> specified behavior. Both `'total'` mode (fixed in a prior session) and
> `'segments'` mode (fixed in 13-C.3 Phase 2A — see §5.8) now conform.

### §4.4 Press support

N/A — Stroke Play does not support presses. No `PressModal` involvement.
No `manualPresses` keys are created or read for Stroke Play.

### §4.5 Carryover

N/A — no per-hole or per-segment carryover mechanic.

---

## §5. Payout Structure

### §5.1 Payout structure type

Single winner-take-all (or split on tie) — one payout event at round end
(or at `lastCompletedHole` for early-end rounds).

### §5.2 Zero-sum proof

Let `W` = set of winning players (tied for low total), `L` = set of
losing players. `|W|` = number of winners, `|L|` = number of losers.

```
Each loser pays:    −bet
Each winner gets:   (|L| × bet) / |W|

Total out (losers): −|L| × bet
Total in (winners): |W| × (|L| × bet / |W|) = |L| × bet

Net = |L| × bet − |L| × bet = 0 ✓
```

Special case: all players tied → `|L| = 0` → pot = $0 → all net = $0 ✓

### §5.3 Payout formula

```
W = rows.filter(r => r.nd === rows[0].nd)   // all tied-for-low players
L = rows.filter(r => r.nd !== rows[0].nd)   // all losers

pot      = |L| × bet
each_win = pot / |W|

For each winner w in W:  gb[w.name] += each_win
For each loser  l in L:  gb[l.name] -= bet
```

**Authority rule:** `rows` (the sorted return value of `calcStrokePlay`)
is the authoritative membership list and ordering for settlement. The
`spPlayers` array (original order) must not be used as the settlement
list. All winner/loser classification and payout assignment must
reference `rows` entries directly.

### §5.4 `payWinner` usage

The `payWinner` helper is designed for sole-winner scenarios only. For
the correct tie-split behavior, the payout block must detect ties using
the formula in §5.3 and apply splits directly, not via `payWinner`.
Both `'total'` mode and `'segments'` mode now conform — see §14 G-4
(closed) for historical reference. The Payout Contract §3.4 documents
the `payWinner` usage constraint.

### §5.5 Early-end and `no_payout` behavior

When `earlyEndOpts['Stroke Play'] === 'no_payout'`, the payout block
does not fire regardless of how many holes were completed. `gb` remains
all zeros and no breakdown entry is added to results. The scorecard
display is unaffected.

When `earlyEndOpts['Stroke Play'] === 'payout'` (or `earlyEndOpts` is
absent), payouts are computed over the completed holes exactly as they
would be for a full round. There is no partial-hole proration — the
ranking is simply based on fewer holes.

### §5.6 `bet === 0` behavior

When `bet === 0`, the guard `if (bet > 0 && rows.length > 0)` causes
the payout block to be skipped. `gb` remains all zeros. No breakdown
row entry is added to the results. The scorecard display is unaffected.

### §5.7 Subset size guard

If the resolved subset (`spIdxs`) contains fewer than 2 players, the
Stroke Play payout block must be skipped entirely. A single-player
"game" produces no losers and no valid settlement. No error is thrown —
the block silently no-ops, identical to `bet === 0` behavior.

### §5.8 Segments mode payout formula

When `betMode === 'segments'` (or legacy `strokeMode === 'nassau'`), three segments are evaluated independently. Per-segment bet amounts: `spBetF = betF ?? bet`, `spBetB = betB ?? bet`, `spBet18 = bet18 ?? bet`.

For each segment, a helper computes the per-hole net-to-par for each subset player over the segment's holes, ranks ascending (lowest = best), then settles the segment using the §5.0 split formula (consistent with `'total'` mode and Stableford segments):

```js
// Returns a per-name delta map so the caller can emit per-segment column
// values on the Results breakdown (see §5.9). Accumulation into `gb` is
// unchanged from the original sole-winner version.
const payWinnerStroke = (segRows, segBet) => {
  const segDelta = {};
  players.forEach(p => (segDelta[p.name] = 0));
  if (segBet <= 0 || !segRows.length) return segDelta;
  const low = segRows[0].nd;
  const winners = segRows.filter(r => r.nd === low);
  const losers  = segRows.filter(r => r.nd !== low);
  if (losers.length > 0) {
    const pot   = losers.length * segBet;
    const split = pot / winners.length;
    winners.forEach(w => { gb[w.name] += split; segDelta[w.name] += split; });
    losers.forEach(l  => { gb[l.name] -= segBet; segDelta[l.name] -= segBet; });
  }
  return segDelta;
};
const fDelta = payWinnerStroke(segScore(FRONT), spBetF);
const bDelta = payWinnerStroke(segScore(BACK),  spBetB);
const oDelta = payWinnerStroke(rows18,          spBet18);
```

**Tie behavior (segments):** Tied low scores within a segment split that segment's pot equally — every player tied for the lowest `nd` receives `(losers.length × segBet) / winners.length`. All tied (no losers) = push (no payout for that segment). This matches `'total'` mode behavior and standard stroke-play etiquette.

**Breakdown label:** `'🏌️ Stroke Play (Nassau)'` when segments mode is active; `'🏌️ Stroke Play'` otherwise.

### §5.9 Segments breakdown column emission (13-C.3 Phase 2A)

In `segments` mode, the `breakdown` entry pushed by `payouts.js` includes `colHeaders` and per-row `matchCols` so the Results page renders Front / Back / Total / Game Total columns in a single-line columnar layout. The detection mechanism is `entry.colHeaders` — Results page (`DotsColTable`) routes columnar entries through the existing tabular renderer used by Dots team mode. Shape:

```js
breakdown.push({
  game: '🏌️ Stroke Play (Nassau)',
  colHeaders: ['Front', 'Back', 'Total', 'Game Total'],
  rows: rows18.map(r => {
    const f = fDelta[r.name] || 0;
    const b = bDelta[r.name] || 0;
    const o = oDelta[r.name] || 0;
    return {
      name:      r.name,
      matchCols: [f, b, o, f + b + o],
      net:       gb[r.name] || 0,
    };
  }),
});
```

`matchCols[3]` (the Game Total column) equals `f + b + o` — the sum of the player's settled per-segment deltas. The `net` field is the per-player aggregate accumulated into `gb` (which equals `f + b + o` for any single segments-mode round, but the contract treats them as semantically distinct so consumers may rely on either).

`'total'` mode does NOT emit `colHeaders` — the legacy single-row format (`{ name, detail, net }`) is preserved. See Payout Contract §3.2 for the canonical breakdown row shape and the `colHeaders` detection rule.

---

## §6. Engine API

### §6.1 Engine function signature

```js
calcStrokePlay(
  scores,        // scores[hole][playerIdx] — raw gross scores ('' or positive integer string)
  players,       // Player[] — full player array
  hcps,          // number[] — stroke index per hole (1 = hardest, 18 = easiest)
  pars,          // number[] — par per hole
  mode,          // 'gross' | 'net' | 'netofflow' — invalid values default to 'gross'
  courseHcps,    // number[] — course handicap per player (signed integer)
  minCourseHcp,  // number — minimum course handicap (full-field or subset per §3.4)
  playerIdxs,    // number[] | undefined — unique subset indices ([] | undefined = all)
  lastHole,      // number | undefined — last completed hole index (0-based); absent = 17
)
→ [{ name, pi, gt, nt, nd }]   // sorted ascending by nd (lowest = best/winning)
```

**`lastHole` parameter:** When provided, only holes 0 through `lastHole`
inclusive are included in totals. Holes beyond `lastHole` are skipped
entirely — not treated as zero. When absent or invalid (per Round
Lifecycle Contract §12.13), defaults to `17`.

**Array length consistency:** `scores`, `pars`, `hcps`, and `courseHcps`
must all be length-consistent with the round's 18-hole structure and
player count respectively. Mismatched array lengths are undefined
behavior. The engine does not validate lengths — the caller is
responsible for ensuring consistency before calling.

**Return value fields:**

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | Player name |
| `pi` | `number` | Original player index in the full `players` array |
| `gt` | `number` | Gross stroke total (active holes only, raw scores summed) |
| `nt` | `number` | Net stroke total (mode-adjusted via `scoreForMode`, summed) |
| `nd` | `number` | `nt − parTotal` — net strokes vs par over active holes |

Return is sorted ascending by `nd` — `rows[0]` has the lowest total.
On a tie, tied players appear consecutively but their relative order
within the tie is not guaranteed. UI may apply its own stable sort
for display purposes; this does not affect payout.

### §6.2 Caller responsibilities

- Caller must pass `mode` consistent with `gameOpts['Stroke Play'].grossNetNOL`.
  Invalid mode values default to `'gross'` (§13 invariant 18).
- Caller must pass `playerIdxs` as a deduplicated array consistent with
  the resolved `spIdxs` (empty array or absent = all players).
- Caller must pass `lastHole` from `ar.lastCompletedHole` (or omit for
  full rounds). Invalid values are normalized to `17` by the engine.
- When G-2 is fixed: caller must call `subsetMin(cHcps, spIdxs, minCHcp, mode)`
  and pass the result as `minCourseHcp`. The engine will not derive `effMin`
  internally after the fix.

### §6.3 Return value contract

- Array always has at least one entry if `playerIdxs` resolves to at
  least one player.
- Players not in `playerIdxs` do not appear in the return array.
- Unplayed holes (empty string scores) are excluded from totals. `gt`
  and `nt` reflect only holes with valid positive integer scores.
- `parTotal` used in computing `nd` is summed only over active holes
  (0 through `lastHole`) to keep the vs-par display meaningful.

### §6.4 Calling convention

`calcStrokePlay` is called from `computePayouts()` in `payouts.js` only.
It is imported into `payouts.js` from `games.js`. No other caller may
invoke `calcStrokePlay` for payout purposes. `StrokePlayTable.jsx` does
not call `calcStrokePlay` — it calls `scoreForMode` directly for display.

---

## §7. Display Component

### §7.1 Table component

`pages/tables/StrokePlayTable.jsx`

### §7.2 Props received

| Prop | Type | Meaning |
|---|---|---|
| `players` | `Player[]` | Full player array |
| `scores` | `scores[hole][pi]` | Raw gross scores |
| `pars` | `number[]` | Par per hole |
| `hcps` | `number[]` | Stroke index per hole |
| `opts` | `object` | `gameOpts['Stroke Play']` — includes `grossNetNOL` |
| `courseHcps` | `number[]` | Course handicap per player |
| `minCourseHcp` | `number` | Full-field minimum course handicap |
| `strokePlayPlayers` | `number[]` | Subset player indices (`[]` = all) |
| `lastCompletedHole` | `number \| undefined` | Last played hole (0-based); absent = full round |

### §7.3 Display layout

- **Front 9 sub-table:** Holes 1–9 (indices 0–8), one row per subset player
- **Back 9 sub-table:** Holes 10–18 (indices 9–17), one row per subset player
- **Footer chip bar:** All subset players as chips, sorted ascending by
  cumulative net-to-par over played holes; leader (lowest) gets highlighted
  background. UI may apply a stable sort for display; this does not affect
  payout authority.

Holes beyond `lastCompletedHole` render as unplayed (`·`) regardless of
whether any score value is present.

### §7.4 Cell rendering

Each hole cell shows the player's mode-adjusted score versus par for
that hole (`net − par`), formatted as:

| Value | Display |
|---|---|
| `null` / unplayed | `·` |
| `0` (even) | `E` |
| `> 0` (over par) | `+N` |
| `< 0` (under par) | `−N` |

Half-total column (F9 or B9 col) shows the cumulative strokes-vs-par
for that nine over played holes only. Footer chip shows the cumulative
strokes-vs-par over all played holes. Leader chip is highlighted only
when `thru > 0`.

### §7.5 Color tokens

| Condition | Color |
|---|---|
| Under par (`< 0`) | `#27ae60` (green) |
| Over par (`> 0`) | `RED` token from `ui.jsx` |
| Even (`=== 0`) | `#555` (grey) |
| Missing (`null`) | `#ddd` (light grey) |

### §7.6 Subset filtering

`StrokePlayTable` derives `activeIdxs` from `strokePlayPlayers`:

```js
const activeIdxs = strokePlayPlayers?.length
  ? strokePlayPlayers
  : players.map((_, i) => i);
```

Only players in `activeIdxs` are rendered as rows.

### §7.7 NOL display baseline

`StrokePlayTable` computes `displayMin` locally, mirroring the engine's
`effMin` logic (under the current non-conforming pattern):

```js
const displayMin = (mode === 'netofflow' && activeIdxs.length)
  ? Math.min(...activeIdxs.map(i => courseHcps[i]))
  : minCourseHcp;
```

When G-2 is fixed, `displayMin` must continue to use the same
subset-min logic so display and payout always agree on the NOL
baseline. Any change to the NOL baseline logic in the engine or payout
block must be applied simultaneously here.

### §7.8 Permitted direct engine calls

`StrokePlayTable` calls `scoreForMode` directly from `handicap.js`. This
is the only permitted direct engine call from the display layer for this
game. See App Data Model Contract §4.

---

## §8. Configuration Schema

### §8.1 `gameOpts['Stroke Play']` shape

```js
gameOpts['Stroke Play'] = {
  grossNetNOL: 'gross' | 'net' | 'netofflow', // default: 'gross'
  bet:         number,                          // default: 0; total mode amount; segments fallback
  betMode:     'total' | 'segments',           // default: 'total'. Canonical field as of v1.4.
                                               // Engine reads: betMode ?? strokeMode ?? 'total'
  betF:        number,                         // segments F9 override; 0/absent → bet
  betB:        number,                         // segments B9 override; 0/absent → bet
  bet18:       number,                         // segments 18-hole override; 0/absent → bet
}
```

> ⚠️ **Key reminder:** `gameOpts['Stroke Play']` — bracket notation required.
> `gameOpts.StrokePlay` is always `undefined`.

### §8.2 `buildPayoutArgs` fields consumed

The Stroke Play payout block reads these fields from `buildPayoutArgs`:

| Field | Type | Source |
|---|---|---|
| `players` | `Player[]` | Full player array |
| `pars` | `number[]` | Par per hole |
| `hcps` | `number[]` | Stroke index per hole |
| `scores` | `scores[h][pi]` | Current scores |
| `activeGames` | `string[]` | Gate condition |
| `gameOpts['Stroke Play'].bet` | `number` | Bet amount |
| `gameOpts['Stroke Play'].grossNetNOL` | `string` | Scoring mode |
| `strokePlayPlayers` | `number[]` | Subset indices (deduplicated) |
| `courseHcps` | `number[]` | Pre-computed course handicaps |
| `minCourseHcp` | `number` | Full-field minimum course handicap |
| `lastCompletedHole` | `number \| undefined` | Early-end hole index; absent = full round |
| `earlyEndOpts` | `object \| undefined` | Per-game early-end decisions |

### §8.3 Breakdown row format

The breakdown row must convey the player's gross total, net total, and
relative score. The exact string format of the `detail` field is
illustrative — implementations may vary in exact wording as long as
this information is present:

```js
{
  game: '🏌️ Stroke Play',
  rows: [
    {
      name:   string,   // player name
      detail: string,   // e.g. "78 gross / 72 net (+0)" or "thru 14" for early-end
      net:    number,   // payout amount (positive = win, negative = loss)
    },
    // one entry per subset player, sorted ascending by nd
  ]
}
```

---

## §9. Validation Rules (NewRoundPage)

| Rule | Where enforced | Notes |
|---|---|---|
| Subset picker shown | `NewRoundPage` | Only when `players.length > 2` |
| Minimum 2 players in subset | `NewRoundPage` + payout guard | UI prevents; engine skips if < 2 reach it |
| Single instance | `activeGames` membership | `'Stroke Play'` can appear at most once |
| Scoring mode options | `<Sel>` in `NewRoundPage` | `gross` / `net` / `netofflow` |
| Default scoring mode | `opts.grossNetNOL \|\| 'gross'` | **Specified default is `'gross'`** |
| Completeness check | `App.handleGoResults()` | All active-range holes scored before results |
| Duplicate subset indices | Deduped before use | Caller responsibility per §2.2 |

---

## §10. Press UI Contract

N/A — Stroke Play does not support presses. No `PressModal` involvement.
No `manualPresses` keys are created or read for Stroke Play.

---

## §11. Derived Values — Must Not Be Stored

| Value | Computed by |
|---|---|
| Per-hole mode-adjusted score | `scoreForMode()` in `handicap.js` |
| Gross total (`gt`) | `calcStrokePlay()` in `games.js` |
| Net total (`nt`) | `calcStrokePlay()` in `games.js` |
| Strokes-vs-par (`nd`) | `calcStrokePlay()` in `games.js` |
| Payout amounts (`gb` → `bank`) | `computePayouts()` in `payouts.js` |
| `effMin` / `spMin` (NOL baseline) | `subsetMin()` inside `computePayouts()` (after G-2 fix) |
| `displayMin` (display NOL baseline) | Inline computation inside `StrokePlayTable` |

None of the above may be written to `activeRound` or history records.

---

## §12. Architecture Boundary

| Layer | Files | Role |
|---|---|---|
| Engine | `handicap.js`, `games.js`, `payouts.js` | All stroke totals, ranking, and payout computation. Source of truth. |
| Display logic | `scorecardUtils.js` | `scoringLabel()` for badge text only. |
| UI | `StrokePlayTable.jsx`, `ScoreGrid.jsx` | Renders data; `scoreForMode` direct call permitted. |

### §12.1 Layer rules

- All stroke totals and player rankings originate from `calcStrokePlay()`.
- `computePayouts()` calls `calcStrokePlay` and handles winner/tie logic.
- `StrokePlayTable.jsx` may call `scoreForMode` directly for per-hole
  display values only. This is the only permitted direct engine call.
- Payout math must not appear in any UI component.
- `StrokePlayTable` may not independently determine the winner or produce
  a ranking for payout purposes. The chip footer is display-only.

### §12.2 Display-layer constraints

**Permitted in `StrokePlayTable.jsx`:**
- `scoreForMode` calls for per-hole display
- Local `displayMin` computation (subset-min logic only)
- Sorting subset players by cumulative `nd` for footer chip display
- Rendering holes beyond `lastCompletedHole` as unplayed (`·`)

**Prohibited in `StrokePlayTable.jsx`:**
- Any logic that determines the winner or loser for payout purposes
- Any reimplementation of `calcStrokePlay` logic
- Any read or write of `bank` or `gb`

---

## §13. Invariants

1. **Zero-sum:** Payout net values across all Stroke Play subset players sum to zero. (Proof in §5.2.)
2. **Pure functions:** `calcStrokePlay` and the Stroke Play payout block are pure and deterministic.
3. **Subset retroactive:** Subset changes apply retroactively to all holes in the active range (Round Lifecycle Contract §3.6).
4. **`spMin` ≤ every participant's `courseHcp`:** By construction of `subsetMin()` (after G-2 fix).
5. **`bet === 0` suppresses payout:** When `bet === 0`, `gb` is all zeros and no breakdown entry appears.
6. **Non-participants at 0:** Players not in `spIdxs` are never charged or credited.
7. **`computePayouts()` is called from `App.jsx` only.**
8. **Single instance only:** `'Stroke Play'` appears at most once in `activeGames[]`.
9. **`displayMin` and `spMin` must agree:** Any change to NOL baseline logic must be applied simultaneously in `calcStrokePlay` (or the payout block after G-2 fix) and `StrokePlayTable`. The two must always produce the same `effMin` value for the same inputs.
10. **`rows` is the settlement authority:** Payout logic uses `rows` (output of `calcStrokePlay`) for all winner/loser classification. `spPlayers` (original order) must not be used as the settlement list.
11. **Ranking authority:** `rows` is the sole authoritative ranking. The UI chip footer sort is display-only.
12. **`gameOpts` key uses bracket notation:** `gameOpts['Stroke Play']` — never `gameOpts.StrokePlay`.
13. **Completeness check scoped to active range:** Results may not be computed if any subset player has an empty score on any hole from 0 through `lastCompletedHole`. Holes beyond that range are not checked.
14. **Unplayed holes excluded, not zeroed:** Empty string scores are excluded from totals. Any code using `parseInt(...) || 0` for score accumulation is non-conforming.
15. **`lastHole` normalization:** Invalid `lastCompletedHole` values are treated as `17` per Round Lifecycle Contract §12.13.
16. **Subset size guard:** If the resolved subset contains fewer than 2 players, the payout block is skipped silently. No error is thrown.
17. **No duplicate subset indices:** `strokePlayPlayers` must contain unique player indices. Duplicates must be removed by the caller before passing to the engine.
18. **Invalid mode defaults to `'gross'`:** Any unrecognized value of `grossNetNOL` is treated as `'gross'` by both the engine and the display layer.
19. **Segments mode tie behavior is split-pot:** When two or more players share the lowest `nd` in a segment, the segment pot (`losers.length × segBet`) is divided equally among the tied winners (`split = pot / winners.length`). All tied = push (no payout for that segment). This matches `'total'` mode tie behavior and standard stroke-play etiquette. (Amended 13-C.3 Phase 2A — pre-13-C.3 the segments path used a sole-winner guard, which was inconsistent with `total` mode and the §4.3 / §5.0 tie detection rule. See §14 G-4 closure.)

---

## §14. Known Gaps and Open Items

| # | Severity | Description | Blocking? |
|---|---|---|---|
| ~~G-1~~ | ~~Medium~~ | ~~Default scoring mode in `NewRoundPage` falls back to `'net'` (`opts.grossNetNOL\|\|'net'`), but specified default is `'gross'`.~~ | ✅ **CLOSED** — `StrokePlayTable` default corrected to `'gross'`; `allOpts` in `NewRoundPage` now writes `grossNetNOL` explicitly with correct per-game defaults; `App.jsx` `getActiveRound` migrates in-progress rounds. Fixed in session 11-I.3. |
| G-2 | Medium | `calcStrokePlay` derives `effMin` internally instead of receiving it from `subsetMin()` in the payout block. Architectural inconsistency only — results are correct. | No |
| G-3 | ✅ CLOSED | ~~Missing scores treated as `0`.~~ Resolved: unplayed holes excluded from totals (§3.5, §6.3, invariant 14). Engine must be updated to conform. | — |
| ~~G-4~~ | ✅ **CLOSED** | ~~Payout uses `payWinner(rows[0].name...)` — incorrect for ties.~~ Resolved in two passes: `'total'` mode fix (split-pot) shipped in a prior session; `'segments'` mode fix (replacing the `winners.length === 1` guard with split-pot logic in `payWinnerStroke`) shipped in 13-C.3 Phase 2A. Both branches now conform to the §4.3 / §5.0 tie detection rule. Reference code in §14 G-4 detail block below kept for historical traceability. | — |
| G-5 | High | `calcStrokePlay` does not yet accept a `lastHole` parameter. Engine must be updated to skip holes beyond `lastHole`. | Yes — required for early-end |
| G-6 | High | `buildPayoutArgs` does not yet pass `lastCompletedHole` or `earlyEndOpts`. Both fields must be added. | Yes — required for early-end |

### G-4 Historical reference — non-conforming code (now resolved)

_Kept for traceability. Both code sites have been corrected (see G-4 row above). The block below describes the original non-conforming pattern in `'total'` mode; the segments-mode variant of the same bug is described in §5.8 as the original `winners.length === 1` guard._

```js
// CURRENT (non-conforming):
if (bet > 0 && rows[0]) payWinner(rows[0].name, spPlayers, bet, gb);

// CORRECT SPECIFIED BEHAVIOR:
if (bet > 0 && rows.length >= 2) {
  const lowNd   = rows[0].nd;
  const winners = rows.filter(r => r.nd === lowNd);
  const losers  = rows.filter(r => r.nd !== lowNd);
  if (losers.length > 0) {
    const pot   = losers.length * bet;
    const split = pot / winners.length;
    winners.forEach(w => { gb[w.name] += split; });
    losers.forEach(l  => { gb[l.name] -= bet;   });
  }
  // All tied → losers.length = 0 → pot = $0 → no movement ✓
}
```

Note the guard is now `rows.length >= 2` (subset size guard applied
before reaching this block per §5.7).

---

## §15. Examples

### §15.1 Gross mode — 4 players, clear winner

```
Setup: Alice, Bob, Carol, Dave (all participating)
  bet = $10, grossNetNOL = 'gross', full 18 holes

Gross totals: Alice: 78  Bob: 82  Carol: 80  Dave: 85
W = {Alice}   L = {Bob, Carol, Dave}

gb: Alice +$30, Bob −$10, Carol −$10, Dave −$10 | Sum = $0 ✓
```

### §15.2 Net mode — 4 players, 2-way tie

```
Setup: Alice, Bob, Carol, Dave   bet = $10, grossNetNOL = 'net', full 18 holes

Net totals: Alice: 74  Bob: 74  Carol: 77  Dave: 79
W = {Alice, Bob}  (nd === rows[0].nd)   L = {Carol, Dave}

pot = 2 × $10 = $20   split = $10 each
gb: Alice +$10, Bob +$10, Carol −$10, Dave −$10 | Sum = $0 ✓
```

### §15.3 Net mode — all 4 players tie

```
Net totals: all 72.   W = all 4.   L = {}.   pot = $0.
gb: all $0 | Sum = $0 ✓
```

### §15.4 Net-off-low — 3-player subset from 4-player round

```
Alice (cHcp 8), Bob (cHcp 12), Carol (cHcp 16), Dave (cHcp 4)
strokePlayPlayers = [0,1,2]   bet = $15   grossNetNOL = 'netofflow'

spMin = min(8,12,16) = 8  ← NOT Dave's 4

Net totals (illustrative): Alice: 74  Bob: 72  Carol: 73
W = {Bob}   L = {Alice, Carol}

gb: Bob +$30, Alice −$15, Carol −$15 | Sum = $0 ✓
Dave appears in bank at $0.
```

### §15.5 Early-end — gross mode, round ends at hole 14

```
Alice, Bob, Carol   bet = $10, grossNetNOL = 'gross'
lastCompletedHole = 13 (hole 14)   earlyEndOpts = { 'Stroke Play': 'payout' }

Gross totals (holes 0–13): Alice: 60  Bob: 58  Carol: 63
W = {Bob}   L = {Alice, Carol}

gb: Bob +$20, Alice −$10, Carol −$10 | Sum = $0 ✓
Holes 14–17 excluded entirely.
```

### §15.6 Early-end — `no_payout`

```
Same setup as §15.5 but earlyEndOpts = { 'Stroke Play': 'no_payout' }
Payout block does not fire.   gb: all $0.
```

### §15.7 Early-end — 2-way tie after 12 holes

```
Alice, Bob, Carol   bet = $10, grossNetNOL = 'net'
lastCompletedHole = 11 (hole 12)   earlyEndOpts = { 'Stroke Play': 'payout' }

Net totals (holes 0–11): Alice: 48  Bob: 48  Carol: 52
W = {Alice, Bob}   L = {Carol}

pot = 1 × $10 = $10   split = $5 each
gb: Alice +$5, Bob +$5, Carol −$10 | Sum = $0 ✓
Tie handling identical to full-round tie.
```

---

## §16. Final Rule

If implementation behavior conflicts with this contract, call out the
conflict. The implementation must be corrected. This document defines the truth.

---

## Template Validation Checklist

- [x] Every placeholder filled or N/A'd
- [x] §2.2 documents subset field names, engine parameter, dedup rule
- [x] §3.4 specifies `subsetMin()` requirement; G-2 gap noted
- [x] §3.5 score normalization, completeness, subset-as-workaround clarified
- [x] §3.6 early-end behavior fully specified including tie confirmation
- [x] §4.2 documents `bet` meaning
- [x] §4.3 tie detection rule explicit: W = all rows where nd === rows[0].nd
- [x] §4.4 explicitly N/A (no press support)
- [x] §5.2 zero-sum proof provided
- [x] §5.3 `rows` authority rule added
- [x] §5.7 subset size < 2 guard added
- [x] §6.1 engine signature updated; array length consistency note added
- [x] §6.4 specifies callers and layers
- [x] §8.2 `buildPayoutArgs` fields include `lastCompletedHole` and `earlyEndOpts`
- [x] §8.3 breakdown detail string downgraded to illustrative
- [x] §9 validation table updated with subset size and dedup rules
- [x] §13 invariants 9 (NOL sync), 10 (rows authority), 16 (size guard), 17 (dedup), 18 (mode default) added
- [x] §14 G-4 fix code updated with `rows.length >= 2` guard
- [x] §15 examples: §15.7 added for early-end tie
- [x] Cross-references include Round Lifecycle Contract
- [ ] Contract must be added to Document Index in `APP_STATE_SUMMARY.md`

---

## X Score Behavior

_Added session 13-B. See `ScoreKeypad_Contract.md` §4.8._

- X is **not a valid score in Stroke Play**. A player cannot pick up their ball in stroke play.
- The X button is not blocked in the UI (other games may be active simultaneously), but the Stroke Play engine treats X holes as unscored rather than substituting xGross.
- The Stroke Play "all scores required" validation check treats X holes as incomplete.
