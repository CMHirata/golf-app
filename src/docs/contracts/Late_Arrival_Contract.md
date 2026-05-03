# Late Arrival Contract

_Version 1.0 DRAFT — April 2026_
_Status: DRAFT — requires owner review and approval before any implementation code is written._
_New contract. Adds new sections to Round_Lifecycle_Contract.md._
_All implementation must conform to this contract once marked AUTHORITATIVE._
_If code conflicts with this contract, the contract wins._

---

**Primary files:**
`App.jsx`, `NewRoundPage.jsx`, `GameConfig.jsx`, `ScorecardPage.jsx`,
`ScoreGrid.jsx`, `payouts.js`, `games.js`, `roundLib.js`,
`RoundSummaryModal.jsx`, `roundUtils.js`

**Cross-references:**
- `Round_Lifecycle_Contract.md` §2.3, §2.6 — player setup and lineup change rules
  (§2.6 amended by this contract for append-only additions)
- `App_Data_Model_Contract.md` §5 — `activeRound` blob (new fields added here)
- `ScoreKeypad_Contract.md` — X scores used for pre-arrival holes (optional)
- `Payout_Contract.md` §2 — `computePayouts` entry point
- `Handicap_Contract.md` §2 — `courseHcps` computation (unchanged)
- All game contracts — per-game late-start behavior

---

## §1. Overview

### §1.1 Two late arrival scenarios

**Scenario A — Player joins mid-round:**
The group is playing a round already in progress. A new player arrives and
joins the round from hole `k` onward. Players 0–(n-1) have been scoring
normally. The new player (index n) begins at hole `k`. Their holes 0
through `k-1` are absent — they were not present.

**Real-world example:** Alice, Bob, Carol are playing 18-hole Nines. Dave
arrives at hole 13. Dave is added to the round. A Skins game is added for
holes 13–18 with Alice, Bob, and Dave (Carol opts out of Skins).

**Scenario B — Game added mid-round:**
All players are present from hole 1. A new game is added that only applies
to a subset of the round's holes. For example: the group plays holes 1–12
with no betting game, then adds Skins starting on hole 13.

This scenario does not require a new player — it is purely a game-level
hole range restriction. It may occur alongside Scenario A (as in the example
above) or independently.

### §1.2 What this contract covers

1. Data model for player join holes and game hole ranges (§2)
2. Adding a late-arriving player mid-round (§3)
3. Adding a game with a non-zero start hole (§4)
4. Engine behavior for both scenarios (§5)
5. Per-game rules (§6)
6. Scorecard display for pre-arrival holes (§7)
7. Handicap behavior (§8)
8. RoundSummaryModal and share image (§9)

---

## §2. Data Model

### §2.1 New fields in `activeRound`

```js
activeRound: {
  // NEW — per-player join hole
  playerJoinHoles: number[] | undefined,
  // Array parallel to activePlayers[].
  // playerJoinHoles[i] = 0-based index of first hole player i played.
  // Absent or null entry = 0 (player present from hole 1).
  // Default for all players at round start: all zeros (or field absent).
  // Must be written at round assembly time and preserved on re-assembly.

  // NEW — per-game hole range
  gameHoleRanges: { [gameKey: string]: { start: number, end: number } } | undefined,
  // Per-game hole range override.
  // Key = canonical game name (same as activeGames[] entry).
  // For Match / Nassau instances: key = matchDef.id.
  // Absent key = game covers full round (holes 0 through lastCompletedHole ?? 17).
  // start and end are 0-based hole indices.
}
```

### §2.2 `gameKey` format

- Single-instance games: `'Skins'`, `'Sixes'`, `'Stableford'`, `'Nines'`,
  `'Stroke Play'`, `'Specials'`
- Match / Nassau instances: `matchDef.id` (e.g. `'m_123_abc'`) — each match
  has its own independent hole range

### §2.3 Effective hole range for a game

```
effectiveStart(g) = gameHoleRanges[g]?.start ?? 0
effectiveEnd(g) = min(gameHoleRanges[g]?.end ?? 17, lastCompletedHole ?? 17)
```

A game with no `gameHoleRanges` entry runs over `[0, lastCompletedHole ?? 17]`.
This is identical to current behavior — fully backward compatible.

### §2.4 Player eligibility on a hole

A player `i` is eligible in game `g` on hole `h` when ALL of:
1. `h >= (playerJoinHoles[i] ?? 0)` — player was present
2. `h >= effectiveStart(g)` — hole is within game's range
3. `h <= effectiveEnd(g)` — hole is within game's ceiling
4. Player `i` is in the game's subset (or subset is empty = all players)

