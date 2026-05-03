# Nines Contract

_Version 1.6 — April 2026_
_Supersedes: Nines Contract v1.5._
_Changes in v1.6 (13-E): Setup UI references updated to reflect the `GameConfig.jsx` 7-file split. The Nines config panel now lives in `GameConfigNines.jsx` (panel file). `validateGameRange`'s canonical home is `GameConfigShared.jsx`; it is re-exported from `GameConfig.jsx` so existing import paths continue to work. §9 validation-rule table location column updated to "Nines panel" (in `GameConfigNines.jsx`) — behavior unchanged. Pure reorganization — no behavior change. See `BUILD_PLAN.md` Architectural Decision #26._
_Changes in v1.5 (13-C.3 Phase 2A):
§3.7 (new) — partial-range note: F/B derived via PartialGameContract §3.6 midpoint when `gameRanges['Nines']` is set or round is shorter than 18 holes; payout block uses `splitRangeByMidpoint` helper.
§5.4 — segments-mode (nassau) payout formula updated: `payNassauSeg` now returns a per-name delta map for column emission. Columnar breakdown emission documented (`colHeaders: ['Front', 'Back', 'Total', 'Game Total']`, `matchCols: [f, b, o, f+b+o]`). The pre-existing pairwise `(i < j)` settlement loop with strict `>` comparison is unchanged — ties between two players still produce no movement between that pair (no third party to share with)._
_Changes in v1.4: `gameOpts.Nines.scoring` renamed to `gameOpts.Nines.grossNetNOL` throughout. §4.2, §5.2, §7.2, §8.1 schema updated._
_Changes in v1.3: §1.3 — `betMode` field replaces `ninesMode`; values `'nassau'` and `'single'` retired from UI; `'segments'` replaces `'nassau'`. Default remains `'perpoint'`. Engine fallback chain documented. §4.1 — bet type table updated. §4.2 — field table updated. §5 — section headings updated. §8.1 — schema updated._
_Status: AUTHORITATIVE_
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._

---

**Engine file(s):** `engine/games.js`, `engine/payouts.js`, `engine/handicap.js`
**Table component:** `pages/tables/NinesTable.jsx`
**Payout logic location:** `payouts.js` — Nines block (search `activeGames.includes('Nines')`)
**Cross-references:**
- `Handicap_Contract.md` §4 — `scoreForMode`, scoring modes
- `Handicap_Contract.md` §5 — NOL+subset invariant; `subsetMin()` pattern
- `Payout_Contract.md` §4.3 — `subsetMin()` universal implementation rule
- `Payout_Contract.md` §7.5 — Nines payout block spec (nassau description correction noted in §14 G-3)
- `App_Data_Model_Contract.md` §5.x — `ninesPlayers` field (TBD — field not yet in contract v2.0)
- `App_Data_Model_Contract.md` §10 — `buildPayoutArgs` synchronization rule

---

## §1. Overview and Game Identity

### §1.1 Plain-language description

Nines is a 3-player-only, per-hole points game. On each hole, exactly
9 points are distributed among the three players based on their relative
mode-adjusted scores for that hole — the lowest score earns the most
points, the highest earns the least. Points accumulate across all 18
holes and money is settled at end-of-round: either pairwise by total
point differential (`perpoint` mode) or across three independent segments
(`segments` mode). The optional Blitz rule awards all 9 points to a player
who wins a hole by 2 or more net strokes. Unlike Match Play, there is no
hole-by-hole cash settlement — everything resolves at the end of the round.

The strict 3-player-only constraint is the game's most important
invariant. The engine, payout block, and UI all enforce it at different
layers. Running Nines with any number of players other than exactly 3 is
undefined behavior.

### §1.2 Game key (activeGames entry)

The string identifier in `activeGames[]` for this game is: `'Nines'`

This must match exactly what is stored in `activeRound.activeGames`, used
in the `computePayouts()` conditional block, and displayed in the game
config UI. A mismatch causes silent non-payout.

### §1.3 Format variants

| Variant | UI label | Stored `betMode` | Description | Configured by |
|---|---|---|---|---|
| `'perpoint'` | Per Point | `'perpoint'` | Points accumulate over 18 holes; each unordered player pair settles at `bet × differential`. **Default.** | `gameOpts.Nines.betMode` |
| `'segments'` | F/B/T | `'segments'` | Front 9, Back 9, and 18-hole totals evaluated as independent segments; each pair settles per-segment bet per segment won | `gameOpts.Nines.betMode` |

Default variant: `'perpoint'` (unchanged).

> **Legacy values retired from UI:** `'nassau'` and `'single'` are no longer
> written by the setup UI. Engine fallback chain:
> `opts.betMode ?? opts.ninesMode ?? 'perpoint'`
> Migration shim (`roundLib.migrateRecord`): `'nassau'` → `'segments'`;
> `'single'` → `'perpoint'`. The segments else-branch in the engine fires for
> both `'segments'` and any unrecognised value.

---

## §2. Eligibility and Players

### §2.1 Valid player counts

| Player count | Valid? | Notes |
|---|---|---|
| 2 | No | Engine path for n=2 exists in `ninesPts` but is dead code. Block skipped in payout. UI shows error. |
| 3 | Yes | The only supported player count. |
| 4+ | Conditional | Round may have 4+ players but exactly 3 must be designated as Nines participants via `ninesPlayers`. See §2.2. |
| 5+ | Conditional | Same as 4+ — exactly 3 from the round must be selected. |

Minimum required: 3 (in the Nines subset).
Maximum allowed: 3 (in the Nines subset). No upper bound on round player count; a subset of exactly 3 is always selected.

> **Dead code note:** `ninesPts` contains branches for `n === 2` and `n >= 4`.
> These are **not supported use cases**. They exist as defensive code predating
> the strict 3-player enforcement. No caller should ever pass a `vals` array of
> length other than 3 to `ninesPts`. A future refactor may remove these branches.
> This contract does not specify their behavior.

