# Sixes Game — Contract

_Version 1.11 — April 2026_
_Supersedes Sixes Contract v1.10._
_Changes in v1.11 (13-E): Setup UI references updated to reflect the `GameConfig.jsx` 7-file split. The Sixes config panel now lives in `GameConfigSixes.jsx` (panel file). `validateGameRange`'s canonical home is `GameConfigShared.jsx`; it is re-exported from `GameConfig.jsx` so existing import paths continue to work. Pure reorganization — no behavior change. The §14 v1.7 historical changelog entry referencing `GameConfig.jsx` describes 11-E behavior at that time and is left unchanged for traceability. See `BUILD_PLAN.md` Architectural Decision #26._
_Changes in v1.10 (13-C.3 Phase 2A): §3.6 — clarification added that
`sixesSegForHole` is not range-aware and only valid for full-round
boundaries. §3.7 (new) — partial-range Sixes specification: dynamic segment
derivation from effective range, segLen formula, range validator min-6-holes
constraint. Documents implementation in `payouts.js` Sixes block (range
resolved via `gameRange('Sixes')`, scores pre-trimmed via `trimScoresToRange`,
engine remains range-unaware)._
_Changes in v1.9: §3.4 — renamed from "Tiebreak Options" to "Scoring Rule"; `gameOpts.Sixes.tiebreak` renamed to `gameOpts.Sixes.scoring`; Naming note placeholder removed. §3.5 — `calcSixesSegment` API `tiebreak` parameter renamed to `scoring`._
_Changes in v1.8: §3.4 — new `tiebreak` value `'cumulative'` added (hole-scoring rule: sum of both teammates' net scores per team). `'half'` value retained for back-compat with rounds saved pre-v1.8 but not offered in UI as of session 11-I.2. §3.5 API signature updated to include `'cumulative'`. Engine branch added in `games.js` `calcSixesSegment` and `runSixesSegment`._
_Changes in v1.7: §9 validation rules updated — duplicate teammate pair constraint added and incorrect permissive statement removed. §12 Teams invariants updated to match. Both reflect UI enforcement implemented in session 11-E (post-E): GameConfig.jsx Sixes picker prevents any two players from being teammates in more than one segment._
_Status: AUTHORITATIVE._

---

## 1. Overview

Sixes is a 4-player team format played over three 6-hole segments. In each segment, one 2-player team ("Team A") competes against the other two players ("Team B") using best-ball scoring. The teams rotate: user-selected for the first two segments, auto-computed for the third. The team that wins the most holes in a segment wins a bet from each member of the opposing team.

**Hard requirement:** Sixes always requires exactly 4 players. The game cannot be configured or scored with any other player count. `NewRoundPage` enforces this with a validation guard.

**5-player round note (future):** In a 5-player round, Sixes would require selecting a 4-player subset (`sixesPlayers`) for the game. This subset selection introduces a NOL + subset concern: when scoring mode is `'netofflow'`, `minCourseHcp` passed to `runSixesSegment` must be computed from the 4 participating players only, not from all 5. **`sixesPlayers: number[]` is now declared in the App Data Model Contract §5.8 and wired as a passthrough in `buildPayoutArgs`.** The `payouts.js` Sixes block already applies `subsetMin()` per segment when `sixesPlayers` is non-empty. The NewRoundPage picker and any engine guard for non-4-player counts remain unimplemented. See §14 for the full forward specification.

---

## 2. Team Rotation

### 2.1 Segments

| Segment | Label     | Holes (0-based) |
|---------|-----------|-----------------|
| 0       | Front 6   | 0 – 5           |
| 1       | Middle 6  | 6 – 11          |
| 2       | Last 6    | 12 – 17         |

### 2.2 Team Selection

- **Segments 0 and 1:** Teams are chosen by the user during round setup. `sixesTeams[0]` and `sixesTeams[1]` each contain `{ a: playerIndex, b: playerIndex }` representing Team A for that segment. The remaining two players automatically form Team B.
- **Segment 2:** The team pairing is auto-computed by `getSixesTeam(2, sixesTeams, players)` in `games.js`. The rule: find the pair of player indices that has not appeared as a team in segment 0 or segment 1. With 4 players there are exactly 3 distinct 2-player combinations (`C(4,2) = 6` ordered, 3 unordered), so a unique unused pairing always exists.

### 2.3 `getSixesTeam` API (engine)

```js
// games.js
getSixesTeam(segIdx: number, sixesTeams: [{a,b},{a,b},...], players: Player[])
  → { a: number, b: number } | null
```

- For `segIdx < 2`: returns `sixesTeams[segIdx]` directly.
- For `segIdx === 2`: enumerates all `C(4,2)` unordered pairs in **lexicographic order** (`a` outer loop, `b` inner loop, `a < b`): `(0-1, 0-2, 0-3, 1-2, 1-3, 2-3)`. Removes the two used pairs, returns the **first** remaining pair in that order. This ordering is mandatory — all implementations must produce the same result.
- Returns `null` if the auto-pairing cannot be determined (should not occur in a valid 4-player round). **When `null` is returned, the segment is considered invalid: it must produce no payout and no press evaluation.** This condition indicates corrupt upstream state. The engine remains pure — it does not throw; callers must handle `null` by skipping the segment.

### 2.4 Team B is always implicit

There is no `sixesTeams[n].c` or `.d` field. The engine derives Team B by filtering all player indices to exclude Team A's two members. `calcSixesSegment` does this inline; table components do it via the same pattern.

---

## 3. Hole Scoring

### 3.1 Best-Ball Rule

Each hole is won by the team whose **best** (lowest) individual score beats the other team's best score. "Best" is always the minimum adjusted score for the active scoring mode — not the sum.

```
teamScore = min(scoreForMode(playerA), scoreForMode(playerB))
```

### 3.2 Scoring Modes

All three app-wide scoring modes are supported:

| Mode       | Adjustment applied |
|------------|--------------------|
| `gross`    | None — raw scores  |
| `net`      | Full handicap allocation per hole |
| `netofflow`| Strokes relative to lowest course handicap in group |

`scoreForMode(gross, courseHcp, hcpRank, minCourseHcp, mode)` from `handicap.js` is the sole authority on adjusted scores. Table components are permitted to call `scoreForMode` directly for display purposes (this is a listed exception in `ARCHITECTURE_FOUNDATIONS.md §2`).

### 3.3 Hole Winner

```
if teamAScore < teamBScore  → Team A wins the hole (+1 for Team A)
if teamBScore < teamAScore  → Team B wins the hole (+1 for Team B)
if equal                    → Tie (see §3.4 Tiebreak)
```

### 3.4 Scoring Rule

Applies on every hole when deriving the team's score from its two players' net scores.

| `scoring` value | UI label | Behavior |
|------------------|----------|----------|
| `'none'`         | Best Ball | Each team's hole score = lower of its two players' net scores. Tied best-ball → hole halved, no point awarded. **Default.** |
| `'second'`       | 2nd Ball Breaks Tie | Best-ball first. If best-ball tied, compare each team's *second* (higher) net score; lower second ball wins. If second balls also tied, hole halved. Requires 2 players per team. |
| `'cumulative'`   | Cumulative Score | Each team's hole score = sum of both players' net scores. Lower sum wins the hole. Tied sums → hole halved, no point awarded. Requires 2 players per team. |
| `'half'`         | _(legacy — not offered in UI)_ | **LEGACY.** Retained for back-compat with rounds saved before v1.8. On tied best-ball, each team receives 0.5 points (fractional totals possible). Migrates to `'none'` via shim in `migrateRecord`. |

`scoring` is stored in `gameOpts.Sixes.scoring`. Default is `'none'`.

### 3.5 `calcSixesSegment` API (engine)

```js
// games.js
calcSixesSegment(
  holes: number[],           // 6 hole indices for this segment
  scores: string[][],        // 18 × N raw scores
  players: Player[],
  hcps: number[],            // stroke index per hole
  team: { a: number, b: number },
  mode: 'gross'|'net'|'netofflow',
  scoring: 'none'|'second'|'cumulative'|'half',
  courseHcps: number[],      // pre-computed course handicaps per player
  minCourseHcp: number
) → { abw, cdw, a, b, c, d, winTeam: 'ab'|'cd'|null } | null
```

- Returns `null` if Team B cannot be determined (< 4 players).
- A hole is considered unplayed unless **all** players have valid integer scores on that hole. Unplayed holes terminate segment evaluation — the function stops at the first unplayed hole and does not skip ahead.
- **Incomplete segment rule:** If segment evaluation stops before all 6 holes are scored, the segment is considered incomplete. `winTeam` must be `null` for incomplete segments regardless of the interim hole-win counts. `abw`/`cdw` reflect only the holes actually played and are for display purposes only. The payout layer must not pay an incomplete segment.
- `winTeam` is `null` when the segment is complete but tied (`abw === cdw`).
- `abw` / `cdw` may be fractional when `scoring === 'half'`.

### 3.6 `sixesSegForHole` (engine helper)

```js
// games.js
sixesSegForHole(h: number) → 0 | 1 | 2
```

Maps hole index (0-based, 0–17) to segment index. Used by `SixesTable.jsx` and by Specials payout to determine which team a player belongs to on a given hole.

```
h < 6   → segment 0
h < 12  → segment 1
h ≥ 12  → segment 2
```

This helper assumes the canonical full-round 6/6/6 segmentation. For partial-range
Sixes (see §3.7), segment boundaries are derived dynamically by the payout block; the
helper itself is **not** range-aware and is only safe to call when full-round
boundaries apply.

### 3.7 Partial-range Sixes (13-C.3)

When a Sixes game has a custom range (`gameRanges['Sixes']` is set) or the round
itself is shorter than 18 holes, the three segments are derived dynamically from
the effective range:

```
totalHoles = endHole - startHole + 1
segLen     = floor(totalHoles / 3)        // must be ≥ 2 (validation rule)
seg 0:     startHole              to startHole + segLen - 1
seg 1:     startHole + segLen     to startHole + 2*segLen - 1
seg 2:     startHole + 2*segLen   to endHole
```

Segment 2 absorbs any leftover hole when `totalHoles` is not divisible by 3 — but
the range validator (`validateGameRange`, defined in `GameConfigShared.jsx` and
re-exported from `GameConfig.jsx`) enforces divisibility-by-3 today
(D-10 deferred; see PartialGameContract §15). For the default full round `[0, 17]`
this yields segments `[0..5]`, `[6..11]`, `[12..17]` — byte-identical to the hardcoded
boundaries used by `sixesSegForHole`.

**Implementation:** `payouts.js` Sixes block resolves the per-game range via
`gameRange('Sixes')` then computes `seg0Start/seg1Start/seg2Start/seg2End`
locally, passing each segment to `runSixesSegment`. Score arrays are pre-trimmed
to the effective range via `trimScoresToRange` so out-of-range holes contribute
no points. The engine itself remains range-unaware.

**Constraint:** Segment length **must be at least 2 holes** for Sixes to remain
meaningful (one hole cannot resolve a team rotation). The range validator enforces
this via `totalHoles >= 6`. Ranges with `totalHoles < 6` are rejected at config time.

---

## 4. Segment Payout

### 4.1 Base Payout

The bet amount is stored in `gameOpts.Sixes.bet`. It represents **dollars per player, per segment**.

When a team wins a segment:
- Each winner collects `bet` dollars from each loser.
- With 4 players that is: each winner +`bet`, each loser −`bet` (2 winners, 2 losers per segment).

```
winTeam members: gb[name] += bet
losTeam members: gb[name] -= bet
```

A tied segment (no `winTeam`) results in no payout for that segment. An incomplete segment (`winTeam === null` due to missing scores — see §3.5) also produces no payout. Incomplete segment behavior must be consistent across all games; the authoritative cross-game rule will be specified in the Payout Contract.

### 4.2 Press Payout

When a press is active for a segment, the **press itself is a separate bet** at the same `bet` rate. Press payouts are independent of the base segment payout:

- A press that is won adds another `bet` per player to the press winners; losers pay another `bet`.
- Multiple presses in a segment produce multiple independent payouts.
- If a segment ties AND a press within it has a winner, the press still pays out independently.

See §5 for full press rules and §8 for the current implementation gap.

---

## 5. Press System

### 5.1 Press Scope

Presses in Sixes are **per-segment**. A press is a new sub-match that starts after a specific hole within a segment and runs to the end of that segment. Presses do not span segment boundaries.

Each of the three segments (`seg0`, `seg1`, `seg2`) has its own independent press list.

A press that would start at the final hole of its segment (no remaining holes after it) must be ignored — it would produce a zero-length match with no holes to score.

**Presses beyond `thru`:** Manual press entries with a start hole index greater than or equal to the last scored hole in the segment are ignored during engine evaluation. All press evaluation — manual and auto — is limited to holes that have been played. This ensures recalculation is deterministic regardless of speculatively stored or stale press entries.

### 5.2 Press Hierarchy

The same nesting model as Nassau/Match applies (see `Nassau_Match_Contract.md §6`):

- The base segment match can be pressed → creates Press 1.
- Press 1 can itself be pressed → creates Press 2 (a "press of a press").
- Each level can be pressed at most once (no duplicate presses at the same start hole).
- The hierarchy is encoded as a sorted flat array of hole indices: `[h1, h2, ...]` where `h1 < h2`.
  - First entry = Press 1 start hole.
  - Second entry = Press 2 start hole (child of Press 1).
  - And so on.
- Each hierarchy level may contain at most one press. There are no sibling presses — each press has exactly one parent (the match level above it).
- **Cascade delete rule:** Removing a press at depth N also removes all entries at depth N+1 and beyond (all entries from that index onward in the array). The UI enforces this; the engine reads only valid arrays.
- A press can only start at a hole **within** its segment. A press start hole outside the segment's 6-hole range is invalid and must be silently ignored by the engine.

### 5.3 Auto-Press

Auto-press rules for Sixes are configured in `gameOpts.Sixes`:

| Field           | Values                        | Meaning |
|-----------------|-------------------------------|---------|
| `autoPress`     | `'none'` \| `'auto'`          | Off or on |
| `autoPressN`    | `'1'` \| `'2'` \| `'3'`      | Hole lead threshold to trigger |

Auto-press applies **per segment**: it watches the last active (deepest) match level in that segment. When the leading team's hole advantage meets the threshold, a new press is created at the *next* hole within the segment.

- **Threshold check:** `Math.abs(lead) >= autoN` where `lead = abw - cdw`. Hole wins are always whole numbers — a tied hole under any tiebreak mode leaves the lead unchanged. Auto-press triggers when the leading team's hole advantage meets or exceeds the threshold.
- Auto-press can only fire while there are remaining holes in the current segment.
- Once a match level fires an auto-press, it is marked `pressed` and cannot trigger another auto-press at that level. The newly created child press can itself auto-press independently.
- **Collision detection is per-hierarchy-depth on the deepest active level only.** If a manual press already exists at the hole where auto-press would fire (same depth, same hole index), no duplicate is created. Auto-press does not examine other levels.

### 5.4 Manual Press

Manual presses are stored in `manualPresses` (the `activeRound` blob field) under per-segment keys:

```
manualPresses['Sixes:seg0']  → number[]   // sorted hole indices within holes 0-5
manualPresses['Sixes:seg1']  → number[]   // sorted hole indices within holes 6-11
manualPresses['Sixes:seg2']  → number[]   // sorted hole indices within holes 12-17
```

The `PressModal` is the sole UI surface. It must be invoked with the correct key for the active segment.

### 5.5 Press Key Format

```
'Sixes:seg0'
'Sixes:seg1'
'Sixes:seg2'
```

These keys are used in `manualPresses` (the `activeRound` map) and must be used consistently between `PressModal`, `ScoreGrid.jsx` (the chip display), and `payouts.js` (the payout calculation).

### 5.6 Engine API for Segment with Presses

The engine function that runs a single Sixes segment with press support does not yet exist as a standalone function. The correct approach mirrors `runMatch` in `games.js`:

```js
// Proposed engine function (to be added in a follow-up session):
runSixesSegment(
  holes: number[],           // the 6 hole indices
  scores, players, hcps,
  team: { a, b },
  mode, scoring,
  courseHcps, minCourseHcp,
  autoN: number,             // 0 = off; 1/2/3 = threshold
  manualPressHoles: number[] // sorted hole indices
) → MatchResult[]            // same shape as runMatch output
```

**`manualPressHoles` contract (caller responsibility):** The caller must pass a valid array:
1. No duplicate hole indices.
2. Sorted ascending.
3. All indices present in `holes` (within the segment).
4. No index equal to the final hole of the segment (zero-length press guard).

This mirrors the contract for `runMatch` in Nassau/Match. The engine assumes a valid array and does not normalize. `PressModal` is the sole write path for press arrays and must enforce these rules at write time.

Where `MatchResult` is `{ label, abw, cdw, thru, winTeam, lead, startHole }`.

- `label` for the base segment is `'Front 6'`, `'Middle 6'`, or `'Last 6'`.
- `label` for presses is `'Press 1'`, `'Press 2'`, etc.
- `lead` is positive when Team A leads (`abw - cdw`).
- `winTeam` derives from `lead` at the end of the segment.

Until this function exists, `payouts.js` calls `calcSixesSegment` directly (no press support). See §8.

---

## 6. State Schema Fields

These fields are read/written by `roundLib.js` and passed via `buildPayoutArgs` in `App.jsx`.

### 6.1 `activeRound` blob fields (live round)

| Field             | Type                  | Description |
|-------------------|-----------------------|-------------|
| `sixesTeams`      | `[{a,b}, {a,b}]`      | Team A pair for segments 0 and 1 **only**. Exactly 2 elements. Segment 2's team is always derived at runtime via `getSixesTeam(2, ...)` and is **never stored**. |
| `manualPresses`   | `{ [key]: number[] }` | Shared map for all game presses. Sixes uses keys `'Sixes:seg0'`, `'Sixes:seg1'`, `'Sixes:seg2'`. |
| `gameOpts.Sixes`  | object                | See §6.2 |

### 6.2 `gameOpts.Sixes` shape

```js
{
  bet:        number,  // dollars per player per segment (default 0)
  grossNetNOL: string, // 'gross' | 'net' | 'netofflow' (default 'net')
  scoring:    string,  // 'none' | 'second' | 'cumulative' | 'half' (default 'none'); 'half' legacy — not offered in UI as of v1.8
  autoPress:  string,  // 'none' | 'auto' (default 'none')
  autoPressN: string,  // '1' | '2' | '3' (default '2'); only used when autoPress === 'auto'
}
```

### 6.3 History record fields (persisted)

| `activeRound` field | History record field |
|---------------------|----------------------|
| `sixesTeams`        | `sixes_teams`        |
| `manualPresses`     | `manual_presses`     |

`roundLib.fromActiveRound`, `toActiveRound`, and `toSetupState` all handle these mappings. No additional fields are needed for Sixes (no player subset — all 4 players always participate).

### 6.4 `buildPayoutArgs` (App.jsx)

`buildPayoutArgs` already passes the required Sixes fields to `computePayouts`:

```js
sixesTeams:    ar.sixesTeams,
manualPresses: ar.manualPresses || {},
```

No changes needed to `buildPayoutArgs` when the press fix is implemented.

---

## 7. Display Rules (SixesTable.jsx)

The table component is render-only. All scoring logic must come from the engine or `scorecardUtils.js`.

### 7.1 Layout

Three sections, one per segment:

```
Front 6  | holes 1–6  | [Team A names] vs [Team B names]
Middle 6 | holes 7–12 | [Team A names] vs [Team B names]
Last 6   | holes 13–18| [Team A names] vs [Team B names]
```

Each section shows:
- A hole-by-hole row for each team (best-ball winner highlighted per hole).
- A segment total row showing hole wins for each team.
- If the segment has presses: one additional row per press showing that press's hole-by-hole wins.

### 7.2 Colors

- Winning team's hole cell: green highlight (token `G` or `GA`).
- Tied hole: amber (`AMB`/`AMBBG`) or neutral — no green.
- Segment winner banner: green background.
- Losing team: red or neutral depending on bet stakes.

### 7.3 Press Rows

When presses are present for a segment, display them below the base segment row, indented or labeled `Press 1`, `Press 2`, etc. Each press row shows hole wins for its start-hole-to-end-of-segment range only.

_Press rows cannot be displayed until the engine function in §5.6 is implemented._

---

## 8. Implementation Gap — Press Wiring (Open Item)

**Current state:** `payouts.js` Sixes block calls `calcSixesSegment` directly and **does not read `manualPresses`**. The `autoPress`/`autoPressN` config in `gameOpts.Sixes` is also not applied. Base segment payouts work correctly; press payouts are entirely absent.

**What must change to fix this (follow-up session):**

1. **Add `runSixesSegment` to `games.js`** (see §5.6 for signature). This function mirrors `runMatch` but operates on best-ball team scoring rather than individual scoring. It takes `autoN` and `manualPressHoles` and returns an array of `MatchResult`-shaped objects, one per match level.

2. **Update the Sixes block in `payouts.js`** to:
   - Read `manualPresses['Sixes:seg0']`, `['Sixes:seg1']`, `['Sixes:seg2']`.
   - Derive `autoN` from `parseInt(gameOpts.Sixes?.autoPressN || '2')` when `gameOpts.Sixes?.autoPress === 'auto'`, else `0`.
   - Call `runSixesSegment` instead of `calcSixesSegment` for each of the three segments.
   - Iterate over the returned `MatchResult[]` array and pay each match level independently at `bet` dollars per player.

3. **Add press chips to `SixesTable.jsx`** after the engine function exists. The chip display should use the same `SinglePressChip` / `SegmentChipColumns` patterns as `MatchNassauTable.jsx`, with `manualPresses['Sixes:seg{n}']` as the key.

4. **Wire `PressModal` in `ScoreGrid.jsx`** to pass the correct Sixes segment key when a Sixes press chip is tapped. Currently PressModal is only invoked for Match/Nassau matches.

**Do not implement any of the above until this contract is confirmed by the project owner.**

---

## 9. Validation Rules (NewRoundPage)

- Sixes is disabled and shows an error banner if `players.length !== 4`.
- `sixesTeams[0]` and `sixesTeams[1]` must each have `a` and `b` set to distinct, valid player indices before the round can start.
- The same player index must not appear in both slots of the same team (`a !== b`).
- **No two players may be teammates in more than one segment.** This applies across all three segments — Team A and the auto-derived Team B in every segment. The UI enforces this constraint by computing `allPairs` (every committed teammate pair across all segments including auto-derived Team B) and using `excludeIdxs` in each `PlayerDropdown` to hide any player who has already been paired with the current slot's partner. This prevents invalid configurations from being entered, so no engine-level guard is required for this constraint in a 4-player round.

---

## 10. Examples

### 10.1 Team Rotation with Players A, B, C, D (indices 0, 1, 2, 3)

```
sixesTeams[0] = { a:0, b:1 }   → Front 6:   A+B vs C+D
sixesTeams[1] = { a:0, b:2 }   → Middle 6:  A+C vs B+D
getSixesTeam(2, ...)            → Last 6:    A+D vs B+C
```

Used pairs: `{0,1}` and `{0,2}`. Lexicographic enumeration: `0-1, 0-2, 0-3, 1-2, 1-3, 2-3`. First unused = `0-3`.
So segment 2 auto-team = `{ a:0, b:3 }` → A+D vs B+C. ✓

### 10.2 Segment Payout (no presses)

Bet = $5. Front 6 result: Team A wins 4 holes, Team B wins 2.

```
winTeam = 'ab'
A: +$5, B: +$5
C: -$5, D: -$5
```

### 10.3 Segment Payout with One Press

Bet = $5. Front 6 base: A wins 3, B wins 3 (tie). Press (starts hole 3): A wins 2, B wins 1.

```
Base segment: tied → no payout
Press:        winTeam = 'ab' → A+B each +$5, C+D each -$5
```

### 10.4 Tiebreak = 'second'

Hole scores: A=4 net, B=5 net vs C=4 net, D=6 net.

```
Best AB = min(4,5) = 4
Best CD = min(4,6) = 4  → tied on best ball

scoring === 'second':
  Second AB = max(4,5) = 5
  Second CD = max(4,6) = 6
  5 < 6 → Team A wins hole
```

---

## 12. Invariants

These conditions must hold at all times. Engine functions may assume valid inputs; `NewRoundPage` and the round-start guard enforce them before any engine call.

**Players**
- Exactly 4 players are required. No Sixes function produces meaningful output for any other count.
- All player index references are valid indices into `activePlayers` (0 ≤ i < 4).

**Teams**
- `sixesTeams` contains exactly 2 elements (segments 0 and 1). Segment 2 is always derived, never stored.
- Within each team: `a !== b` (a player cannot be their own partner).
- Each team has exactly 2 members; Team B is the complement and also has exactly 2 members.
- **No two players may be teammates in more than one segment** — this constraint spans Team A and the auto-derived Team B across all three segments. The three distinct 2-player pairings from `C(4,2) = 3` unordered pairs must each appear exactly once across the three segments. The UI enforces this during setup (§9); `getSixesTeam` enforces uniqueness for segment 2 by construction.

**Scores**
- Score values are positive integers or empty string `''`. No other values are valid.
- `scores[hole][playerIndex]` — hole is 0-based (0–17), playerIndex is 0-based (0–3).

**Hole indices**
- All hole indices are 0-based.
- Press hole indices within a segment are a strict subset of that segment's 6 hole indices.
- Press arrays are sorted ascending with no duplicates (enforced by normalization in §5.6).

**Determinism**
- All Sixes engine functions are pure and deterministic: given identical inputs they always produce identical outputs. No randomness, no global state, no side effects.

**Payout system linkage**
- All Sixes monetary calculations must flow through `computePayouts()` in `payouts.js`. No component or utility may compute Sixes dollar amounts independently.

---

## 14. NOL + Subset Forward Declaration (5-Player Rounds)

_§14.1–14.2 specify the required behavior. The schema field (`sixesPlayers`) and
`subsetMin()` wiring in `payouts.js` are implemented as of Session 5. The
NewRoundPage picker and any 5-player count guard remain unimplemented._

### 14.1 The problem

Sixes is currently restricted to 4-player rounds. If 5-player rounds are
supported in future, Sixes must operate on a 4-player subset (`sixesPlayers:
number[]`). This subset selection creates a NOL + subset violation identical
to the one documented for Skins and Nassau/Match:

- The full-field `minCHcp` is computed from all 5 players.
- Only 4 players participate in each Sixes segment.
- If the excluded player is the lowest handicapper, the `minCourseHcp`
  passed to `runSixesSegment` is lower than any participant's handicap,
  producing incorrect net-off-low stroke allocations for all 4 participants.

### 14.2 Required fix (Session 5)

When `sixesPlayers` is implemented:

1. Add `sixesPlayers: number[]` to the `activeRound` schema
   (App Data Model Contract §5) and to `buildPayoutArgs`.
2. In the Sixes block of `payouts.js`, derive the per-segment minimum
   from the 4 participating player indices using the `subsetMin()` helper
   (Payout Contract §4.3):

```js
// For each segment, resolve the 4 participating indices
const { a, b } = team;  // team = getSixesTeam(si, sixesTeams, players)
const others = players.map((_, i) => i).filter(i => i !== a && i !== b);
const segIdxs = [a, b, ...others.slice(0, 2)];
const segMin  = subsetMin(cHcps, segIdxs, minCHcp, mode);

runSixesSegment(holes, scores, players, hcps, team, mode, scoring,
  cHcps, segMin,   // ← segMin not minCHcp
  autoN, mpHoles);
```

3. A forward comment in the current Sixes block in `payouts.js` marks
   the exact insertion point.

### 14.3 Invariant (once implemented)

> When `sixesPlayers` is active and scoring mode is `'netofflow'`,
> `minCourseHcp` passed to `runSixesSegment` must equal
> `Math.min(...cHcps[segIdxs])` — the minimum course handicap of the
> 4 participating players in that segment only.

This is a direct application of the universal NOL + subset invariant in
Handicap Contract §5.

---

## 13. Related Files

| File | Role |
|------|------|
| `engine/games.js` | `getSixesTeam`, `calcSixesSegment`, `sixesSegForHole`, `getSpecialsPartner` |
| `engine/payouts.js` | Sixes block — full press support implemented; `subsetMin` insertion point marked for Session 5 |
| `pages/tables/SixesTable.jsx` | Render-only display component |
| `pages/NewRoundPage.jsx` | Team picker, autoPress/scoring/bet setup |
| `services/roundLib.js` | `sixes_teams` ↔ `sixesTeams` schema conversions |
| `pages/App.jsx` | `buildPayoutArgs` passes `sixesTeams` and `manualPresses` |
| `Nassau_Match_Contract.md` | Press hierarchy reference (same model) |
| `App_Data_Model_Contract.md` | `manualPresses` mutation rules |

---

## X Score Behavior

_Added session 13-B. See `ScoreKeypad_Contract.md` §4.5–§4.6 for the full invariant._

- X player cannot contribute the best-ball for their team. The team falls back to their partner's real score.
- If both partners on a team have X, the team's effective score is `Infinity` (loses to any team with at least one real score).
- Both teams all-X on the same hole: hole is halved.
- Tiebreakers (second score, cumulative): X contributes `Infinity` and is excluded from meaningful comparisons via `isFinite` guards.
- Implementation: `calcSixesSegment` and `runSixesSegment` use `Infinity` for X players in `Math.min()` best-ball.
- **Display table (`SixesTable.holeWinFn`):** Must mirror engine X handling exactly. `allScored` check must test `v !== '' && v != null` (not `parseInt(v)` — `parseInt('X')` = `NaN` which is falsy and would incorrectly treat X holes as unplayed). `val` function must check `raw === 'X'` and return `Infinity` before calling `parseInt`. Do not use `parseInt` on raw score values without an X guard.