This is the master eligibility rule. All engine functions for all games
must apply this rule.

### §2.5 `buildPayoutArgs` additions

```js
{
  playerJoinHoles:  ar.playerJoinHoles  ?? new Array(ar.activePlayers.length).fill(0),
  gameHoleRanges:   ar.gameHoleRanges   ?? {},
  // lastCompletedHole and earlyEndOpts already present
}
```

### §2.6 `roundLib` changes

`fromActiveRound` must include both fields in the history record.
`toActiveRound` must restore both fields (default to `undefined` if absent
in old records — backward compatible).

---

## §3. Adding a Late-Arriving Player Mid-Round

### §3.1 Flow

The user navigates to Setup (← Setup button) during a round in progress.
They add the new player to the lineup (appended at the end — see §3.2).
They configure any new games to add (see §4). They tap Start Scoring /
center logo button. `handleStart` runs.

### §3.2 Lineup change rule — amendment to RLC §2.6

**Current rule (RLC §2.6):** Any lineup change → full score reset.

**Amendment for append-only addition:**
When a player is appended to the end of the lineup and the existing players
remain in the same order with the same IDs, the modified continuity rule applies:

| Condition | Existing scores | New player's scores | `playerJoinHoles` |
|---|---|---|---|
| Existing players: same IDs, same order. New player appended at end. | Preserved | All `''` (18 empty cells) | Existing players: their prior values (or 0). New player: `currentHole`. |

**"Current hole" for join hole determination:**
The join hole is determined as the first hole the new player will actually
play. The app sets `playerJoinHoles[newIdx]` to the value the user confirms
in the join confirmation dialog (§3.3).

**Any other lineup change (reorder, swap, remove, insert mid-lineup) still
triggers a full reset per RLC §2.6.** Append-only is the only exception.

### §3.3 Confirmation dialog

When `handleStart` detects an append-only lineup change (new player added,
existing order preserved):

```
"Add [PlayerName] to this round?

They will start scoring from hole [autoDetectedHole].
Holes 1–[autoDetectedHole - 1] will be blank for [Name].

[Change hole: ▼ Hole 13]     [Cancel]     [Add Player]"
```

**Auto-detected hole:** The lowest hole index where no player currently has
a score (i.e., the next unscored hole). In a typical scenario where the
group is on hole 13, holes 1–12 are scored and hole 13 is the first blank
hole — auto-detected as the join hole.

The user may override with the hole picker if needed.

On "Add Player": `playerJoinHoles[newIdx]` = selected hole. Round resumes.
On "Cancel": new player is removed from the lineup, round unchanged.

### §3.4 New player's handicap

The new player's `courseHcps[newIdx]` is computed at `handleStart` time
using their HI/CH exactly as for any other player. `minCourseHcp` is
recomputed across all players including the new player.

**Impact on NOL mode:** If the new player has the lowest course handicap,
they become the new NOL baseline. This retroactively changes the NOL stroke
calculations for all players on all prior holes. This is correct behavior —
the engine always recomputes from raw scores.

**Decision required (G-1):** Should adding a late-arriving player with a
lower course handicap than the current minimum cause NOL recalculation
to apply retroactively to holes already played? Options:
- A: Yes — full retroactivity, consistent with subset change retroactivity
  already in RLC §3.6
- B: No — NOL baseline is frozen at round start; late joiner's handicap only
  affects holes from join hole onward
- Recommendation: Option A (consistent with existing retroactivity rule).
  Owner to confirm.

### §3.5 New player's pre-arrival holes

For holes 0 through `playerJoinHoles[newIdx] - 1`:
- `scores[h][newIdx]` = `''` (empty — not scored, not X)
- In `ScoreGrid`: these cells show `–` (locked, no input possible)
- In engine: player is ineligible on these holes per §2.4 rule 1

**Why not X scores for pre-arrival holes?**
X means the player was present and picked up. Pre-arrival holes are different —
the player was not present at all. Storing `''` with a locked display is the
correct representation. The engine's existing empty-string guard handles this
correctly (empty = not present on hole).

---

## §4. Adding a Game with a Non-Zero Start Hole

### §4.1 "Starts on hole" picker in GameConfig

For each active game tile in `GameConfig`, a **"Starts on hole" picker row**
is shown when the round is in progress (i.e., when `inProgress === true` and
`scores` contains at least one non-empty cell).

```
[Starts on hole: ▼ Hole 1]
```