### §2.2 Subset support

Yes — Nines always operates on a fixed subset of exactly 3 player indices.

- **State field:** `activeRound.ninesPlayers` — type: `number[]`; must contain exactly 3 player indices; `[]` means **no players selected** (not "all players")
- **History record field:** `nines_players` — mapped by `roundLib.fromActiveRound`
- **`buildPayoutArgs` key:** `ninesPlayers` — passed as top-level field
- **Engine parameter name:** `nPlayerIdx` (derived inside `computePayouts()` from `ninesPlayers` after resolution; also passed directly to `calcNines` as `playerIdxs`)
- **Selection UI:** Fixed-count chip picker in `NewRoundPage`; rendered for all round sizes. With exactly 3 round players, all 3 are shown and must be selected. With 4+ round players, user taps exactly 3 chips; a 4th tap is blocked.
- **Subset is fixed at:** Round creation (setup screen).
- **Changing subset mid-round:** Undefined behavior. The NOL baseline (`ninesMin`) is derived from the subset at payout time; changing mid-round would silently recalculate with a different baseline.

**Subset resolution in the payout block:**

```js
const nPlayerIdx = ninesPlayers?.length === 3
  ? ninesPlayers
  : (gameOpts.Nines?.ninesPlayers?.length === 3
      ? gameOpts.Nines.ninesPlayers
      : [...Array(Math.min(3, players.length)).keys()]);
```

This is a 3-step fallback chain:

1. **`ninesPlayers` param** (from `buildPayoutArgs`) — used if length is exactly 3.
2. **`gameOpts.Nines.ninesPlayers`** — legacy storage location; used if length is exactly 3.
3. **`[0, 1, 2]` default** — fires if neither step 1 nor step 2 produces exactly 3 indices.

> **⚠️ Step 3 is a known bug for 4+ player rounds.** In a round with 4 or more
> players where `ninesPlayers` was never set (e.g. a round created before the
> subset picker was added), Step 3 silently runs Nines on players 0, 1, 2 —
> excluding the 4th player with no warning or error. The correct behavior is
> to **skip the Nines block** when no valid subset has been set in a 4+ player
> round. In a 3-player round the fallback to `[0,1,2]` is always correct (there
> are only 3 players) and is harmless. See §14 G-4 for the gap tracking entry.
>
> The UI guard (§9) prevents this scenario from occurring in newly created rounds
> by requiring the user to select exactly 3 players before Nines can be active
> in a 4+ player round. The bug is only reachable via legacy data or direct state
> manipulation.

**Guard that fires the payout block:**
```js
if (nPlayers.length >= 3) { /* payout logic */ }
```
If the resolution chain yields fewer than 3 valid players, the block is skipped
entirely and no Nines payout is computed or written to `breakdown`.

### §2.3 Multi-instance support

No. There is exactly one Nines game per round. `activeGames` may contain
`'Nines'` at most once. The payout block fires once.

### §2.4 Team structure

N/A — Nines is an individual scoring game. No teams.

---

## §3. Scoring

### §3.1 Scoring modes supported

| Mode | Supported | Notes |
|---|---|---|
| `gross` | Yes | Raw scores used; no handicap adjustment. |
| `net` | Yes | Per-hole stroke allocation subtracted. Default. |
| `netofflow` | Yes | Strokes received relative to the lowest course handicap in the Nines 3-player subset. `subsetMin()` required — see §3.4. |

Default: `'net'`.

### §3.2 Score comparison unit

Per-hole net score (integer). Lower is better. The three players' hole scores
are compared on each hole independently to determine point distribution.
There is no accumulation within a hole — only the ranking of the three
mode-adjusted scores matters.

Tie condition: equal mode-adjusted scores on a hole result in shared points
per the allocation table in §3.5.

### §3.3 Team scoring rule

N/A — individual game; no team scoring.

### §3.4 Handicap application

Per-hole adjusted scores are computed by `scoreForMode(gross, courseHcp, rank, minCourseHcp, mode)` inside `calcNines`. See Handicap Contract §4.1.

**NOL+subset rule:** When `mode === 'netofflow'`, the `minCourseHcp` reference
value must be the minimum course handicap among the **3 Nines subset players
only** — not the full-field minimum. This is implemented via:

```js
const ninesMin = subsetMin(cHcps, nPlayerIdx, minCHcp, mode);
```

See Payout Contract §4.3 and Handicap Contract §5. ✅ Implemented in payout engine.
⚠️ **Not yet implemented in `NinesTable` display** — see §14 G-2.

### §3.5 Point allocation table (3 players only)

On each hole, `ninesPts(vals, blitz)` receives the three mode-adjusted scores
and returns a 3-element points array. Points always sum to 9 on a scored hole.

**Standard distribution (blitz = false, or blitz condition not met):**

| Outcome | Low scorer | Mid scorer | High scorer |
|---|---|---|---|
| All three different | **5** | **3** | **1** |
| Two-way tie for low (low = mid < high) | **4** | **4** | **1** |
| Two-way tie for high (low < mid = high) | **5** | **2** | **2** |
| All three tied | **3** | **3** | **3** |

> **Sign check:** In all tie cases, points still sum to 9. Two-way tie for
> low: 4+4+1 = 9 ✓. Two-way tie for high: 5+2+2 = 9 ✓. All tied: 3+3+3 = 9 ✓.

**Blitz rule (when `blitz = true`):**

Evaluated **before** the standard distribution. If the lowest score beats
the second-lowest score by **2 or more strokes** (net), the low scorer takes
all 9 points; the other two receive 0.

```
Condition: sorted[0].v ≤ sorted[1].v − 2
Result:    [low=9, mid=0, high=0]
```

A **1-stroke margin does not trigger blitz** — normal distribution applies.

**Blitz with a tied low:** If two players share the lowest score
(`sorted[0].v === sorted[1].v`), the blitz condition `sorted[0].v ≤ sorted[1].v - 2`
is false (0 ≤ -2 is false). Blitz cannot fire on a tied hole — normal
distribution applies.

