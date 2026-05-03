# Early Departure Contract

_Version 1.0 DRAFT — April 2026_
_Status: DRAFT — requires owner review and approval before any implementation code is written._
_New contract. Supersedes Round_Lifecycle_Contract.md §4.5–4.7 (early end sections)._
_All implementation must conform to this contract once marked AUTHORITATIVE._
_If code conflicts with this contract, the contract wins._

---

**Primary files:**
`App.jsx`, `ScorecardPage.jsx`, `ZoomModal.jsx`, `payouts.js`, `games.js`,
`roundLib.js`, `RoundSummaryModal.jsx`, `roundUtils.js`

**Cross-references:**
- `Round_Lifecycle_Contract.md` §4.5–4.7 — superseded by this contract
- `Round_Lifecycle_Contract.md` §12.13 — `lastCompletedHole` normalization (preserved)
- `ScoreKeypad_Contract.md` §5 — long-press X triggers departure resolver
- `App_Data_Model_Contract.md` §5 — `activeRound` blob (new fields added here)
- `Payout_Contract.md` §2 — `computePayouts` entry point
- `Handicap_Contract.md` §2 — `courseHcps` not changed
- All game contracts — per-game early-end behavior

---

## §1. Overview

### §1.1 Two departure scenarios

**Scenario A — One player leaves early:**
A single player stops playing mid-round. The remaining players continue
to hole 18. The departing player's remaining holes may be entered as X scores
(their ESC maximum) or left blank. Each active game where the departing
player participated needs a resolution decision.

**Scenario B — All players end the round early:**
The entire group stops after some hole due to weather, darkness, or agreement.
All players have scores through hole `k` and no scores after. Every active
game needs a resolution decision.

Both scenarios share the same resolver UI and the same data model.
The difference is detection: Scenario A has one incomplete player;
Scenario B has all players incomplete.

### §1.2 What this contract covers

1. Detection of departure conditions (§2)
2. The resolver sheet UI and per-game resolution options (§3)
3. Data model changes to `activeRound` (§4)
4. Engine behavior for each resolution option (§5)
5. Per-game rules for each scenario (§6)
6. Long-press X → departure resolver wiring (§7)
7. Results-gated resolver (§8) — the other entry point

---

## §2. Detection

### §2.1 When departure is detected

The app detects a departure condition in two places:

**Entry point 1 — Long-press X on keypad (proactive):**
User long-presses X on a score cell during scoring. This means: "this player
is done, not just picking up on this hole." See §7.

**Entry point 2 — Results → tap (reactive):**
User taps "Results →" and the app finds incomplete scores. See §8.

### §2.2 Classifying incomplete players

When the Results transition is attempted and scores are incomplete, the app
classifies each player as one of:

| Class | Definition |
|---|---|
| **Complete** | Has a non-empty score (real or X) on every hole 0 through `highWaterMark` |
| **Early departure** | Has scores through some hole `k`, then all empty after `k` (contiguous trailing block of empty cells) |
| **Missing scores** | Has at least one empty hole that is not in a contiguous trailing block (scattered gaps) |

**`highWaterMark`:** The highest hole index where any player has a non-empty
score. This is the de facto last hole of the round.

**Classification logic:**
```
For each player i:
  lastScored[i] = max hole h where scores[h][i] is non-empty (real or X)
  trailingEmpty[i] = all holes from lastScored[i]+1 to highWaterMark are empty

  if lastScored[i] === highWaterMark → Complete
  elif trailingEmpty[i] === true → Early departure (left after hole lastScored[i])
  else → Missing scores (forgot to enter)
```

### §2.3 Routing based on classification

| Situation | App behavior |
|---|---|
| All players Complete | Normal Results flow — no resolver |
| All players Early departure at the same hole | Scenario B resolver (all players, round ends at that hole) |
| All players Early departure (different holes) | Scenario B resolver using the lowest `lastScored` as `lastCompletedHole` |
| One or more players Early departure, rest Complete | Scenario A resolver (named player(s) departed) |
| Any player has Missing scores | Block Results with "Missing scores" error — list which holes. Do not show resolver. User must go back and enter scores. |
| Mix of Missing scores and Early departure | Block with "Missing scores" error. Missing scores take priority — they must be resolved first. |