- Default: Hole 1 (no range restriction — backward compatible).
- Dropdown: Hole 1 through Hole 18 (1-based for display; stored as 0-based).
- Hidden when the round has not yet started (no scores exist) — unnecessary
  for fresh rounds.
- The picker is per-game — each game can have a different start hole.

### §4.2 Persistence through handleStart

When `handleStart` runs on a lineup-unchanged re-entry (scores preserved):
- Any `gameHoleRanges` values set in the "Starts on hole" pickers are
  written into the reassembled `activeRound`.
- Existing `gameHoleRanges` from the prior `activeRound` are read as
  defaults for the pickers (so the user sees the current setting, not Hole 1).
- A game that was newly added in this setup session AND has a start hole
  set → its `gameHoleRanges` entry is created.
- A game that was already in `activeGames` from before → its existing
  `gameHoleRanges` entry is preserved unless the user changed the picker.

### §4.3 Validation

- `start` must be 0–17.
- `end` defaults to 17 (end of round) unless explicitly set.
- `start` must be ≤ `end`.
- If `start === 0` and `end === 17`, the entry may be omitted (equivalent to
  no restriction).

---

## §5. Engine Behavior

### §5.1 Universal eligibility rule

Before computing any per-hole result for player `i` on hole `h` in game `g`,
the engine applies the §2.4 eligibility check. Ineligible player-hole-game
combinations are skipped exactly as if the player was not in the game's subset.

The implementation pattern in `payouts.js` / `games.js`:

```js
const gStart = gameHoleRanges[gameKey]?.start ?? 0;
const gEnd   = Math.min(gameHoleRanges[gameKey]?.end ?? 17, lastCompletedHole ?? 17);

for (let h = gStart; h <= gEnd; h++) {
  const eligiblePlayers = participantIdxs.filter(i =>
    (playerJoinHoles[i] ?? 0) <= h &&
    scores[h][i] !== ''          // also guards X scores — X is non-empty
  );
  if (eligiblePlayers.length < minRequired(game)) continue; // skip hole
  // ... compute hole result for eligiblePlayers
}
```

### §5.2 Backward compatibility

When `playerJoinHoles` is absent (old rounds, or new rounds with no late
arrivals), the eligibility check reduces to:
```
h >= 0  AND  h <= effectiveEnd  AND  subset membership  AND  non-empty score
```
This is identical to current engine behavior. No change for normal rounds.

When `gameHoleRanges` is absent (all existing rounds), `gStart = 0` and
`gEnd = lastCompletedHole ?? 17` — identical to current behavior.

### §5.3 Minimum eligible players per game

Some games cannot run with fewer than a minimum number of eligible players
on a given hole. When fewer than the minimum are eligible, the hole is skipped
(no result, no payout contribution from that hole).