**Complete allocation truth table with blitz:**

| Low margin vs 2nd | Tied at top? | Points (low / mid / high) |
|---|---|---|
| ≥ 2 strokes | No | 9 / 0 / 0 |
| 1 stroke | No | 5 / 3 / 1 |
| 0 strokes (tie for low) | Yes | 4 / 4 / 1 (two-way tie for low) |
| Any | Tied mid=high | 5 / 2 / 2 (two-way tie for high) |
| All tied | Yes | 3 / 3 / 3 |

### §3.6 Incomplete hole / missing score behavior

A missing score (falsy value in `scores[h][pi]`) causes `calcNines` to push
`null` into `holePoints` and **break the loop**. Points for that hole and all
subsequent holes are not awarded. `totals` reflects only the holes completed
before the first missing score.

```js
const gs = playerIdxs.map(pi => parseInt(scores[h]?.[pi]) || null);
if (gs.some(g => g === null)) { holePoints.push(null); break; }
```

This means: if any of the 3 Nines players is missing a score on hole H,
no points are awarded from hole H onward. This is a hard stop, not a
skip — later holes are not scored even if all players have entered scores.
(This matches the behavior of Skins, Match, and all other per-hole games.)

### §3.7 Segment relevance

Both payout modes use predefined hole sets (full round):

- **Front 9:** holes `[0..8]` (indices 0–8)
- **Back 9:** holes `[9..17]` (indices 9–17)
- **18-hole:** all holes `[0..17]`

`segments` mode evaluates these three sets as independent scoring windows.
`perpoint` mode uses the 18-hole total only.

**13-C.3 — Non-standard ranges.** When the game has a custom range
(`gameRanges['Nines']` is set) or the round is shorter than 18 holes,
Front/Back/18-hole segments are derived from the effective range via
PartialGameContract §3.6 (universal F/B/T midpoint rule). The split is
performed in `payouts.js` via the shared `splitRangeByMidpoint(startHole,
endHole)` helper, which returns `{ front, back, all }` hole-index arrays.
These are passed to `calcNines(...holes)` via the final `holes` argument.
The engine (`calcNines`) remains range-unaware — it just iterates whatever
holes the caller provides.

Minimum valid Nines range is 6 holes (`validateGameRange`, defined in `GameConfigShared.jsx` and re-exported from `GameConfig.jsx`).

For the default full round `[0, 17]`, this produces the hole sets above —
byte-identical to pre-13-C.3 behavior.

---

## §4. Bet Configuration

### §4.1 Bet type and semantics

| `betMode` | `bet` meaning |
|---|---|
| `perpoint` | Dollars per point of differential between any pair of players; paid bilaterally per pair |
| `segments` | Dollars per segment won between any pair; per-segment overrides `betF`/`betB`/`bet18` take precedence; falls back to `bet` |

`bet = 0` suppresses all payout computation — the game tracks points but no
money moves. The guard is `if (bet > 0)` in both mode branches.

### §4.2 Bet config fields

Source: `gameOpts.Nines`

| Field | Type | Default | Description |
|---|---|---|---|
| `bet` | number | 0 | Dollar amount per point (perpoint) or per segment win (segments); segments per-segment fallback |
| `grossNetNOL` | `'gross'`\|`'net'`\|`'netofflow'` | `'net'` | Scoring mode applied to all 3 players |
| `betMode` | `'perpoint'`\|`'segments'` | `'perpoint'` | Payout variant. Canonical field as of v1.3. Engine reads: `betMode ?? ninesMode ?? 'perpoint'` |
| `blitz` | boolean | `false` | Enable 9-point blitz rule |
| `betF` | number | 0 | Segments mode: F9 bet override; falls back to `bet` if `0` or absent |
| `betB` | number | 0 | Segments mode: B9 bet override; falls back to `bet` if `0` or absent |
| `bet18` | number | 0 | Segments mode: 18-hole bet override; falls back to `bet` if `0` or absent |

The engine accesses: `gameOpts.Nines?.bet`, `gameOpts.Nines?.grossNetNOL`,
`gameOpts.Nines?.betMode` (with `ninesMode` fallback), `gameOpts.Nines?.blitz`,
and (in segments mode) `gameOpts.Nines?.betF`, `gameOpts.Nines?.betB`, `gameOpts.Nines?.bet18`.

### §4.3 Press support

N/A — Nines does not support presses. No `PressModal` involvement.
No `manualPresses` keys are created or read for Nines.

### §4.4 Tiebreak rules

**`perpoint` mode:** A tied pair (equal 18-hole point totals) produces zero
differential → no money movement between those two players. There is no
tiebreak mechanism — ties simply result in no payout between the tied pair.

**`segments` mode:** A tied pair in a segment (equal segment totals) produces no
movement between those two players for that segment. Other pairwise comparisons
in the same segment are unaffected. All three tied → no payout for any pair
in that segment.

### §4.5 Carryover

N/A — Nines has no carryover. Points on each hole are awarded fresh;
no accumulation of "unawarded" points occurs. There is no pot mechanism.

---

## §5. Payout Structure

### §5.1 Payout structure type

Bilateral pairwise settlement. For each unordered pair of the 3 Nines
players `(i, j)` where `i < j`, money moves directly between player i
and player j based on their point comparison. No pool; no dealer. The
winner of each comparison collects from the loser only.

### §5.2 Zero-sum proof

**`perpoint` mode:**
For each pair `(i, j)`: if i wins by D points, `gb[i] += D × bet` and `gb[j] -= D × bet`. Net for this pair: `D × bet - D × bet = 0`. Summed over all 3 pairs → total net = 0. ✓

**`segments` mode:**
For each segment and each pair `(i, j)`: if i wins the segment, `gb[i] += bet` and `gb[j] -= bet`. Net for this pair in this segment: `bet - bet = 0`. Summed over 3 segments and 3 pairs → total net = 0. ✓