**Key principle:** The resolver only appears when the app can unambiguously
classify the incomplete players as "left early." Scattered missing scores are
always a data entry problem, not a departure.

---

## §3. Resolver Sheet UI

### §3.1 Trigger and presentation

The resolver sheet is a bottom sheet modal. It appears:
- After a long-press X in ZoomModal (§7) — for one named player
- After tapping "Results →" with an early departure condition (§8) — for all affected players

### §3.2 Sheet structure — Scenario A (one player)

```
┌─────────────────────────────────────────┐
│  Dave left after hole 12                │  ← header
│                                         │
│  How do you want to resolve each game?  │
│                                         │
│  Skins (Dave, Alice, Bob, Carol)        │
│  [Pay based on holes 1–12          ▾]  │
│                                         │
│  Nines (Dave, Alice, Bob)               │
│  [Remove Dave — others finish      ▾]  │
│                                         │
│  Match A: Dave vs Alice                 │
│  [Pay based on holes 1–12          ▾]  │
│                                         │
│  Dots                                   │
│  [Pay based on holes 1–12          ▾]  │
│                                         │
│  [  Cancel  ]    [  Confirm  ]         │
└─────────────────────────────────────────┘
```

### §3.3 Sheet structure — Scenario B (all players)

```
┌─────────────────────────────────────────┐
│  Round ended after hole 9               │  ← header
│                                         │
│  How do you want to resolve each game?  │
│                                         │
│  Match A: Dave vs Alice                 │
│  [Pay based on holes played        ▾]  │
│                                         │
│  Skins (all players)                    │
│  [Pay based on holes played        ▾]  │
│                                         │
│  [  Cancel  ]    [  Confirm  ]         │
└─────────────────────────────────────────┘
```

### §3.4 Resolution options per game

Each game row shows a dropdown with the following options. Not all options
are available for every game — see §3.5.

| Option key | Display label | Meaning |
|---|---|---|
| `'payout'` | "Pay based on holes played" | Engine computes payout over completed holes only. For Scenario A, departed player's X scores are used for holes they played; empty holes (after departure) are excluded from the departed player's participation in this game. |
| `'no_payout'` | "Abandon — no money changes hands" | Game produces $0 payout for all players. |
| `'exclude_player'` | "Remove [Name] — others continue" | Departed player is removed from this game's subset retroactively. Remaining players' results are computed as if the departed player was never in the game. Only available in Scenario A and only for games where subset removal is valid. |

**Default pre-selection:** `'payout'` for all games.

### §3.5 Option availability per game