| Game | Minimum eligible players per hole |
|---|---|
| Nassau / Match (individual) | 2 (both match participants) |
| Nassau / Match (team) | 4 (all team members, or at least 1 per team for best-ball) |
| Skins | 2 |
| Stableford | 1 (solo accumulation) |
| Nines | 3 (exact — see §6.3) |
| Sixes | 2 per team (best-ball — 1 partner's score is sufficient) |
| Stroke Play | 1 (solo accumulation) |
| Dots | 1 per player (individual accumulation) |

### §5.4 Zero-sum invariant preservation

If a hole is skipped (too few eligible players), it contributes nothing to
any player's payout. The zero-sum invariant holds because $0 in = $0 out.

---

## §6. Per-Game Late-Start Behavior

### §6.1 Skins with non-zero start

- Skins computation begins at `gStart`. Hole `gStart` is the first
  eligible hole. Carryover does not exist before `gStart`.
- A tied hole at `gStart` carries to `gStart + 1` (normal carryover rule).
- Players who joined before `gStart` are eligible from `gStart` per the
  game range rule, regardless of when they personally arrived.

### §6.2 Nassau / Match with non-zero start

- The match covers holes `gStart` through `gEnd`.
- **Segment structure:** The match's hole range is divided into front half,
  back half, and overall. The midpoint is `floor((gEnd - gStart + 1) / 2)`
  holes for the front, remainder for the back.
  Example: 6-hole match (holes 13–18): front = holes 13–15 (3 holes),
  back = holes 16–18 (3 holes), overall = holes 13–18.
  Example: 17-hole match (holes 2–18): front = holes 2–10 (9 holes),
  back = holes 11–18 (8 holes), overall = holes 2–18.
- Front and back bets apply to their respective halves; overall applies
  to the full range.
- Table column headers in `MatchNassauTable` should reflect actual hole
  numbers (e.g. "Holes 13–15" instead of "Front 9") when `gStart > 0`.
  Display change deferred to polish session.

### §6.3 Nines with non-zero start

- The Nines rotation begins fresh at hole `gStart` (D-5 confirmed: fresh start).
- Hole `gStart` is treated as "hole 1 of the game" for rotation purposes.
- The 9-point distribution and blitz rules apply from `gStart` onward.
- If a Nines player has `playerJoinHoles[i] > gStart`, that player is
  ineligible on holes `gStart` through `playerJoinHoles[i] - 1`. Nines
  requires 3 eligible players per hole — any hole with fewer than 3 eligible
  players is skipped (§5.3).

### §6.4 Stableford with non-zero start

- Points accumulate only for holes `gStart` through `gEnd`.
- Handicap stroke allocation still uses the full 18-hole stroke index
  (hole difficulty is a course property, not affected by game start hole).

### §6.5 Stroke Play with non-zero start

- Strokes accumulate only for holes `gStart` through `gEnd`.
- For a late-joining player, their total is the sum of their scores on
  holes `max(playerJoinHoles[i], gStart)` through `gEnd`.

### §6.6 Sixes with non-zero start

Sixes has three 6-hole segments: holes 0–5, 6–11, 12–17 (0-based).
When `gStart > 0`, only segments whose start hole is ≥ `gStart` are played.

| `gStart` | Segments played |
|---|---|
| 0–5 | Segments 1, 2, 3 |
| 6–11 | Segments 2, 3 only |
| 12–17 | Segment 3 only |
| Mid-segment (e.g. 7) | Segments 2, 3 only (partial segment 2 start discarded) |

A partial segment (start hole falls mid-segment) discards the partial start.
Only fully-playable segments from `gStart` onward are included.

### §6.7 Dots / Specials with non-zero start

Dots are only awarded/charged for holes `gStart` through `gEnd`. Dots on
holes outside this range are excluded from payout even if logged.
Auto-mark logic must not fire for holes outside the game's range.

---

## §7. Scorecard Display

### §7.1 Pre-arrival cells for late-joining player

In `ScoreGrid`:
- Holes 0 through `playerJoinHoles[i] - 1` for player `i`:
  - Display: `–` (en-dash)
  - Background: `#eee` (same as empty/unscored header background, or a
    slightly darker gray — distinct from normal empty cells)
  - Interaction: locked — tapping does not open ZoomModal
- Holes from `playerJoinHoles[i]` onward: normal scoring behavior

### §7.2 Pre-arrival cells in ZoomModal

The 3-hole ZoomModal window must skip over a player's pre-arrival holes.
If the window includes a pre-arrival hole for a given player, that player's
row in that hole shows `–` and cannot be tapped/activated.

### §7.3 Game range indicator (deferred)

A visual indicator showing "Game starts at hole N" in the game table header
(e.g. in `SkinsTable`, `NinesTable`) is a polish-session item. Not required
for initial implementation.

---

## §8. Handicap Behavior

### §8.1 Late-joining player's handicap

Computed at `handleStart` time using the player's HI/CH exactly as for
any player. `courseHcps` and `minCourseHcp` are recomputed across all
players including the late joiner.

### §8.2 NOL retroactivity (per G-1 decision)

If the late-joining player has a lower course handicap than the current
`minCourseHcp`, and Option A (retroactivity) is confirmed by the owner,
then NOL stroke calculations for all players on holes 0 through
`playerJoinHoles[newPlayer] - 1` are recomputed with the new `minCourseHcp`.

This is automatic — the engine always uses the current `courseHcps` and
`minCourseHcp` from `activeRound`, which are recomputed on `handleStart`.

### §8.3 ESC for late-joining player

X scores for pre-arrival holes are not applicable (those holes are `''`).
ESC for the late-joining player is computed only over holes
`playerJoinHoles[i]` through `lastCompletedHole ?? 17`.

---

## §9. RoundSummaryModal and Share Image

### §9.1 Game tables

Game tables display results computed by the engine. Because `playerJoinHoles`
and `gameHoleRanges` are included in the `activeRound` blob reconstructed
by `roundLib.toActiveRound`, the engine produces correct results automatically.
No table component changes are required.

### §9.2 Scorecard display

`ReadOnlyScorecard` must apply the same `–` display for pre-arrival holes
as `ScoreGrid` (§7.1). Pass `playerJoinHoles` as a prop to `ReadOnlyScorecard`.

### §9.3 Share image

Same `–` display for pre-arrival hole cells in the share image scorecard.
`buildShareHtml` / `buildSharePdf` must read `playerJoinHoles` from `ar`
and apply locked-cell rendering.

---

## §10. Backward Compatibility

All changes are fully backward compatible:
- `playerJoinHoles` absent → all players joined at hole 0 (no locked cells,
  no eligibility restrictions beyond existing subset rules)
- `gameHoleRanges` absent → all games start at hole 0 (existing behavior)
- Old saved rounds load and render identically to current behavior

No data migration required.

---

## §11. Invariants

1. `playerJoinHoles[i]` is set at `handleStart` time and does not change
   during the scoring phase. It is part of the configuration fields (RLC §3.2).
2. `scores[h][i]` is always `''` for holes `h < playerJoinHoles[i]`.
   The engine treats `''` as ineligible — this is the existing guard.
3. `gameHoleRanges` values set at `handleStart` time are configuration fields.
   They do not change during the scoring phase.
4. The effective hole range for game `g` is always
   `[effectiveStart(g), effectiveEnd(g)]` as defined in §2.3. No code path
   may use a different range for the same game in the same round.
5. Append-only player addition preserves existing scores for unchanged players.
   Any other lineup mutation triggers a full reset.
6. The zero-sum invariant holds for all games, including those with non-zero
   start holes and those with late-joining players.
7. `fromActiveRound` / `toActiveRound` round-trip both `playerJoinHoles`
   and `gameHoleRanges` faithfully.
8. A player in `activePlayers` with `playerJoinHoles[i] > 0` is never
   a member of any game's subset for holes before their join hole, regardless
   of what their subset membership field says.

---

## §12. Known Gaps and Open Items

| # | Severity | Description |
|---|---|---|
| G-1 | High | NOL retroactivity when late-joining player has lower courseHcp than existing minimum — Option A (retroactive) vs Option B (frozen at round start). Owner to confirm. |
| G-2 | Medium | `MatchNassauTable` column headers for non-zero-start matches — polish session |
| G-3 | Medium | "Starts on hole N" indicator in game table headers — polish session |
| G-4 | Medium | ZoomModal 3-hole window behavior for pre-arrival holes — confirm skip behavior at implementation time |
| G-5 | Low | Sixes mid-segment start (e.g. `gStart = 7`) — partial segment discard confirmed; engine implementation detail |
| G-6 | Low | 5-player Sixes with late-joining player — Sixes already requires exactly 4; late join with Sixes active requires care at implementation |

---

## §13. Testing Checklist

1. **Player joins mid-round:**
   - 3-player round, score 12 holes. Go to Setup, add 4th player, confirm join
     at hole 13. Return to scorecard. Player 4's holes 1–12 show `–` (locked).
     Player 4 can score from hole 13 onward. ✓
2. **Existing scores preserved on append:**
   - After adding player 4, players 1–3 scores on holes 1–12 are unchanged. ✓
3. **New Skins game starting at hole 13:**
   - Add Skins in setup with "Starts on hole 13." Confirm. Skins only computes
     holes 13–18. Holes 1–12 produce no Skins result. ✓
4. **Skins carryover starts fresh at hole 13:**
   - Tied hole 13 → skin carries to hole 14. No carryover exists before hole 13. ✓
5. **Nines fresh rotation at non-zero start:**
   - Nines starts at hole 13. Hole 13 = rotation position 1. Point distribution
     from hole 13 as if it were hole 1. ✓
6. **Late-joining player ineligible in Nines:**
   - Dave joins at hole 13. Nines game covers holes 1–18, Dave not in Nines subset.
     Dave does not affect Nines results. ✓
7. **Sixes segment rule with start at hole 7 (gStart = 6):**
   - Sixes starts at hole 7. Only segments 2 and 3 are computed. Segment 1 produces
     no result. ✓
8. **History reload preserves late-arrival data:**
   - Save round with late-joining player. Reload from history. `playerJoinHoles`
     restored. Pre-arrival cells show `–` in ReadOnlyScorecard. ✓
9. **Share image:**
   - Pre-arrival cells show `–` in share image scorecard. ✓
10. **Backward compatibility:**
    - Open an old saved round (no `playerJoinHoles` or `gameHoleRanges`).
      Displays and computes identically to current behavior. ✓

---

## §14. Final Rule

If implementation behavior conflicts with this contract, call out the conflict.
The implementation must be corrected. This document defines the truth.