Both modes are zero-sum at the game level.

### §5.3 Payout formula — `perpoint` mode

```js
// Compute 18-hole totals for all 3 Nines players
const ranked = calcTots(ALL18).sort((a, b) => b.pts - a.pts);

// Pairwise bilateral settlement (i < j → each pair evaluated exactly once)
for (let i = 0; i < ranked.length; i++)
  for (let j = i + 1; j < ranked.length; j++) {
    const diff = ranked[i].pts - ranked[j].pts;
    if (diff > 0 && bet > 0) {
      gb[ranked[i].name] += diff * bet;
      gb[ranked[j].name] -= diff * bet;
    }
  }
```

`diff === 0` → no movement between that pair.
`diff < 0` cannot occur because `ranked` is sorted descending and `i < j`.

### §5.4 Payout formula — `segments` mode

Per-segment bet amounts: `ninesBetF = betF ?? bet`, `ninesBetB = betB ?? bet`, `ninesBet18 = bet18 ?? bet`. Each falls back to the base `bet` when the override is `0` or absent.

```js
// 13-C.3 Phase 2A: returns a per-name delta map for column emission.
// Pairwise (i < j) settlement; ties between two players skip (no third party
// to share with). Accumulation into `gb` is unchanged.
const payNassauSeg = (ranked, segBet) => {
  const segDelta = {};
  ranked.forEach(r => (segDelta[r.name] = 0));
  if (segBet <= 0) return segDelta;
  for (let i = 0; i < ranked.length; i++)
    for (let j = i + 1; j < ranked.length; j++)
      if (ranked[i].pts > ranked[j].pts) {
        gb[ranked[i].name] += segBet; segDelta[ranked[i].name] += segBet;
        gb[ranked[j].name] -= segBet; segDelta[ranked[j].name] -= segBet;
      }
  return segDelta;
};

const f9 = calcTots(FRONT).sort((a, b) => b.pts - a.pts);
const b9 = calcTots(BACK).sort((a, b) => b.pts - a.pts);
const ov = calcTots(ALL18).sort((a, b) => b.pts - a.pts);
const fDelta = payNassauSeg(f9, ninesBetF);
const bDelta = payNassauSeg(b9, ninesBetB);
const oDelta = payNassauSeg(ov, ninesBet18);
```

**Key distinction from `perpoint`:** `segments` uses strict `>` comparison —
equal point totals in a segment produce **no movement** between that pair.
Only strict wins generate cash flow.

**Maximum per-player per-segment exposure:** A player who wins a segment
over both opponents collects `2 × bet`. A player who loses to both opponents
pays `2 × bet`. A player who beats one and loses to the other nets 0 for
that segment (collects `bet`, pays `bet`).

**Columnar breakdown emission (13-C.3 Phase 2A):** In `nassau` (or legacy
`segments`) mode, the breakdown entry pushed by `payouts.js` includes
`colHeaders: ['Front', 'Back', 'Total', 'Game Total']` and per-row
`matchCols: [f, b, o, f + b + o]` so the Results page renders a single-line
columnar layout per player. See Payout Contract §3.2 for the canonical
shape and §7.5 for the full breakdown emission code. `'perpoint'` mode
continues to emit the flat shape (`{ name, detail, net }`).

> **Payout Contract §7.5 correction note:** §7.5 references the "§5.0 split
> formula" for nassau mode. The actual implementation is the pairwise loop
> shown above — **not** the split formula. The results are equivalent for
> all common 3-player cases (the pairwise loop correctly handles ties without
> the split formula machinery), but the contract reference is misleading.
> See §14 G-3 for the tracking entry. `Payout_Contract.md` §7.5 nassau
> description must be corrected to reference the pairwise loop.

### §5.5 Incomplete segment behavior

Points are accumulated only up to the first hole with a missing score
(see §3.6). If the Front 9 is not fully scored when Results is viewed:

- **`perpoint`:** The 18-hole total reflects only completed holes. Payout is
  computed on whatever total has been accumulated. This is intentional — partial
  results are valid.
- **`segments`:** F9, B9, and 18-hole totals are computed on whatever holes are
  complete within each set. A missing hole on hole 5 (index 4) causes the
  engine loop to break after hole 4; F9 totals reflect only holes 0–4. B9
  and 18-hole totals are computed from a separate `calcTots(BACK)` call which
  also breaks on the first missing score in its range.

There is no "segment must be complete to pay" guard — unlike Sixes, which
requires all 6 holes in a segment to be scored before declaring a winner.
Nines pays on whatever accumulated totals exist.

### §5.6 Tie at payout

See §4.4. Ties produce no movement — they are not an edge case, they are
the defined behavior.

### §5.7 `payWinner` usage

N/A — Nines does not use the `payWinner` helper. All payout is done via
the inline pairwise loops in `payRanked` and `payNassauSeg`.

---

## §6. Engine API

### §6.1 Engine functions

**`ninesPts(vals, blitz)`** — `engine/games.js`

```js
ninesPts(vals: number[], blitz: boolean = false) → number[]
```

| Param | Type | Description |
|---|---|---|
| `vals` | `number[]` | Mode-adjusted scores for the 3 Nines players, in the order they appear in `nPlayerIdx` |
| `blitz` | `boolean` | Whether the blitz rule is active |

Returns a `number[]` of length 3 — points for each player in input order.
Points sum to 9 for any valid 3-player input. Returns `[]` if `vals` is
falsy or empty (defensive guard — should not be reached in normal operation).

**Only `n === 3` is supported.** Branches for other lengths are dead code
(see §2.1).

---

**`calcNines(scores, players, playerIdxs, hcps, mode, blitz, holes, courseHcps, minCourseHcp)`** — `engine/games.js`

