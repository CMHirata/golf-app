# Nassau / Match Play Contract

_Version 3.0 — April 2026_
_Supersedes Nassau / Match Play Contract v2.9._
_Changes in v3.0 (13-F): §16.4 NEW — Bet mode carry-forward rule for MatchCard.
When switching Total→Nassau, all three bet fields (Front, Back, Total) are
pre-populated from the current `betOverall` value. When switching Nassau→Total,
`betOverall` is retained; `betFront`/`betBack` are cleared to 0. References
UI_Component_Contract.md §4.10 (canonical spec). Implementation: `MatchCard.switchBetMode`
must pass `match.betOverall` to the carry-forward logic on switch._
_Changes in v2.9 (13-C.3 Phase 2A):
§1.3 — partial-range note added: when a match has a custom range (`gameRanges[matchDef.id]` set) or the round itself is shorter than 18 holes, Front/Back/Overall are derived from the effective range via PartialGameContract §3.6 midpoint rule. `runMatchNassau` accepts an optional `range` argument; default behavior is byte-identical to pre-13-C.3.
No other changes. The columnar breakdown shape emitted by `roundUtils.computePerMatchPayouts` (`colHeaders: ['Front', 'Back', 'Total', 'Game Total']`) is documented in Payout Contract §3.2 and §7.3 — Nassau / Match contract intentionally defers to those._
_Changes in v2.8: §5.6 (new) — Match instance label: derivation from array index, renumbering on delete, display surfaces. §16.3 (new) — Dots teamMode per-instance dropdown behavior documented._
_Changes in v2.7: §2 — `matchDef.scoring` renamed to `matchDef.grossNetNOL`. §3.4 — renamed from "Tiebreak" to "Scoring rule (team format)"; `matchDef.tiebreak` renamed to `matchDef.scoring`; Naming note placeholder removed. §16 — setup UI field references updated._
_Changes in v2.6: §3.4 — new `tiebreak` value `'cumulative'` added (team format only; hole-scoring rule: sum of both teammates' net scores per team). `'half'` retained for back-compat with rounds saved pre-v2.6 but not offered in UI as of session 11-I.2. Engine branch added in `games.js` `runTeamMatch`._
_Changes in v2.5: §16 (new) — Setup UI Vocabulary: bet mode dropdown labels vs stored field behavior; press dropdown UI labels vs stored values documented._
_Changes in v2.4: §13 hole winner cell display spec (team slash-initials, collision resolution, color assignment); former §13 Invariants renumbered §14; former §14 Final Rule renumbered §15._
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._

---

## 1. Core Structure

### 1.1 Match formats

Two formats are supported:

- **Individual** — one player vs. one player (`p1` vs. `p2`)
- **Team** — two or more players per side (`teamA` vs. `teamB`)

### 1.2 Nassau vs. straight Match Play

A match is a **Nassau** if `betFront > 0` or `betBack > 0`.
A Nassau consists of three independent scored segments: Front 9,
Back 9, and Overall 18.

A match is **straight Match Play** if `betFront === 0 && betBack === 0`.
Straight Match Play has one scored segment: Overall 18.

Both formats use identical hole-scoring rules. The only difference is
the number of active segments and their associated bets.

### 1.3 Segments

| Segment | Holes (full round) | Active when |
|---|---|---|
| Front | 1–9 (indices 0–8) | Always (Nassau and Match) |
| Back | 10–18 (indices 9–17) | Always |
| Overall | 1–18 (indices 0–17) | Always |

For straight Match Play, only the Overall segment has a bet and
produces a payout. Front and Back may still be computed but have
zero value.

**13-C.3 — Non-standard ranges.** When a match has a custom range
(`gameRanges[matchDef.id]` is set) or the round itself is shorter than 18
holes, Front/Back/Overall are derived from the effective range via
PartialGameContract §3.6 (universal F/B/T midpoint rule). Overall spans
`[startHole, endHole]`; the midpoint `startHole + floor(totalHoles/2)`
splits Front from Back, with Back getting the extra hole on odd-length
ranges. For the default full round `[0, 17]` this yields the Front/Back
split in the table above — byte-identical to pre-13-C.3 behavior.

Implementation: `games.js::runMatchNassau` accepts an optional `range`
argument. When absent or `{ 0, 17 }`, F/B/Overall use the hardcoded
module-level constants. Otherwise they are derived internally.

---

## 2. Scoring Modes

Three scoring modes are available, set per match in `matchDef.grossNetNOL`.

### 2.1 Gross

Raw scores compared directly. No handicap adjustment.

### 2.2 Net

Each player's score is reduced by their stroke allocation on each hole.

Stroke allocation for player `pi` on hole `h`:
- Player's course handicap: `courseHcps[pi]`
- Hole stroke index: `hcps[h]` (1 = hardest, 18 = easiest)
- Strokes received: `hdcpStrokesFromCourseHcp(courseHcps[pi], hcps[h], minCourseHcp)`
- Net score: `grossScore - strokesReceived`

### 2.3 Net Off Low

All players receive strokes relative to the lowest course handicap in
the group. The lowest-handicap player plays scratch (0 net strokes).

`minCourseHcp` is the reference value. All stroke calculations use
`minCourseHcp` as the base. This is computed once at round start and
stored in `activeRound.minCourseHcp`.

### 2.4 Hole result

For each hole, the player (or team) with the lowest score under the
active scoring mode wins the hole. Equal scores = tied hole.

For team format: the best score among each team's players is used as
the team's score for that hole.

---

## 3. Match State

### 3.1 Tracking

Match state is tracked as a signed integer **lead**:
- Positive = player 1 (or teamA) is leading
- Negative = player 2 (or teamB) is leading
- Zero = All Square

The lead changes by ±1 for each hole won. Tied holes do not change
the lead.

### 3.2 Closure

A match closes when the leader's margin exceeds the number of holes
remaining. Example: 3UP with 2 holes to play → match is closed (3&2).

Once closed, subsequent holes do not change the final outcome.

### 3.3 Display conventions

| Lead state | Display |
|---|---|
| `lead > 0`, holes remaining | `"{n}UP"` where n = Math.abs(lead) |
| `lead < 0`, holes remaining | `"{n}UP"` from the other side's perspective |
| `lead === 0` | `"AS"` (All Square) |
| Match closed | `"{n}&{remaining}"` — e.g. `"3&2"` |
| No holes played | `"—"` |

### 3.4 Scoring rule (team format)

Configured per match in `matchDef.scoring`.

**Individual format:** Only one score per side; scoring rule not applicable. UI does not render this dropdown for individual matches. Stored value is always `'none'` for individual.

**Team format:**

| Value | UI label | Rule |
|---|---|---|
| `'none'` | Best Ball | Each team's hole score = lower of its two players' net scores. Tied best-ball → hole halved, no point awarded. **Default.** |
| `'second'` | 2nd Ball Breaks Tie | Best-ball first. If best-ball tied, compare each team's *second* (higher) net score; lower second ball wins. Requires 2 players per team. |
| `'cumulative'` | Cumulative Score | Each team's hole score = sum of both players' net scores. Lower sum wins the hole. Tied sums → hole halved, no point awarded. Requires 2 players per team. |
| `'half'` | _(legacy — not offered in UI)_ | **LEGACY.** Retained for back-compat with rounds saved before v2.6. Half-point awarded on tied best-ball. Migrates to `'none'` via shim in `migrateRecord`. |

`scoring` is stored in `matchDef.scoring`. Default is `'none'`.

---

## 4. Press Definition

A press is a new, independent match that starts at a specific hole and
runs to the end of its segment. Presses do not affect the base match
or any other press.

### 4.1 Press storage

Stored in `activeRound.manualPresses`, keyed:
```
"Match:{matchId}:{Front|Back|Overall}"
```
Value: a flat sorted array of hole indices (0-based).

```js
// Example: two presses on the Front segment
manualPresses["Match:abc:Front"] = [3, 6]
// Press 1 starts after hole index 3 (i.e. beginning of hole 5)
// Press 2 starts after hole index 6 (i.e. beginning of hole 8)
```

### 4.2 Press hierarchy

The flat array implicitly encodes a depth hierarchy:
- `arr[0]` → depth 0: press on the base match
- `arr[1]` → depth 1: press on Press 1
- `arr[n]` → depth n: press on Press n

Only one press is allowed per depth level.

### 4.3 Scope

A press runs from its start hole to the end of its segment:
- Front presses end at hole index 8 (hole 9)
- Back presses end at hole index 17 (hole 18)
- Overall presses end at hole index 17 (hole 18)

**Presses beyond `thru`:** Manual press entries with a start hole index greater than or equal to the last scored hole in the segment are ignored during engine evaluation. All press evaluation — manual and auto — is limited to holes that have been played. This ensures recalculation is deterministic regardless of speculatively stored or stale press entries.

### 4.4 Independence

- Presses do not affect the base match outcome
- Presses do not affect other presses
- Each press is scored and settled independently

---

## 5. Press Rules

### 5.1 Valid press

- Start hole must be within the segment's hole range
- No duplicate press at the same start hole for the same segment
- No press after a segment has completed

### 5.2 Manual press

User selects a hole index. The press starts at the next hole
(the selected hole is the last hole the base match/press covers).

Example: user selects hole index 4 (hole 5) → press starts at
hole index 5 (hole 6).

### 5.3 Auto press

Auto press triggers when a player/team is down by the configured
threshold in a given segment.

| Field | Controls |
|---|---|
| `matchDef.autoPressF` | Front segment auto-press threshold |
| `matchDef.autoPressB` | Back segment auto-press threshold |
| `matchDef.autoPressO` | Overall segment auto-press threshold |

Values: `'none'` (disabled) or `'1'` through `'5'` (down-by threshold).

Trigger conditions:
- Player/team is exactly `threshold` down
- The trigger has not already fired at this hole for this segment
- No existing press already starts at this hole
- The segment is not yet complete

Auto press starts on the next hole after the trigger condition is met.

Legacy fields `autoPress` / `autoPressN` on old match definitions are
supported for reading only. New records always use `autoPressF/B/O`.

### 5.4 Press hierarchy enforcement (UI)

When adding a press at depth N:
1. All entries at depth N and beyond are removed from the array
2. The new entry is inserted
3. The array is re-sorted ascending

This enforces one press per level and cascades removal of child presses
when a parent is replaced.

### 5.5 Press removal (UI)

Removing a press at depth N removes that press and all child presses
(all entries at depth N and beyond in the sorted array — i.e., all
values `>= holeIdx` being removed).

### 5.6 Match instance label

Each match instance is identified for display by a single uppercase letter
(`'A'`, `'B'`, `'C'`, …) derived from its **current position** in `matches[]`:

```js
label = String.fromCharCode(65 + currentIndex)
```

**The label is never stored on `matchDef`.** It is always derived at render
time from the match's current array index.

**Renumbering on delete:** When a match is removed, surviving matches
renumber from their new indices. If matches [A, B, C] exist and B is
deleted, the remaining two become A and B.

**Consumers of the label:**

| Surface | Derivation | Source |
|---|---|---|
| NewRoundPage setup tile title | `String.fromCharCode(65 + idx)` where `idx` = current index in `matches[]` | NewRoundPage render |
| MatchNassauTable section header | `String.fromCharCode(65 + mi)` where `mi` = map index | MatchNassauTable render |
| Results summary sub-header | `matchLabel()` updated to use index-derived label: `'Match ' + String.fromCharCode(65 + mi)` | roundUtils `computePerMatchPayouts` |
| Dots teamMode dropdown option label | `'Match ' + String.fromCharCode(65 + idx) + ' Teams'` where `idx` = index of that match in `matches[]` | NewRoundPage render |

**Stored reference in Dots teamMode:** The Dots `teamMode` field stores
`'Match:{matchId}'` (ID-based, not label-based). This means the correct
match is always resolved regardless of renumbering. When a match is
deleted and `teamMode` references its ID, `NewRoundPage` resets
`teamMode` to `'none'`. See App Data Model Contract §5.5 and §7.1.

---

## 6. Press UI Contract

### 6.1 PressModal is the sole interaction surface

All press creation and removal occurs through `PressModal`. There are
no other controls for adding or removing presses (no ✕ buttons, no
inline controls).

### 6.2 Hole grid toggle behavior

In PressModal, the hole grid shows all holes in the segment:
- Tapping an **un-pressed hole** → adds a press starting after that hole (cascade-removes any existing press at same depth or deeper)
- Tapping a **pressed hole** → removes that press and all child presses
- No hole selected → close only

### 6.3 Chip holdability

A press chip in the scorecard UI is holdable (long-press to open PressModal) if:
- It is the last chip in the chain AND the segment has remaining unscored holes (hold to add a child press), OR
- It has an existing child press (hold to manage/remove that child press)

Chips with a child press but no remaining holes after the child are not holdable.

### 6.4 Single interaction constraint

Only one press may be added or removed per user interaction. Batch operations are not allowed.

---

## 7. Derived Results (Must Not Be Stored)

The following are always computed from raw data. They must never be
stored in `activeRound` or history records as cached values:

- Hole winners
- Match lead / status at any hole
- Press outcomes
- Payout amounts

These are computed by `runMatchNassau()` in `games.js` and
`computePayouts()` in `payouts.js` on demand.

---

## 8. Payout Rules

### 8.1 Individual match

At segment completion (or end of round):
- Winner of the segment (lead > 0) collects `betAmount` from the loser
- Tied segment: apply `tiebreak` rule (see §3.4)
- Each press is settled independently at the same `betAmount`

### 8.2 Team match

Each player on the winning side collects `betAmount` from each player
on the losing side. The amount transferred per pairing is `betAmount`
(not `betAmount / teamSize`).

Example: teamA (2 players) beats teamB (2 players) with `betFront = $5`.
Each teamA player collects $5 from each teamB player → $10 total flows
per teamA player, $10 total flows per teamB player.

### 8.3 Presses settle independently

A press has the same `betAmount` as its parent segment. Press outcomes
do not affect the base match result.

---

## 9. Edge Cases

### 9.1 Tied holes

Tied holes do not change match state. Lead is unchanged.

### 9.2 Late press

A press starting on the last hole of a segment is valid. It applies
only to that one remaining hole.

### 9.3 Completed segment

No presses may be added after a segment is complete (all holes scored).

### 9.4 Match closed early

When a match closes (lead > holes remaining), subsequent hole results
within that segment do not change the final outcome. Presses that
started after the close hole still run independently to their end.

### 9.5 All Square at segment end

If a segment ends All Square:
- `tiebreak: 'none'` → no payout; bet carries (if applicable)
- `tiebreak: 'half'` → each side wins half the bet amount

### 9.6 Incomplete segment (missing scores)

A hole is considered unplayed unless both players (individual) or all players on both sides (team) have valid integer scores. The engine stops at the first unplayed hole and does not skip ahead.

- `thru` reflects only the holes actually played within a bet's scope.
- A bet with `thru === 0` has no result and must not be paid out.
- Interim `lead`, `p1w`, `p2w` values for an incomplete segment are for display only — they do not represent a final result.
- Auto-press can only fire on holes that have been played; it cannot trigger on an unplayed hole.
- Incomplete match/segment behavior must be consistent across all games; the authoritative cross-game rule will be specified in the Payout Contract.

---

## 10. Engine API

### 10.1 runMatchNassau

```js
runMatchNassau(
  scores,          // scores[hole][playerIdx]
  players,         // activePlayers array
  hcps,            // stroke index per hole
  matchDef,        // one MatchDef object
  courseHcps,      // course handicap per player
  minCourseHcp,    // for Net Off Low
  manualPressesForMatch  // { Front: [], Back: [], Overall: [] }
)
// Returns:
{
  front:   [mainBet, press1, press2, ...],
  back:    [mainBet, ...],
  overall: [mainBet, ...],
}
```

Each bet object:
```js
{
  label:     string,   // e.g. "Main", "Press 1"
  startHole: number,   // 0-based hole index
  lead:      number,   // signed; positive = p1/teamA leading
  thru:      number,   // holes played in this bet's scope
  status:    string,   // display string e.g. "2UP thru 9"
  p1w:       number,   // holes won by p1 (individual)
  p2w:       number,   // holes won by p2 (individual)
  // team format uses aw / bw instead of p1w / p2w
}
```

**`manualPressesForMatch` caller responsibility:** The engine assumes each array is already valid: sorted ascending, no duplicates, all indices within the segment's hole range. `PressModal` is the sole write path and must enforce these invariants at write time. The engine does not normalize its inputs.

### 10.2 Calling convention

`runMatchNassau` is called once per match per render/compute cycle
by `MatchNassauTable.jsx`. Results are used directly within that
component for rendering.

`scoreForMode` is called within `MatchNassauTable` for per-hole winner
comparison. This is a permitted direct engine call (see App Data Model
Contract §4 permitted list).

**Match state computation, press trigger evaluation, and payout math
must not appear in any UI component.** These originate exclusively
from `runMatchNassau()` and `computePayouts()` in the engine layer.

---

## 11. Architecture Boundary

This contract is implemented across three layers. Each layer has a
strict role. Violating these boundaries is a contract violation.

| Layer | Files | Role |
|---|---|---|
| Engine | `games.js`, `payouts.js`, `handicap.js` | Computes all scoring outcomes. Source of truth. |
| Display logic | `scorecardUtils.js` | Interprets engine output for display. No scoring math. |
| UI | `MatchNassauTable.jsx`, `ScoreGrid.jsx`, `ScorecardPage.jsx` | Renders data. Handles user input. No game logic. |

### Rules

- All match outcomes, hole winners, lead state, and press results
  originate from `runMatchNassau()` in `engine/games.js`
- `scorecardUtils.js` may format and assemble engine output for
  display, but may not reimplement or duplicate engine logic
- UI components receive computed data via props or call engine
  primitive functions only for direct display-only transformations
  (see App Data Model Contract §4 permitted list)
- Match state computation and press trigger evaluation never occur
  in the UI layer under any circumstances
- State mutations (scores, presses) occur only through the designated
  setters defined in the App Data Model Contract §8.1

---

## 12. Display Layer Constraints

Functions in `scorecardUtils.js` relevant to Nassau/Match:

**Permitted:**
- `fmtLead(lead, matchOver, holesLeft)` → display string
- `buildLeadState(holeWinFn, runHoles)` → per-hole lead map for rendering
- `isNassauMatch(matchDef)` → boolean classification
- Design token objects (`M`, `MP`) → style values

**Prohibited in scorecardUtils.js:**
- Any function that produces a scoring result independently
- Any reimplementation of hole-winner logic
- Any press trigger evaluation

If a display-layer function's output would change if the engine rules
changed, that function is reimplementing engine logic and must be
moved to the engine.

---

## 13. Hole Winner Cell Display

### 13.1 Cell states

Each hole cell in the MatchNassauTable winner row displays one of four states:

| State | Display | Style |
|---|---|---|
| Before bet start hole | `·` (U+00B7 middle dot) | `#e8e8e8`, no chip |
| Unplayed (no valid scores) | `·` (U+00B7 middle dot) | `#ddd`, no chip |
| Tied hole | `–` (U+2013 en dash) | `#bbb`, no chip |
| Side 1 wins (p1 / teamA) | Winner label (see §13.2–13.4) | Green chip: text `G`, background `#d8f0d8` |
| Side 2 wins (p2 / teamB) | Winner label (see §13.2–13.4) | Red chip: text `RED`, background `#fde8e8` |

Chip dimensions: `width: 20, height: 18, fontSize: 10, fontWeight: 700, borderRadius: 3`.

### 13.2 Individual format — winner label

In an individual-format match, the winning player is displayed as their
**two-letter initials**: first initial of first name + first initial of
last name, both uppercase, concatenated without separator.

Example: `"Chris Hirata"` → `CH`, `"Dave Amos"` → `DA`

If the player has only one name token (no last name), the first two
characters of the name are used.

This is existing behavior and must not change.

### 13.3 Team format — winner label

In a team-format match, the winning team is displayed as
**slash-separated resolved first initials** of all team members
(see §13.4 for collision resolution).

Format: `{A1}/{A2}` for a 2-player team, `{A1}/{A2}/{A3}` for a
3-player team, etc.

Examples:
- teamA = [Chris, Dave] wins → `C/D`  
- teamB = [John, Mike] wins → `J/M`

Color assignment:
- teamA winning chip: green (text `G`, background `#d8f0d8`)
- teamB winning chip: red (text `RED`, background `#fde8e8`)

### 13.4 Collision resolution

Collision resolution is applied **per-team independently**. Two
players on the same team collide if their first names begin with the
same letter.

Resolution chain (applied per player within the team):

1. **No collision** — use the first letter of the player's first name
   (uppercase, 1 char).
2. **First-initial collision** — use the first letter of the first
   name + the first letter of the last name (uppercase, 2-char token).
3. **First+last-initial collision** (both players produce the same
   2-char token) — accept the 2-char token as-is. No further
   disambiguation is attempted.

Resolved tokens are joined with `/` to form the team label.

Examples:
- `[Chris Hirata, Charlie Ortega]` → tokens `CH`, `CO` → label `CH/CO`
- `[Dave, Mike]` (single names) → tokens `D`, `M` → label `D/M`

### 13.5 Implementation scope

- This display spec applies to `MatchNassauTable.jsx` only.
- The `initials()` helper handles individual-format labels (§13.2) and
  is unchanged.
- `resolveTeamLabel(teamPlayerIdxs, players)` handles team-format
  labels (§13.3–13.4). It mirrors `resolveSegmentNames()` in
  `SixesTable.jsx`, adapted to produce 1-char (or 2-char on collision)
  tokens joined by `/`.
- `lbl1` and `lbl2` are computed once per match render and passed
  to both `renderHalf` and `renderAll18`.
- No engine files, no `scorecardUtils.js`, and no other table files
  are touched by this spec.

---

## 14. Invariants

1. `manualPresses` arrays are always sorted ascending
2. No duplicate values in any `manualPresses` array
3. All press start holes are within the segment's hole range
4. Press outcomes are never stored — always recomputed
5. Base match is never modified by press outcomes
6. `betFront`, `betBack`, `betOverall` are non-negative numbers
7. `autoPressF/B/O` values are `'none'` or a string digit `'1'`–`'5'`
8. Invariants 1–3 are enforced by `PressModal` at write time; the engine assumes valid input and does not normalize
9. A bet with `thru === 0` has no result; the payout layer must not pay it

---

## 16. Setup UI Vocabulary

### 16.1 Bet mode dropdown

`MatchCard` renders a mode dropdown that controls which bet fields are
displayed in the setup UI. The dropdown does **not** write a dedicated
mode field to `matchDef` — the effective mode is determined at runtime
by `isNassauMatch(matchDef)` (defined in `scorecardUtils.js`):
Nassau when `betFront > 0 || betBack > 0`.

| UI label | Effective mode | Fields shown | Press layout |
|---|---|---|---|
| Nassau | Nassau (`betFront > 0` or `betBack > 0`) | `$Front`, `$Back`, `$Total` | Three press dropdowns, vertical under each bet field |
| Total | Straight match (`betFront = 0`, `betBack = 0`) | `$Total` only, right-justified to Total column position | One press dropdown, horizontal beside bet field |

"Nassau" is retained as the UI display label for the segment-bet mode.
No stored field named `nassauMode` exists or is written. The `betFront`
and `betBack` fields on `matchDef` are the sole authority on which mode
is active.

### 16.2 Press dropdowns — UI labels vs stored values

| UI label | Stored value (`autoPressF` / `autoPressB` / `autoPressO`) |
|---|---|
| Manual | `'none'` |
| 1 Down | `'1'` |
| 2 Down | `'2'` |
| 3 Down | `'3'` |
| 4 Down | `'4'` |
| 5 Down | `'5'` |

Default on new match creation: `'none'` (Manual) for all three segments.
Engine field names `autoPressF`, `autoPressB`, `autoPressO` and their
stored value strings are unchanged from prior versions.

### 16.3 Dots teamMode dropdown — per-instance Match options

When Dots and Match / Nassau are both active and at least one match has
`format === 'team'`, the Dots secondary dropdown enumerates one option
per team-format match rather than a single generic "Match Teams" entry.

**Dropdown option construction:**
For each match at index `idx` in `matches[]` where `match.format === 'team'`:
```js
{ value: `Match:${match.id}`, label: `Match ${String.fromCharCode(65 + idx)} Teams` }
```

The full option list, in order:
1. `{ value: 'none',           label: 'Individual' }` — always present
2. `{ value: 'Sixes',          label: 'Sixes Teams' }` — only when Sixes is active
3. One entry per team-format match — only when Match / Nassau is active and has team matches

**Stored value:** `'Match:{matchId}'` — the stable match ID, not the label letter.

**Label derivation at render time:** The "Match A / B / C" letter in the option
label is always derived from the match's current index in `matches[]`. If matches
are deleted and surviving matches renumber, the dropdown labels update automatically
on the next render. The stored `teamMode` value is unaffected by renumbering.

**Match deletion side-effect:** When a match is removed from `matches[]` in
`NewRoundPage`, if `gameOpts.Dots.teamMode` equals `'Match:{deletedMatchId}'`,
reset `teamMode` to `'none'` in the same state update.

### 16.4 Bet mode carry-forward (13-F)

When the user switches between Total and Nassau modes in `MatchCard`, values
carry forward to avoid blank fields. This rule is canonical in
`UI_Component_Contract.md §4.10`; this section documents the Match-specific
implementation.

**Total → Nassau:** All three bet fields pre-populate with the current
`betOverall` value:
```js
// switchBetMode in MatchCard — Total → Nassau
onChange({
  ...match,
  betFront:   match.betOverall,
  betBack:    match.betOverall,
  betOverall: match.betOverall,
});
```

**Nassau → Total:** `betOverall` is retained; `betFront` and `betBack` are
cleared to 0 (they are not shown in Total mode):
```js
// switchBetMode in MatchCard — Nassau → Total
onChange({ ...match, betFront: 0, betBack: 0 });
// betOverall unchanged
```

**Prior behavior (pre-13-F):** Switching Total→Nassau left Front and Back
fields blank (`betFront: 0`, `betBack: 0`). This was inconsistent with Nines
and Stableford, which pre-populated FBT fields from the single bet value.
This contract standardizes the behavior.

---

## 17. Final Rule

If implementation behavior conflicts with this contract, call out the
conflict. The implementation must be corrected. This document defines
the truth.

---

## X Score Behavior

_Added session 13-B. See `ScoreKeypad_Contract.md` §4.5–§4.6 for the full "X always loses" invariant._

- A player with `'X'` on a hole loses that hole to any opponent with a real score.
- If both players have `'X'` on the same hole, the hole is halved.
- Team match: X player cannot contribute the best-ball for their team. If both partners X, the team's effective score is `Infinity` (loses to any real team score).
- Implementation: `runMatch` uses `Infinity` for X players. `runTeamMatch` uses `Infinity` for X players in `Math.min()` best-ball calculation. `MatchNassauTable.indivHoleWinner` checks the raw `'X'` string before `parseInt`. `MatchNassauTable.teamHoleWinner` uses `Infinity` with `isFinite` guards.