| Game | `'payout'` | `'no_payout'` | `'exclude_player'` |
|---|---|---|---|
| Nassau / Match | ✓ | ✓ | ✓ (Scenario A only — removes player from match; remaining player wins by default if 1-on-1, or match restructures if team) |
| Skins | ✓ | ✓ | ✓ (Scenario A only — departed player removed from skins pool; remaining players' existing wins unchanged) |
| Stableford | ✓ | ✓ | ✓ (Scenario A only) |
| Nines | ✓ | ✓ | ✓ (Scenario A only — Nines requires exactly 3; if departed player was one of 3, Nines is abandoned for remaining holes OR remaining holes use `'payout'` for the partial range; see G-1) |
| Sixes | ✓ | ✓ | ✗ (Sixes requires exactly 4 players in fixed team structure — player removal is not valid; only `'payout'` or `'no_payout'`) |
| Stroke Play | ✓ | ✓ | ✓ (Scenario A only) |
| Dots | ✓ | ✓ | ✓ (Scenario A only — departed player's dots entries frozen at departure hole; they cannot earn or be charged new dots after departure) |

### §3.6 Sixes special rule for Scenario A

If one of four Sixes players departs early, `'exclude_player'` is not
available (Sixes requires exactly 4). The options are:
- `'payout'` — complete segments before departure are paid normally;
  incomplete segment at departure is discarded (per existing Sixes segment rule)
- `'no_payout'` — no payout for any segment

### §3.7 Nines edge case for Scenario A

If the departing player was one of the three Nines players, `'exclude_player'`
results in fewer than 3 Nines players for the remaining holes.
When `'exclude_player'` is selected for Nines:
- Holes before departure: computed with all 3 players (including departed
  player's X scores and real scores)
- Holes after departure: Nines cannot run with 2 players — these holes produce
  no Nines result (0 points distributed)
- Effectively: `'exclude_player'` for Nines = pay for holes played up to
  departure hole. This is communicated to the user in the option label:
  "Remove [Name] — Nines pays holes 1–[k]"

### §3.8 Confirm behavior

On confirm:
1. Write `lastCompletedHole`, `earlyEndOpts`, and `earlyDepartureOpts` to
   `activeRound` (see §4)
2. For any game where `'exclude_player'` was selected: update that game's
   player subset in `activeRound` to remove the departed player
3. Navigate to Results tab (call `handleGoResults`)
4. The Results page computes payouts fresh using the updated `activeRound`

On cancel: sheet dismisses, user is returned to the scorecard unchanged.

---

## §4. Data Model Changes

### §4.1 New / amended fields in `activeRound`

```js
activeRound: {
  // EXISTING — unchanged semantics, now also set by departure resolver
  lastCompletedHole: number | undefined,
  // 0-based index of last hole counted for the round.
  // Set by Scenario B resolver to the hole where all players stopped.
  // Set by Scenario A resolver to highWaterMark (the round continues;
  //   only the individual game subsets change).

  earlyEndOpts: { [gameKey: string]: 'payout' | 'no_payout' } | undefined,
  // EXISTING — unchanged. Keyed by canonical game name.
  // Set by resolver for both scenarios.

  // NEW
  earlyDepartureOpts: {
    [playerIdx: number]: {
      departureHole: number,           // 0-based — last hole this player played
      gameResolutions: {
        [gameKey: string]: 'payout' | 'no_payout' | 'exclude_player'
      }
    }
  } | undefined,
  // Per-player departure data. Only present when one or more players departed
  // early (Scenario A). Not set for Scenario B (use earlyEndOpts instead).
  // playerIdx matches index in activePlayers[].
}
```

### §4.2 Scenario B vs Scenario A — which fields are set

| Scenario | `lastCompletedHole` | `earlyEndOpts` | `earlyDepartureOpts` |
|---|---|---|---|
| Normal round | absent / 17 | absent | absent |
| Scenario B (all stop) | set to stop hole | set per game | absent |
| Scenario A (one leaves) | 17 (full round continues) | absent | set for departed player |
| Scenario A + B combined (player leaves AND round ends early) | set to round end hole | set per game | set for departed player |

### §4.3 `gameKey` rules

Keys in `earlyEndOpts` and `earlyDepartureOpts.gameResolutions` must exactly
match `activeGames[]` entries. For multi-instance Match / Nassau, key = `matchDef.id`.
This rule is identical to the existing `earlyEndOpts` key rule in RLC §4.5.

### §4.4 `buildPayoutArgs` changes

New fields added to `buildPayoutArgs` output:
```js
{
  earlyDepartureOpts: ar.earlyDepartureOpts ?? {},
  // lastCompletedHole and earlyEndOpts already present (existing)
}
```

### §4.5 `roundLib` changes

`fromActiveRound` must include `earlyDepartureOpts` in the history record.
`toActiveRound` must restore `earlyDepartureOpts` (default to `undefined` if
absent in old records — backward compatible).

---

## §5. Engine Behavior

### §5.1 `'payout'` resolution

Engine computes the game over the effective hole range:
- Scenario B: holes 0 through `lastCompletedHole`
- Scenario A with `'payout'`: holes 0 through `earlyDepartureOpts[i].departureHole`
  for the departed player; holes 0 through `lastCompletedHole ?? 17` for
  remaining players. The engine treats the departed player's post-departure holes
  as if they scored their X value (which they did — the X scores are in `scores`).

Actually for Scenario A `'payout'`: the departed player has X scores entered
(via the keypad) for holes after their real scores. The engine uses these
X values directly. No special engine handling needed beyond the standard
"X always loses" rule already in `payouts.js`. **This is the beauty of the
X score approach — the engine does not need to know about the departure; it
just sees X scores and applies the invariant.**

### §5.2 `'no_payout'` resolution

Engine skips the game block entirely. All players receive $0 for this game.
Same as `earlyEndOpts[game] === 'no_payout'` behavior.

### §5.3 `'exclude_player'` resolution

The departed player is removed from the game's player subset before the engine
runs. This is implemented by updating the subset field in `activeRound` at
resolver confirm time (§3.8 step 2). The engine then runs with the updated
subset and never sees the departed player as a participant in that game.

**The engine itself does not handle `'exclude_player'`** — the resolver
pre-processes the subset before calling `computePayouts`. The engine always
sees a valid, complete subset with no absent players.

### §5.4 Sixes early-end segment rule (preserved)

From RLC §4.6 (unchanged): Sixes pays completed segments only. A segment is
complete if its final hole has been played. This applies regardless of `earlyEndOpts`.

### §5.5 Manual presses beyond departure hole (preserved)

From RLC §4.7 (unchanged): presses with trigger holes > `lastCompletedHole` are ignored.

---

## §6. Per-Game Early End Behavior

### §6.1 Nassau / Match — Scenario B (all stop)

The match is computed over holes 0 through `lastCompletedHole`.
- **Front nine:** If `lastCompletedHole < 8` (fewer than 9 holes), the front
  nine bet may be incomplete. Rule: a segment pays out only if its closing hole
  has been played (hole 8 for front, hole 17 for back, hole 17 for overall).
  An incomplete front nine produces no front payout unless `earlyEndOpts`
  explicitly sets `'payout'`.
- If `earlyEndOpts['Match / Nassau'] === 'payout'`: compute all completed
  holes; the front closes at `lastCompletedHole` if < 8.
- The "whoever leads after last hole wins the segment" rule applies.

**Decision required (G-2):** When a match ends mid-segment with `'payout'`
selected, does the partial segment pay? Options:
- A: Yes — whoever leads after the last hole played wins the partial segment
- B: No — partial segments produce no payout (only fully completed segments)

Recommendation: Option A — more satisfying for the players, consistent with
"pay based on holes played" label.

### §6.2 Nassau / Match — Scenario A (one player departs)

If `'exclude_player'` is selected: the remaining player wins the match by
walkover. Payout = full match value (front + back + overall bets) to
the remaining player.

If `'payout'` is selected: X scores for the departed player are used. The
departed player will lose every remaining hole (X always loses). This may
feel punitive but is technically correct — the departed player conceded the
remaining holes by leaving. This is equivalent to a golf concession.

### §6.3 Skins — Scenario B

Skins computed over holes 0 through `lastCompletedHole`. Carryover at the
final hole: any unsettled skin at `lastCompletedHole` is the last
carryover — it is paid to the winner of the last hole (if there is one)
or added to the pot (pot mode) / lost (carryover = no, no winner = skin lost).

**Unsettled final carry rule:** If the last hole is also tied (no skin winner),
the skin is lost (same as a tied final hole in a normal round). There is no
"return the carry" behavior.

### §6.4 Nines — Scenario B

Nines computed over holes 0 through `lastCompletedHole`. Point totals are
the sum of all allocated points over the played holes.

If `lastCompletedHole` results in an odd number of holes and a partial Nassau
(Nines Nassau mode), the front/back/overall split applies to whatever holes
were played (same logic as Match §6.1).

### §6.5 Stableford — Scenario B

Total points computed over holes 0 through `lastCompletedHole`. No segment
adjustment needed — Stableford is cumulative.

### §6.6 Stroke Play — Scenario B

Total strokes computed over holes 0 through `lastCompletedHole`. The existing
incomplete-score guard (RLC §4.2 / amended here) is satisfied by the departure
resolver having already established `lastCompletedHole`.

---

## §7. Long-Press X → Departure Resolver (Proactive Entry)

### §7.1 Trigger

User long-presses X in `ScoreKeypad` for player `i` on hole `h`.

### §7.2 Behavior sequence

1. The score `'X'` is **saved immediately** for `scores[h][i]` before the
   sheet appears. The player picked up on this hole regardless of whether
   they are departing.
2. The resolver sheet appears with the question:
   > "Is [PlayerName] done for the round?"
   Two buttons: **"Just this hole"** (dismiss sheet — X is saved, nothing else
   changes) and **"Yes, [Name] is leaving"** (open full game resolver).
3. If "Yes": the full per-game resolver sheet (§3.2) appears with
   `departureHole = h` for player `i`.
4. On resolver confirm: `earlyDepartureOpts` is written to `activeRound`
   (§4.1). The round continues for other players. The departed player's
   remaining score cells are locked (display `–`, no input) in `ScoreGrid`.
5. The round proceeds normally. When "Results →" is tapped later, the
   engine uses the X scores + `earlyDepartureOpts` to compute payouts.

### §7.3 Post-departure scorecard behavior

After a player is marked as departed:
- Their score cells for holes after `departureHole` show `–` (locked, no input)
- Their name chip in the scorecard header is visually dimmed or marked
  (subtle — not alarming; a small `–` badge or gray tint)
- They still appear in game tables in RoundSummaryModal (their results
  through the departure hole are shown; subsequent holes show `–`)

### §7.4 Undoing a departure

If the player returns ("false alarm — Dave is back"), the user can re-enter
the scorecard and tap the locked cell. A prompt appears:
> "[Name] was marked as departed. Resume scoring for [Name]?"
Confirming removes the player from `earlyDepartureOpts` and unlocks their cells.

---

## §8. Results → Gated Resolver (Reactive Entry)

### §8.1 Trigger

User taps "Results →" with incomplete scores.

### §8.2 Classification

App classifies each player per §2.2. If any player has Missing scores
(scattered gaps), Results is blocked with the existing error message.

If all incomplete players are Early departure (contiguous trailing empty):

**Scenario B (all players incomplete):**
- Show resolver sheet with "Round ended after hole [highWaterMark]" header
- All games shown with per-game resolution dropdowns (§3.2)
- On confirm: set `lastCompletedHole = highWaterMark`, set `earlyEndOpts`

**Scenario A (one or more players incomplete, rest complete):**
- Show resolver sheet with "[Name] left after hole [lastScored[i]]" header
  for each incomplete player
- Same per-game dropdowns
- On confirm: set `earlyDepartureOpts` for each departed player

### §8.3 Multiple departed players

If two players are classified as Early departure (e.g. Dave left after hole 12,
Carol left after hole 15), the resolver shows both players' situations
separately on the same sheet, stacked vertically with a divider between them.

---

## §9. RoundSummaryModal and Share Image

### §9.1 Display for partial rounds

Game tables in `RoundSummaryModal` and the share image do not need structural
changes for partial rounds. The engine has already computed payouts over the
correct hole range; table components display whatever results they receive.

A small note below each affected game table is recommended (deferred to
polish session): "Computed over holes 1–[k]" or "Dave excluded after hole 12."

### §9.2 Scorecard display

The `ReadOnlyScorecard` in `RoundSummaryModal` should show `–` for:
- Holes after `lastCompletedHole` (Scenario B)
- Departed players' holes after `departureHole` (Scenario A)

This matches the live scorecard behavior (§7.3).

---

## §10. Backward Compatibility

All changes are backward compatible:
- `earlyDepartureOpts` absent → no departures (normal behavior)
- `earlyEndOpts` absent → all games pay out (existing invariant preserved)
- `lastCompletedHole` absent → 17 (existing invariant preserved)
- Old saved rounds with none of these fields load correctly

---

## §11. Invariants

1. A player classified as "Missing scores" never triggers the departure
   resolver. The resolver is only available for contiguous trailing empty cells.
2. `earlyDepartureOpts[i].departureHole` is the last hole the departed player
   actually scored (real or X). It is never a future hole.
3. After a player is marked as departed, their post-departure cells are locked.
   The engine never receives non-empty scores for post-departure holes.
4. `'exclude_player'` pre-processes the game's subset before `computePayouts`
   runs. The engine always receives a complete, valid subset.
5. The "X always loses" invariant (ScoreKeypad_Contract §4.5) is the mechanism
   by which departed players (who X'd their last holes) lose post-departure
   holes. The engine does not need special departure-awareness logic.
6. Zero-sum payout invariant holds for all games after departure resolution.
7. Sixes early-end segment rule is preserved regardless of resolver choices.
8. `fromActiveRound` / `toActiveRound` round-trip `earlyDepartureOpts` faithfully.
9. The reactive resolver (Results → gate) and the proactive resolver
   (long-press X) produce identical `activeRound` state. The path to get
   there differs; the outcome is the same.

---

## §12. Known Gaps and Open Items

| # | Severity | Description |
|---|---|---|
| G-1 | High | Nines `'exclude_player'` behavior when fewer than 3 remain — confirm "pays through departure hole" interpretation (§3.7) |
| G-2 | High | Nassau partial segment payout rule — Option A (partial pays) vs Option B (only complete segments) — owner to confirm |
| G-3 | Medium | Visual treatment of departed player in live scorecard header (dimmed chip vs badge vs nothing) — owner confirms at implementation time |
| G-4 | Medium | Multiple departed players in one resolver sheet — layout not fully specified; deferred to implementation |
| G-5 | Low | "Computed over holes 1–k" note in game tables — polish session |
| G-6 | Low | Scenario A + B combined (player departs AND round ends early) — data model supports it (§4.2) but resolver UI flow not fully specified |

---

## §13. Testing Checklist

1. **Scenario B — long-press X, all stop:**
   - Score 9 holes for all players. Long-press X on a cell in hole 9 for any
     player. Choose "Yes, leaving." Resolver shows. Select "Pay for all games."
     Confirm. Results tab opens. All game payouts computed over 9 holes. ✓
2. **Scenario A — one player departs:**
   - Score 12 holes for all players. Dave long-presses X on hole 13.
     "Just this hole" → no departure, X saved, scoring continues. ✓
   - Dave long-presses X on hole 13. "Yes, Dave is leaving." Resolver shows
     Dave's games. Confirm. Dave's cells 14–18 locked. Others continue scoring. ✓
3. **Resolver from Results →:**
   - Score 9 holes for all players, leave 10–18 blank. Tap Results →.
     Classification: all early departure. Resolver shows. ✓
   - Score all holes for Alice, Bob, Carol. Leave Dave blank on holes 13–18
     (contiguous). Tap Results →. Resolver shows Dave as departed. ✓
   - Score all holes for Alice. Leave Bob missing hole 7 (scattered). Tap
     Results →. Blocked with "Missing scores" error, not departure resolver. ✓
4. **`'exclude_player'` for Skins:**
   - Dave departs after hole 12. Skins resolver: "Remove Dave — others continue."
     Results: Skins payouts among Alice/Bob/Carol only. Dave has $0 Skins. ✓
5. **`'no_payout'`:**
   - Any departure scenario. Set all games to "Abandon." Results: all $0. ✓
6. **Undo departure:**
   - Mark Dave as departed. Tap Dave's locked cell. Prompt to resume. Confirm.
     Dave's cells unlocked. `earlyDepartureOpts` cleared for Dave. ✓
7. **Sixes partial — Scenario B:**
   - Score 8 holes (through Sixes segment 1 complete + 2 holes of segment 2).
     End round. Sixes pays segment 1 only. ✓
8. **Share image:**
   - Departed player's cells show `–` after departure hole. ✓
9. **History reload:**
   - Save a round with a departed player. Reload from history. `earlyDepartureOpts`
     restored. RoundSummaryModal shows correct partial payouts. ✓

---

## §14. Final Rule

If implementation behavior conflicts with this contract, call out the conflict.
The implementation must be corrected. This document defines the truth.