```js
calcNines(
  scores:        string[][],   // 18 × N scores array (full round, all players)
  players:       Player[],     // full players array (all round participants)
  playerIdxs:    number[],     // exactly 3 player indices into players[]
  hcps:          number[],     // stroke index per hole (1–18), length 18
  mode:          string,       // 'gross' | 'net' | 'netofflow'
  blitz:         boolean,      // true = enable 9-point blitz rule
  holes:         number[],     // hole indices to evaluate (e.g. ALL18, FRONT, BACK)
  courseHcps:    number[],     // course handicap per player index (full array)
  minCourseHcp:  number        // min course hcp of the 3-player subset (from subsetMin)
) → { totals: number[], holePoints: (number[] | null)[] }
```

Return shape:

| Field | Type | Description |
|---|---|---|
| `totals` | `number[]` | Accumulated point totals, one per `playerIdxs` entry (same order as `playerIdxs`) |
| `holePoints` | `(number[] \| null)[]` | Per-hole point arrays; `null` at the first hole with a missing score (loop breaks after this) |

`totals[i]` corresponds to `players[playerIdxs[i]]` — not to `players[i]`.
Callers must apply this mapping when building display rows.

### §6.2 Caller responsibilities

- `playerIdxs` must contain exactly 3 valid indices into `players[]`.
- `minCourseHcp` must be `subsetMin(cHcps, playerIdxs, globalMin, mode)` —
  never the full-field minimum when mode is `'netofflow'`. (Handicap Contract §5.)
- `holes` must be a subset of `[0..17]`; typically `ALL18`, `FRONT`, or `BACK`.
- `scores` is the full 18×N array; `calcNines` indexes into it using `playerIdxs[i]`.
- The engine does not validate that `playerIdxs.length === 3`. Caller enforces this.

### §6.3 Return value shape

`totals` and `holePoints` are parallel to each other and to `playerIdxs`. Index 0 of each corresponds to `playerIdxs[0]`, index 1 to `playerIdxs[1]`, index 2 to `playerIdxs[2]`. When building named-player display rows, the mapping is:

```js
nPlayers.map((p, i) => ({ name: p.name, pts: totals[i] }))
// where nPlayers = nPlayerIdx.map(i => players[i]).filter(Boolean)
```

### §6.4 Calling convention

`calcNines` is called exclusively from `computePayouts()` in `payouts.js`.
It is called once per segment:
- `calcTots(ALL18)` → `calcNines(..., ALL18, ...)`
- `calcTots(FRONT)` → `calcNines(..., FRONT, ...)` — segments mode only
- `calcTots(BACK)` → `calcNines(..., BACK, ...)` — segments mode only

No UI component or `scorecardUtils.js` function calls `calcNines` directly.
`NinesTable` calls `ninesPts` directly for per-hole display — this is a
permitted direct engine call (see §12.1).

---

## §7. Display Component — `NinesTable`

### §7.1 Table component

`pages/tables/NinesTable.jsx`

### §7.2 Props received

| Prop | Type | Description |
|---|---|---|
| `players` | `Player[]` | **Full** round players array (all participants). ⚠️ See G-1 — currently used unfiltered. Should be filtered to subset. |
| `scores` | `string[][]` | 18 × N scores array |
| `pars` | `number[]` | Par per hole (18 values) |
| `hcps` | `number[]` | Stroke index per hole (18 values) |
| `opts` | `object` | `gameOpts.Nines` — contains `grossNetNOL`, `blitz` |
| `courseHcps` | `number[]` | Course handicap per player (full array) |
| `minCourseHcp` | `number` | Full-field minimum. ⚠️ See G-2 — should be subset minimum for NOL. |
| `ninesPlayers` | `number[]` | **Not yet received.** Must be added to fix G-1 and G-2. |

### §7.3 Display layout

Two halves (Front 9 / Back 9) separated by a `TableDivider`. Each half
renders a `GameTable` with one row per player showing per-hole points and
a half-total. Below the two halves, a `PlayerChips` footer shows the 18-hole
running total per player with the leader highlighted.

### §7.4 Cell rendering

Per-hole point values are color-coded:

| Value | Color |
|---|---|
| `9` (blitz) | Purple (`#7b1fa2`) + bold |
| `5` (solo low) | Green (`#27ae60`) |
| `0` | Red (`RED` token) |
| `null` (missing score) | Light grey (`#ccc`), rendered as `·` |
| `1`, `2`, `3`, `4` | Dark (`#333`), normal weight |

### §7.5 Color tokens

Uses the `N` token set from `scorecardUtils.js` (or equivalent). Header
background, row alternation, and total-column colors follow the `N.*`
token pattern consistent with other game tables.

### §7.6 Totals display

Per-half subtotals are computed inline by summing `holePoints` arrays:
```js
const halves = players.map((_, pi) => data.reduce((s, pts) => s + (pts ? pts[pi] : 0), 0));
```
18-hole totals are passed to `PlayerChips` as `values={totals}`.

> ⚠️ **Gap:** Both of these computations iterate over the full `players` array
> (indices 0..N-1) and use `pts[pi]` where `pi` is a position in the full
> array. When `ninesPlayers` is a subset `[0, 1, 2]` of a 4-player round, the
> display is accidentally correct. But in a 4-player round where `ninesPlayers`
> is `[0, 1, 3]` (skipping player 2), the display would show incorrect values.
> See §14 G-1.

### §7.7 `scorecardUtils` helpers

`scoringLabel(mode)` — used for the badge text (e.g. "Net", "NOL", "Gross").
No other `scorecardUtils` helpers are used.

---

## §8. Config Schema and `buildPayoutArgs`

### §8.1 `gameOpts.Nines` schema

```js
gameOpts.Nines = {
  bet:         number,  // default 0; segments per-segment fallback
  grossNetNOL: string,  // 'gross' | 'net' | 'netofflow'; default 'net'
  betMode:     string,  // 'perpoint' | 'segments'; default 'perpoint'. Canonical field as of v1.3.
                        // Engine reads: betMode ?? ninesMode ?? 'perpoint'
  blitz:       boolean, // default false
  betF:        number,  // segments F9 override; 0/absent → falls back to bet
  betB:        number,  // segments B9 override; 0/absent → falls back to bet
  bet18:       number,  // segments 18-hole override; 0/absent → falls back to bet
}
```

### §8.2 `activeRound` fields consumed by Nines

| Field | Type | Description |
|---|---|---|
| `activeGames` | `string[]` | Must contain `'Nines'` |
| `gameOpts.Nines` | `object` | Config per §8.1 |
| `ninesPlayers` | `number[]` | Exactly 3 player indices; `[]` means none selected |
| `scores` | `string[][]` | 18 × N scores |
| `courseHcps` | `number[]` | Computed at round start |
| `minCourseHcp` | `number` | Full-field minimum at round start |
| `hcps` | `number[]` | Stroke index per hole |

### §8.3 `buildPayoutArgs` fields required

The following fields must be present in the object returned by `buildPayoutArgs()` in `App.jsx` for the Nines payout block to operate correctly:

| Key | Source in `activeRound` | Notes |
|---|---|---|
| `ninesPlayers` | `ar.ninesPlayers` | Passed as top-level param; `[]` if unset |
| `gameOpts` | `ar.gameOpts` | Nines config at `gameOpts.Nines` |
| `scores` | `ar.scores` | Full 18 × N array |
| `courseHcps` | `ar.courseHcps` | Full array |
| `minCourseHcp` | `ar.minCourseHcp` | Full-field min |
| `hcps` | `ar.hcps` | Stroke index per hole |
| `players` | `ar.players` | Full player array |

Failure to include `ninesPlayers` in `buildPayoutArgs` output causes the
payout block to fall back to Step 2 (legacy) then Step 3 (`[0,1,2]`),
silently producing incorrect results in multi-player rounds.

---

## §9. Validation Rules (NewRoundPage)

| Rule | Location | Behavior |
|---|---|---|
| `players.length < 3` | Nines panel (`GameConfigNines.jsx`) | Red error banner: "Nines requires at least 3 players." The Nines game remains toggle-able but the error is shown while active. |
| `players.length === 3` | Nines panel (`GameConfigNines.jsx`) | No subset picker shown — all 3 players are implicitly the Nines subset. `ninesPlayers` should be set to `[0, 1, 2]` at round start. |
| `players.length > 3` | Nines panel (`GameConfigNines.jsx`) | Chip picker shown; user must tap exactly 3 players. 4th tap blocked (`at3` guard). |
| `(ninesPlayers.length < 3)` while Nines active | Inline warning | "Select exactly 3 players" shown in red below chip picker. |
| Start round while Nines active with `ninesPlayers.length < 3` and `activePlayers.length > 3` | handleStart | ✅ Blocks start: alert fires, `setShowHIPrompt` never called. Guard: `activeGames.includes('Nines') && activePlayers.length > 3 && (ninesPlayers\|\|[]).length < 3`. |

The engine does not validate any of the above. All validation is the
UI layer's responsibility.

---

## §10. Press UI Contract

N/A — Nines does not support presses. No `PressModal` involvement.
No `manualPresses` keys are created or read for Nines.

---

## §11. Derived Values — Must Not Be Stored

| Value | Computed by |
|---|---|
| Per-hole point arrays | `ninesPts()` in `games.js` |
| Segment / 18-hole point totals | `calcNines()` in `games.js` |
| `ninesMin` (payout NOL baseline) | `subsetMin()` inside `computePayouts()` |
| `displayMin` (display NOL baseline) | **Not yet implemented** in `NinesTable` — see §14 G-2 |
| Payout amounts (`gb` → `bank`) | `computePayouts()` in `payouts.js` |

None of the above may be written to `activeRound` or history records.

---

## §12. Architecture Boundary

| Layer | Files | Role |
|---|---|---|
| Engine | `games.js`, `payouts.js`, `handicap.js` | All point and payout computation. Source of truth. |
| Display logic | `scorecardUtils.js` | `scoringLabel()` for badge text only. |
| UI | `NinesTable.jsx`, `ScoreGrid.jsx` | Renders data; `ninesPts` and `scoreForMode` direct calls permitted. |

### §12.1 Layer rules for this game

- All Nines point values originate from `ninesPts()` in `games.js`.
- `calcNines()` accumulates points across holes by calling `ninesPts` per hole.
- `computePayouts()` is the payout engine — calls `calcNines` per segment (1 or 3 calls depending on mode).
- `NinesTable.jsx` may call `ninesPts` and `scoreForMode` directly for per-hole display. These are the only permitted direct engine calls from the UI layer for this game.
- Payout math must not appear in any UI component.

### §12.2 Display-layer constraints

**Permitted in `scorecardUtils.js`:**
- `scoringLabel()` for mode badge text.

**Prohibited in `scorecardUtils.js`:**
- Any function that produces point totals or payout rankings independently.
- Any reimplementation of the blitz rule or point allocation table.

---

## §13. Invariants

1. **Zero-sum:** Payout net values across the 3 Nines players sum to zero for both modes. (Proof in §5.2.)
2. **Pure functions:** `ninesPts`, `calcNines`, and the Nines block in `computePayouts` are pure and deterministic. Same inputs always produce same outputs.
3. **Points sum to 9:** On any fully scored hole with exactly 3 valid players, `ninesPts` returns an array that sums to exactly 9.
4. **Missing score breaks loop:** A falsy score for any of the 3 Nines players on any hole stops the `calcNines` loop. No points are awarded for that hole or any subsequent hole.
5. **Blitz is pre-condition:** The blitz check fires before any standard distribution logic. A hole cannot simultaneously produce a blitz result and a standard distribution result.
6. **Blitz requires strict margin:** Blitz condition is `sorted[0].v ≤ sorted[1].v − 2`. A 1-stroke margin does not trigger blitz; a tied low does not trigger blitz.
7. **3-player-only engine:** `ninesPts` and `calcNines` are specified for exactly 3 players. The `n === 2` and `n >= 4` branches in `ninesPts` are dead code. No caller should pass a `vals` array of any length other than 3.
8. **`nPlayerIdx` must be length 3:** The payout block fires only when `nPlayers.length >= 3`. If resolution produces fewer than 3 valid players, the entire Nines block is skipped.
9. **Subset indices stable:** `ninesPlayers` indices must not change during an active round.
10. **`ninesMin ≤ every participant's courseHcp`:** By construction of `subsetMin()`.
11. **Pairwise, unordered, once:** Each pair `(i, j)` with `i < j` is evaluated exactly once in both `payRanked` (perpoint) and `payNassauSeg` (nassau). No pair is evaluated twice.
12. **Strict win required for nassau cash:** `payNassauSeg` uses `>` not `≥`. Equal segment totals → no money moves between that pair for that segment.
13. **`computePayouts()` is called from `App.jsx` only.**
14. **Single instance only:** `'Nines'` appears at most once in `activeGames[]`.
15. **Engine assumes subset immutability:** `calcNines` and the payout block assume `ninesPlayers` is constant for the duration of the round. The engine performs no validation of this assumption. Violation produces silent incorrect NOL baselines.
16. **Display layer must not compute point rankings independently:** `NinesTable` may call `ninesPts` for per-hole display values only. It must not produce payout rankings. All ranking authority belongs to `computePayouts`.

---

## §14. Known Gaps and Open Items

| # | Severity | Description | Blocking? |
|---|---|---|---|
| G-1 | High | `NinesTable` renders all round players, not the 3-player Nines subset. In a 4-player round where `ninesPlayers = [0,1,3]`, player 2 appears in the table; player 3's points are computed at position 3 in the full array but should be at position 2 in the subset array. Display is incorrect for any 4-player round where `ninesPlayers ≠ [0,1,2]`. | No (payout is correct) |
| G-2 | Low | `NinesTable` passes full-field `minCourseHcp` to `scoreForMode` for display. Payout uses `ninesMin = subsetMin(...)`. If the Nines subset excludes the player with the full-field lowest handicap, display and payout disagree on NOL scores. Owner has acknowledged and is working on a design solution covering all NOL+subset games. Deferred. | No |
| G-3 | Low | `Payout_Contract.md` §7.5 nassau description references "§5.0 split formula." The actual implementation is a pairwise loop (`payNassauSeg`) — not the split formula. The results are equivalent for 3-player cases but the reference is misleading. `Payout_Contract.md` §7.5 nassau section must be updated to describe the pairwise loop. | No |
| G-4 | Medium | Resolution chain Step 3 `[0,1,2]` fallback fires silently in a 4-player round where `ninesPlayers` was not set. Correct behavior: skip the Nines block. This is only reachable via legacy data (rounds created before the subset picker existed) or direct state manipulation. New rounds are protected by the UI picker guard. A migration shim in `roundLib.migrateRecord` could detect this condition. | No (legacy only) |
| ~~G-5~~ | ~~Medium~~ | ~~`handleStart` did not block start when Nines active with < 3 players selected.~~ | ✅ **CLOSED** |
| G-6 | Medium | `nassau` mode breakdown rows include `...players.map(p => ...)` over all round players, not just the 3 Nines players. Non-participants appear in `ResultsPage` with `net: gb[p.name] \|\| 0 = 0`. This is a display-only issue — non-participants are never charged or credited — but the extra rows are incorrect and confusing. Fix: filter to `nPlayers` only in the breakdown row builder. | No |
| G-7 | Low | `App_Data_Model_Contract.md` v2.0 does not yet document the `ninesPlayers` field or the `gameOpts.Nines` schema. These must be added in the next Data Model Contract update. | No |

### G-1 Detail — `NinesTable` subset filtering

**Root cause:** `NinesTable` iterates `players.map((_, pi) => ...)` using the
full `players[]` array. `ninesPts` returns a per-position array relative to
`players`, not to `nPlayerIdx`. In a 4-player round where `ninesPlayers = [0,1,3]`:
- Player 2 (not a Nines participant) appears in the table.
- Player 3's points are stored at `pts[3]` in the engine output but the table
  attempts to read `pts[3]` — this may work accidentally if the engine iterates
  the full array, but the underlying computation is wrong.

**Fix required:** Add `ninesPlayers` prop to `NinesTable`. Derive
`activeIdxs` from it (falling back to all players). Filter rendered rows
to `activeIdxs`. Pass `activeIdxs` to the `ninesPts` call so point
positions are correct relative to the subset — or map positions explicitly.

**Prop threading needed:**
- `ScorecardPage` — destructure `ninesPlayers` from `ar`; pass to `ScoreGrid`
- `ScoreGrid` — add `ninesPlayers` to props; pass to `NinesTable`
- `NinesTable` — accept `ninesPlayers`; derive subset; filter rows

### G-3 Detail — Payout Contract §7.5 correction

Replace the nassau description in `Payout_Contract.md` §7.5 from:

> "For each segment, apply §5.0 split formula over the 3 nines players. Since
> there are always exactly 3 players, a segment tie between two players leaves
> the third as sole loser; the two tied winners each collect `bet / 2`…"

With:

> "For each segment, apply pairwise bilateral settlement over the 3 Nines
> players using all unordered pairs `(i < j)`. For each pair: if i's segment
> total is strictly greater than j's, `gb[i] += bet; gb[j] -= bet`. Equal
> totals: no movement between that pair. All three tied: no movement for the
> segment."

---

## §15. Examples

### §15.1 `perpoint` mode — 3 players, complete round, clear differential

```
Setup: Alice (courseHcp=10), Bob (courseHcp=6), Carol (courseHcp=14)
  bet = $2, betMode = 'perpoint', grossNetNOL = 'net', blitz = false

Assume 18-hole point totals (after all holes complete):
  Alice: 72 pts
  Bob:   65 pts
  Carol: 53 pts

Pairwise settlement:
  Alice vs Bob:   diff = 72 − 65 = 7 → Alice +$14, Bob −$14
  Alice vs Carol: diff = 72 − 53 = 19 → Alice +$38, Carol −$38
  Bob vs Carol:   diff = 65 − 53 = 12 → Bob +$24, Carol −$24

Final:
  Alice: +$14 + $38 = +$52
  Bob:   −$14 + $24 = +$10
  Carol: −$38 − $24 = −$62

Sum: $52 + $10 − $62 = $0 ✓
```

### §15.2 `segments` mode — segment ties and payouts

```
Setup: Alice, Bob, Carol  |  bet = $5, betMode = 'segments'

Segment point totals:     F9   B9   18
  Alice:                  41   36   77
  Bob:                    41   40   81
  Carol:                  27   30   57

F9 (Alice=41, Bob=41, Carol=27):
  Alice vs Bob:   41 = 41 → no movement
  Alice vs Carol: 41 > 27 → Alice +$5, Carol −$5
  Bob vs Carol:   41 > 27 → Bob +$5, Carol −$5
  F9 result: Alice +$5, Bob +$5, Carol −$10

B9 (Bob=40, Alice=36, Carol=30):
  Bob vs Alice:   40 > 36 → Bob +$5, Alice −$5
  Bob vs Carol:   40 > 30 → Bob +$5, Carol −$5
  Alice vs Carol: 36 > 30 → Alice +$5, Carol −$5
  B9 result: Alice $0 (−$5+$5), Bob +$10, Carol −$10

18 (Bob=81, Alice=77, Carol=57):
  Bob vs Alice:   81 > 77 → Bob +$5, Alice −$5
  Bob vs Carol:   81 > 57 → Bob +$5, Carol −$5
  Alice vs Carol: 77 > 57 → Alice +$5, Carol −$5
  18 result: Alice $0, Bob +$10, Carol −$10

Grand totals:
  Alice: +$5 + $0 + $0 = +$5
  Bob:   +$5 + $10 + $10 = +$25
  Carol: −$10 − $10 − $10 = −$30

Sum: $5 + $25 − $30 = $0 ✓
```

### §15.3 Blitz rule — single hole

```
Hole: par 4, mode = 'net', blitz = true

Player scores (net):
  Alice: 3 (eagle net)
  Bob:   5
  Carol: 6

blitz check: sorted[0].v = 3 ≤ sorted[1].v − 2 = 5 − 2 = 3  →  3 ≤ 3  →  TRUE
Result: Alice gets 9 pts, Bob 0 pts, Carol 0 pts

Compare — same hole, blitz = false (or margin = 1):
  Alice: 4 (birdie net)
  Bob:   5
  Carol: 6

blitz check: sorted[0].v = 4 ≤ sorted[1].v − 2 = 5 − 2 = 3  →  4 ≤ 3  →  FALSE
Standard distribution: Alice 5, Bob 3, Carol 1
```

### §15.4 Missing score — partial round

```
Setup: perpoint mode, bet = $1
Scores: Alice, Bob, Carol have completed holes 0–12.
  Hole 13: Bob has not entered a score.

calcNines processes:
  holes 0–12: points awarded normally
  hole 13: gs = [Alice_score, null, Carol_score] → gs.some(null) = true → break

totals reflect holes 0–12 only.
Pairwise settlement runs on those partial totals.
No special guard — partial totals are treated as final.
```

---

## §16. Final Rule

If implementation behavior conflicts with this contract, call out the
conflict. The implementation must be corrected. This document defines the truth.

---

## Template Validation Checklist

- [x] Every placeholder filled or N/A'd
- [x] §2.2 documents both state field name (`ninesPlayers`) and engine parameter name (`nPlayerIdx` / `playerIdxs`)
- [x] §3.4 specifies `subsetMin()` requirement — payout implemented, display gap flagged
- [x] §4.2 documents `bet` meaning per mode
- [x] §4.3 explicitly N/A (no press support)
- [x] §5.2 zero-sum proof for both modes
- [x] §6.1 engine function signatures match actual code
- [x] §6.4 specifies callers and layers
- [x] §8.3 lists all `buildPayoutArgs` fields consumed
- [x] §9 documents all UI guards (including unconfirmed G-5)
- [x] §13 invariants include universal invariants (zero-sum, pure function, no mid-round subset changes)
- [x] §14 Known Gaps documented (G-1 through G-7)
- [x] §15 examples arithmetically verified
- [x] Cross-references accurate (Payout Contract §7.5 correction flagged in G-3)
- [ ] Added to Document Index in `APP_STATE_SUMMARY.md` — **must be done by owner**
- [ ] `App_Data_Model_Contract.md` updated with `ninesPlayers` field and `gameOpts.Nines` schema — flagged in G-7

---

## X Score Behavior

_Added session 13-B. See `ScoreKeypad_Contract.md` §4.5–§4.7 for the full invariant and point distribution._

- X player(s) come in last place on the hole.
- **1 X, 2 real scores:** X gets 1 pt (sole last). Real score players compete normally for 5/3.
- **2 X, 1 real score:** X players get 2 pts each (tied last). Real score player gets 5 pts.
- **All 3 X:** 3 pts each (three-way tie).
- Implementation: `calcNines` identifies X flags, computes `maxReal + 1` as sentinel for X players so they sort last in `ninesPts`. All X players receive the same sentinel so they tie among themselves. `NinesTable.holeData` mirrors this logic exactly.
- **Display table (`NinesTable.allData`):** The running totals chips path must use `holeData([...Array(18).keys()])` — not a separate `parseInt`-based path. Any parallel implementation that uses `parseInt(scores[h]?.[pi]) || null` will treat X holes as unplayed and drop them from running totals. `holeData` is the single source of truth for all Nines point computation in the display layer.
